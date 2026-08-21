import { toBlob } from 'html-to-image';

// html-to-image rasterises the Share Card by serialising a clone into an SVG
// <foreignObject> and drawing that SVG through an <img> onto a canvas. WebKit
// only paints the nested <img> elements of such an SVG once their bitmaps are
// already in its decoded-image cache, and it never blocks the draw waiting for
// them. html-to-image warms that cache for network images (it awaits `onload`
// on the clone after swapping in the inlined data URL), but it skips images
// whose src is *already* a data URL entirely — which is exactly what the three
// captured face photos are. So on WebKit the first raster of a freshly mounted
// card comes back with the photo circles unpainted, showing the white
// `.share-card-photo` background instead, while every other element is fine.
//
// Measured on Safari 26.2 with three data-URL photos, rasterising repeatedly:
//   raster 1 -> fully transparent PNG (33KB)
//   raster 2 -> card renders, all three circles white (243KB)
//   raster 3 -> correct (421KB), and stable from then on
// Chromium is correct from raster 1. Because Download and Share share one
// export function, whichever button was pressed *first* got the broken raster
// — which is why "Download works, Share doesn't" depended purely on tap order.
//
// So the card is warmed once per content: wait for the live <img> elements to
// decode, let the browser paint, then rasterise until two rasters in a row come
// out identical. A guessed number of throwaway rasters is not enough and not
// deterministic — measured on the same card, the 722px hero photo needed a
// second warm-up raster after the two 322px photos had already landed — so this
// keys off the output actually settling rather than off a count or a delay.
const EXPORT_TIMEOUT_MS = 12000;
// WebKit can hand back the *same* incomplete raster twice in a row, so two
// matching fingerprints on their own are not proof the photos have landed
// (measured: 243164 bytes, all three circles white, twice consecutively). Two
// rules make the warm-up safe against that. Matching fingerprints only end the
// loop once at least MIN rasters exist, and whatever the loop produces, the
// raster that is published is the *largest* one seen: these are rasters of one
// unchanging card at one fixed size, so the only thing that can vary is how
// much of it got painted, and more painted content is a bigger PNG.
const MIN_WARMUP_RASTERS = 3;
// Bounded so a card that never settles (a genuinely undecodable photo) still
// exports instead of spinning.
const MAX_WARMUP_RASTERS = 4;
// How many times an export will follow a warm-up that got superseded mid-wait.
// The card is re-keyed at most a couple of times per Result Page (mount, then
// photos), so this only has to outlast that.
const MAX_WARMUP_FOLLOWS = 3;

// One warm-up per (node, content). Keyed by node as well, because a remounted
// card is a cold card even when it is showing the same photos.
let warmedNode = null;
let warmedSignature = null;
let warmupPromise = null;
// The settled raster for exactly that (node, content). Serving it to both
// buttons keeps Download and Share on literally the same bytes, and keeps a
// Share tap from re-rasterising — which matters on iOS, where the transient
// user activation `navigator.share()` needs can expire while we work.
let settledBlob = null;

// Kicked off as soon as the card's photos are on screen, and awaited again by
// the export itself, so a user who taps Share instantly still gets a warm card
// (it just costs them the warm-up inline).
export function warmShareCardExport(node, signature, options) {
  if (!node) return Promise.resolve();

  if (warmedNode !== node || warmedSignature !== signature) {
    warmedNode = node;
    warmedSignature = signature;
    // Anything the signature covers has changed, so the previous raster is not
    // this card any more. Dropped before the new warm-up starts, never after.
    settledBlob = null;
    warmupPromise = runWarmup(node, signature, options);
  }

  return warmupPromise;
}

