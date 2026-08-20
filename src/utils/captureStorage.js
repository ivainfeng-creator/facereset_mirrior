// Best-effort local-only storage for the face photo captured at the end of each
// completed session. Photos never leave the device: Supabase keeps score /
// progress / streak / leaderboard data only, and nothing here is allowed to
// affect session completion, scoring, Daily Progress, Result or History — every
// entry point resolves to a neutral value when IndexedDB is unavailable,
// blocked, cleared, or running in a partitioned iframe.
const DB_NAME = 'facerest-local-captures';
const DB_VERSION = 1;
const STORE_NAME = 'sessionCaptures';
const DATE_INDEX = 'dateKey';
// The routine capture is already a 360x440 WebP data URL (see RoutineScreen's
// createRoutineSnapshot), so this pass mainly converts it to a Blob; the
// max-width clamp only matters if that capture size ever grows.
const MAX_WIDTH = 480;
const QUALITY = 0.78;

export async function saveCapture(dateKey, sceneId, blob) {
  if (!dateKey || !sceneId || !(blob instanceof Blob)) return false;

  const db = await openCaptureDb();
  if (!db) return false;

  try {
    await runStoreRequest(db, 'readwrite', (store) => store.put({
      id: createCaptureKey(dateKey, sceneId),
      dateKey,
      sceneId,
      blob,
      createdAt: new Date().toISOString(),
    }));
    return true;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

export async function getCapturesByDate(dateKey) {
  if (!dateKey) return [];

  const db = await openCaptureDb();
  if (!db) return [];

  try {
    const records = await runStoreRequest(db, 'readonly', (store) => (
      store.index(DATE_INDEX).getAll(dateKey)
    ));
    return Array.isArray(records) ? records.filter(isCaptureRecord) : [];
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export async function createOptimizedCaptureBlob(dataUrl) {
  try {
    const image = await loadImage(dataUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) return dataUrlToBlob(dataUrl);

    const scale = Math.min(1, MAX_WIDTH / sourceWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) return dataUrlToBlob(dataUrl);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Safari only gained canvas WebP encoding in 16.x; older engines hand back
    // a PNG (or null) from toBlob, so fall back rather than storing nothing.
    const webpBlob = await canvasToBlob(canvas, 'image/webp', QUALITY);
    if (webpBlob?.type === 'image/webp') return webpBlob;

    return webpBlob || dataUrlToBlob(dataUrl);
  } catch {
    return dataUrlToBlob(dataUrl);
  }
}

function openCaptureDb() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }

    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      // Some privacy modes throw on open() instead of firing onerror.
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(STORE_NAME)
        ? request.transaction.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME, { keyPath: 'id' });

      if (!store.indexNames.contains(DATE_INDEX)) {
        store.createIndex(DATE_INDEX, DATE_INDEX, { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

// Resolves on transaction completion (not just request success) so a write is
// actually committed before the connection is closed.
function runStoreRequest(db, mode, createRequest) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = createRequest(transaction.objectStore(STORE_NAME));

    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Capture image could not be loaded.'));
    image.src = dataUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    if (!canvas.toBlob) {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function dataUrlToBlob(dataUrl) {
  try {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
    const [metadata, payload] = dataUrl.split(',');
    const type = metadata.match(/^data:([^;]+)/)?.[1] || 'image/webp';
    const bytes = atob(payload || '');
    const buffer = new Uint8Array(bytes.length);
    for (let index = 0; index < bytes.length; index += 1) {
      buffer[index] = bytes.charCodeAt(index);
    }
    return new Blob([buffer], { type });
  } catch {
    return null;
  }
}

function createCaptureKey(dateKey, sceneId) {
  return `${dateKey}:${sceneId}`;
}

function isCaptureRecord(record) {
  return Boolean(record?.dateKey && record?.sceneId && record.blob instanceof Blob);
}
