import { getUpcomingDailyScenes, getUpcomingScenes } from '../data/scenes.js';

const preloadedAssets = new Set();

function canPreload(assetUrl) {
  return typeof assetUrl === 'string' && /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(assetUrl);
}

export function preloadSceneAssets(scene) {
  if (typeof window === 'undefined' || !scene?.assets) return;

  scene.assets.forEach((assetUrl) => {
    if (!canPreload(assetUrl) || preloadedAssets.has(assetUrl)) return;

    preloadedAssets.add(assetUrl);
    const image = new Image();
    image.decoding = 'async';
    image.src = assetUrl;
  });
}

export function preloadUpcomingScenes(sceneId, preloadCount = 2, { useDailyOrder = false } = {}) {
  const upcoming = useDailyOrder
    ? getUpcomingDailyScenes(sceneId, preloadCount)
    : getUpcomingScenes(sceneId, preloadCount);
  upcoming.forEach(preloadSceneAssets);
}
