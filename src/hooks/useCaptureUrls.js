import { useEffect, useState } from 'react';
import { getCapturesByDate } from '../utils/captureStorage.js';

// Lazily reads the locally persisted session captures for one day and exposes
// them as <img>-ready sources keyed by scene ID. Always resolves to a plain
// object: a missing store, a failed read or a cleared browser simply yields no
// photos, so every consumer keeps its existing no-photo fallback.
//
// Deliberately data URLs rather than object URLs: the Share Card is exported via
// html-to-image with `cacheBust: true`, which appends a `?<timestamp>` query to
// every non-data image src it fetches. That query makes a `blob:` URL
// unresolvable, so an exported card would silently lose its photo. Data URLs are
// skipped by that code path entirely, and three ~30KB photos cost far less than
// the export regression does.
export function useCaptureUrlsByDate(dateKey) {
  const [captureUrlsByScene, setCaptureUrlsByScene] = useState({});

  useEffect(() => {
    let isCurrent = true;

    setCaptureUrlsByScene({});
    if (!dateKey) return undefined;

    void loadCaptureDataUrls(dateKey).then((nextUrls) => {
      if (isCurrent) setCaptureUrlsByScene(nextUrls);
    });

    return () => {
      isCurrent = false;
    };
  }, [dateKey]);

  return captureUrlsByScene;
}

async function loadCaptureDataUrls(dateKey) {
  const records = await getCapturesByDate(dateKey);
  const entries = await Promise.all(
    records.map(async (record) => [record.sceneId, await blobToDataUrl(record.blob)]),
  );

  return Object.fromEntries(entries.filter(([, dataUrl]) => Boolean(dataUrl)));
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}
