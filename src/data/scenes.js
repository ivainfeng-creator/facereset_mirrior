import { sceneAssetGroups } from './sceneAssets.js';

export const SCENE_IDS = Object.freeze({
  whaleDream: 'whaleDream',
  whaleDream2: 'whaleDream2',
  templeGarden: 'templeGarden',
  flowerCollector: 'flowerCollector',
  bubbleGumBunny: 'bubbleGumBunny',
  lemonSqueeze: 'lemonSqueeze',
});

const FULL_VIEWPORT_LAYOUT = Object.freeze({
  mode: 'full-viewport',
  className: 'full-viewport-routine',
  scaleMode: 'cover',
});

const PORTRAIT_LAYOUT = Object.freeze({
  mode: 'portrait',
  className: 'portrait-viewport-routine',
  aspectRatio: 9 / 16,
  scaleMode: 'contain',
});

// This is the canonical scene registry. Shared flow, asset, layout, and interaction code
// derives from these descriptors so a scene is added by registering its own configuration.
const sceneDefinitions = [
  {
    id: SCENE_IDS.whaleDream,
    order: 1,
    dailyOrder: 1,
    title: 'Whale Mouth',
    subtitle: 'Open wide and guide little fish into the whale.',
    action: 'Mouth opening',
    area: 'Mouth + jaw',
    areaKey: 'mouth',
    stamp: 'Mouth',
    mood: 'Whale mouth',
    symbol: 'whale',
    renderer: 'whaleDream',
    interaction: 'mouthOpening',
    handTracking: 'none',
    audio: {
      background: {
        source: '/audio/whale_mouth/whale_BG.mp3',
        volume: 0.34,
        fadeInMs: 1000,
        fadeOutMs: 1000,
      },
      effects: {
        mouthOpen: {
          source: '/audio/whale_mouth/bubble.mp3',
          volume: 0.52,
        },
      },
    },
    layout: { ...FULL_VIEWPORT_LAYOUT, className: 'full-viewport-routine whale-viewport-routine' },
    planPhase: 'Warm up',
    planArt: '/assets/design-v3/challenge-step1.png',
    practice: {
      renderer: 'whale',
      title: 'How to Play Whale Mouth',
      description: 'Open your mouth gently and hold it steady so little fish can swim into the whale.',
      tips: ['Keep your face centered.', 'Open your mouth gently and hold it steady.', 'Let the ocean scene react to your breath.'],
      effectTitle: 'Guide the fish',
      effectDescription: 'Open gently. Hold steady. Watch the ocean respond.',
      previewDemo: { effect: 'mouthFlow', cycleMs: 3600 },
    },
  },
  {
    id: SCENE_IDS.whaleDream2,
    order: 2,
    title: 'Whale Dream 2',
    subtitle: 'Open wide and wake the pufferfish dream.',
    action: 'Mouth opening',
    area: 'Mouth + jaw',
    areaKey: 'mouth',
    stamp: 'Mouth',
    mood: 'Pufferfish XR',
    symbol: 'puffer',
    renderer: 'whaleDream2',
    interaction: 'mouthOpening',
    handTracking: 'none',
    layout: PORTRAIT_LAYOUT,
    practice: {
      renderer: 'whale',
      title: 'How to Play Whale Dream 2',
      description: 'Open your mouth gently and hold it steady so the pufferfish dream can wake up.',
      tips: ['Keep your face centered.', 'Open your mouth gently and hold it steady.', 'Let the ocean scene react to your breath.'],
      effectTitle: 'Wake the dream',
      effectDescription: 'Open gently. Hold steady. Watch the ocean come alive.',
    },
  },
  {
    id: SCENE_IDS.templeGarden,
    order: 3,
    dailyOrder: 2,
    title: 'Cloud Garden',
    subtitle: 'Press both temples and let the garden breathe.',
    action: 'Temple press',
    area: 'Temples',
    areaKey: 'temples',
    stamp: 'Temples',
    mood: 'Soft garden',
    symbol: 'cloud',
    renderer: 'templeGarden',
    interaction: 'templePress',
    handTracking: 'temple',
    audio: {
      background: {
        source: '/audio/garden/garden_BGM.mp3',
        volume: 0.32,
        fadeInMs: 1000,
        fadeOutMs: 1000,
      },
      effects: {
        gardenRain: {
          source: '/audio/garden/garden_SFX.wav',
          volume: 0.48,
          loop: true,
        },
      },
    },
    layout: { ...FULL_VIEWPORT_LAYOUT, className: 'full-viewport-routine cloud-garden-viewport-routine' },
    planPhase: 'Activate',
    planArt: '/assets/design-v3/challenge-step2.png',
    practice: {
      renderer: 'cloud',
      title: 'How to Play Cloud Garden',
      description: 'Place both index fingers on your temples, then press and release slowly.',
      tips: ['Use both hands at the same time.', 'Keep both fingertips visible.', 'Gentle balanced pressure grows the garden.'],
      effectTitle: 'Let it rain',
      effectDescription: 'Press evenly and let the garden breathe.',
      previewDemo: { effect: 'rainGrowth', cycleMs: 3600 },
    },
  },
  {
    id: SCENE_IDS.flowerCollector,
    order: 4,
    dailyOrder: 3,
    title: 'Popcorn Collector',
    subtitle: 'Inhale and gather the popcorn.',
    action: 'Nose sniff',
    area: 'Nose',
    areaKey: 'nose',
    stamp: 'Nose',
    mood: 'Movie night',
    symbol: 'popcorn',
    renderer: 'popcornCollector',
    interaction: 'noseSniff',
    handTracking: 'none',
    audio: {
      background: {
        source: '/audio/popcorn/popcorn_BGM.mp3',
        volume: 0.32,
        fadeInMs: 1000,
        fadeOutMs: 1000,
      },
      effects: {
        popcornGather: {
          source: '/audio/popcorn/popcorn_SFX2.mp3',
          volume: 0.48,
          loop: true,
        },
      },
    },
    layout: { ...FULL_VIEWPORT_LAYOUT, className: 'full-viewport-routine popcorn-viewport-routine' },
    planPhase: 'Unwind',
    planArt: '/assets/design-v3/challenge-step3.png',
    practice: {
      renderer: 'popcorn',
      title: 'How to Play Popcorn Collector',
      description: 'Wrinkle your nose gently, then relax and repeat.',
      tips: ['Keep your face centered.', 'Scrunch your nose gently.', 'Each good inhale gathers more popcorn.'],
      effectTitle: 'Gather popcorn',
      effectDescription: 'Inhale gently and pull popcorn toward you.',
      previewDemo: { effect: 'popcornGather', cycleMs: 3600 },
    },
  },
  {
    id: SCENE_IDS.bubbleGumBunny,
    order: 5,
    title: 'Bubble Gum Bunny',
    subtitle: 'Puff your cheeks and grow a soft pink bubble.',
    action: 'Cheek puff',
    area: 'Cheeks',
    areaKey: 'cheeks',
    stamp: 'Cheeks',
    mood: 'Pastel cute',
    symbol: 'bunny',
    renderer: 'bubbleGumBunny',
    interaction: 'cheekPuff',
    handTracking: 'none',
    layout: PORTRAIT_LAYOUT,
    practice: {
      renderer: 'bunny',
      title: 'How to Play Bubble Gum Bunny',
      description: 'Puff your cheeks, relax softly, then puff again to grow the bubble.',
      tips: ['Keep your lips closed.', 'Hold each puff for about two seconds.', 'Steady rhythm grows the biggest bubble.'],
      effectTitle: 'Grow the bubble',
      effectDescription: 'Puff softly and keep the bubble floating.',
    },
  },
  {
    id: SCENE_IDS.lemonSqueeze,
    order: 6,
    title: 'Lemon Squeeze',
    subtitle: 'Press both sides of your nose to make lemon soda.',
    action: 'Nose bridge press',
    area: 'Nose bridge',
    areaKey: 'nose',
    stamp: 'Lemon',
    mood: 'Summer soda',
    symbol: 'lemon',
    renderer: 'lemonSqueeze',
    interaction: 'lemonSqueeze',
    handTracking: 'lemon',
    layout: PORTRAIT_LAYOUT,
    practice: {
      renderer: 'lemon',
      title: 'How to Play Lemon Squeeze',
      description: 'Place both index fingers beside your nose bridge, press inward gently, then release.',
      tips: ['Keep both fingertips visible.', 'Press both sides together.', 'Slow squeeze and release makes more soda.'],
      effectTitle: 'Make lemon soda',
      effectDescription: 'Squeeze evenly and fill the glass with bubbles.',
    },
  },
];