export async function renderShareCardBlob(node, signature, options) {
  if (!node) throw new Error('Share card is not ready yet.');

  return withTimeout((async () => {
    // React runs the warm-up effect for a render before any tap handler from
    // that render can fire, so the caller's signature is never behind the
    // current one at this point: this either joins the warm-up already running
    // or, if the card was re-keyed without one, starts it. Re-keying here is
    // what stops a caller ever being served a previous card's raster.
    warmShareCardExport(node, signature, options);

    // Then follow the chain. The card is re-keyed the moment the photos load,
    // which can happen while a tap is already waiting; what the user asked for
    // is a picture of the card as it is now, so joining the newer warm-up is
    // the right answer, not falling back to a cold raster of the new card.
    for (let follow = 0; follow < MAX_WARMUP_FOLLOWS; follow += 1) {
      const pending = warmupPromise;
      if (!pending) break;
      await pending;
      if (warmupPromise === pending) break;
    }

    // settledBlob is only ever written by the warm-up that was current at the
    // time, and is cleared before a new one starts, so if it belongs to this
    // node it is the newest card.
    if (settledBlob && warmedNode === node) return settledBlob;

    // Only reached when no warm-up could produce a raster at all.
    return rasterize(node, options);
  })(), EXPORT_TIMEOUT_MS);
}

async function runWarmup(node, signature, options) {
  try {
    await waitForImages(node);
    await waitForPaint();

    let previous = null;
    let best = null;

    for (let attempt = 1; attempt <= MAX_WARMUP_RASTERS; attempt += 1) {
      // The Result Page warms the card as soon as it mounts and again when the
      // photos land, so a superseded run is normal. It must stop rather than
      // keep rasterising the node alongside the current run — and above all it
      // must never publish its raster, which is a picture of the older card.
      if (!isCurrentCard(node, signature)) return;

      const blob = await rasterize(node, options);
      const stamp = await fingerprint(blob);
      if (!stamp) return;

      // `>=` so that among equally complete rasters the freshest one wins.
      if (!best || stamp.size >= best.stamp.size) best = { blob, stamp };

      const isRepeat = Boolean(previous)
        && stamp.size === previous.size
        && stamp.hash === previous.hash;
      previous = stamp;

      if (isRepeat && attempt >= MIN_WARMUP_RASTERS) break;
    }

    if (best && isCurrentCard(node, signature)) settledBlob = best.blob;
  } catch {
    // A warm-up is an optimisation, never a precondition: if it fails the real
    // export still runs (and, on WebKit, simply pays the cost inline instead).
  }
}

function isCurrentCard(node, signature) {
  return warmedNode === node && warmedSignature === signature;
}

// Byte length alone can match across two different rasters, so a settled raster
// has to agree on content too. FNV-1a over the PNG bytes is a few milliseconds
// for a ~420KB card and needs no dependency; this is a change detector, not a
// security primitive.
async function fingerprint(blob) {
  if (!blob) return null;

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let hash = 2166136261;
  for (let index = 0; index < bytes.length; index += 1) {
    hash = Math.imul(hash ^ bytes[index], 16777619) >>> 0;
  }

  return { size: blob.size, hash };
}

// toBlob embeds @font-face CSS by fetching it over the network; if that fails
// (offline, blocked font host, slow proxy) fall back to a no-embedded-fonts
// raster rather than losing the export.
function rasterize(node, options) {
  return toBlob(node, options).catch(() => toBlob(node, { ...options, skipFonts: true }));
}

// Resolves once every <img> under `node` is loaded and decoded. Images that are
// already complete, still loading, cached, or that fail outright all resolve;
// `decode()` is preferred where available and its rejection is not fatal, since
// a photo that cannot decode must not block the rest of the card from
// exporting.
export function waitForImages(node) {
  const images = Array.from(node.querySelectorAll('img'));

  return Promise.all(images.map(async (image) => {
    if (!image.complete) {
      await new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }

    if (typeof image.decode === 'function') {
      await image.decode().catch(() => {});
    }
  }));
}

// Two frames: one for the style/layout flush that follows decoding, one for the
// paint itself, so the first warm-up raster sees a fully painted card.
function waitForPaint() {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Export timed out.')), timeoutMs);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}