export const interactionScenes = Object.freeze(sceneDefinitions
  .map((scene) => Object.freeze({
    ...scene,
    assets: sceneAssetGroups[scene.id] || Object.freeze([]),
  }))
  .sort((left, right) => left.order - right.order));

export const DEFAULT_SCENE_ID = interactionScenes[0].id;

export const dailyScenes = Object.freeze(interactionScenes
  .filter((scene) => Number.isFinite(scene.dailyOrder))
  .sort((left, right) => left.dailyOrder - right.dailyOrder));

export const TODAY_SCENE_IDS = Object.freeze(dailyScenes.map((scene) => scene.id));

export function getSceneById(sceneId) {
  return interactionScenes.find((scene) => scene.id === sceneId) || interactionScenes[0];
}

export function getSceneIndex(sceneId, scenes = interactionScenes) {
  return scenes.findIndex((scene) => scene.id === sceneId);
}

export function getUpcomingScenes(sceneId, count = 1, scenes = interactionScenes) {
  const index = getSceneIndex(sceneId, scenes);
  if (index < 0 || count <= 0) return [];
  return scenes.slice(index + 1, index + 1 + count);
}

export function getNextScene(sceneId, scenes = interactionScenes) {
  return getUpcomingScenes(sceneId, 1, scenes)[0] || null;
}

export function getUpcomingDailyScenes(sceneId, count = 1) {
  return getUpcomingScenes(sceneId, count, dailyScenes);
}
