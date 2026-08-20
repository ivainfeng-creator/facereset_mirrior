import { sceneAssetGroups } from './sceneAssets.js';
import { SCENE_IDS } from './sceneIds.js';
import { FIRST_SCHEDULED_DAY, getScheduledSceneIds } from './scheduleConfig.js';
import lemonBackgroundAudio from '../../references/Lemon/Lemon-bg-4.mp3';
import lemonDropAudio from '../../references/Lemon/Drop-1.mp3';
import lemonIceAudio from '../../references/Lemon/Ice.mp3';
import lemonSqueezeAudio from '../../references/Lemon/Squeeze.mp3';
import bunnyBackgroundAudio from '../../references/Bunny/bunny-bg-2.mp3';
import bunnyBlowAudio from '../../references/Bunny/Below.mp3';
import bunnyDeflateAudio from '../../references/Bunny/Deflat.mp3';
import bunnyPopAudio from '../../references/Bunny/Balloon-pop.mp3';
import penguinBackgroundAudio from '../../references/Penguin/Penguin-bg.mp3';
import penguinCatchAudio from '../../references/Penguin/Catch.mp3';
import penguinFishAudio from '../../references/Penguin/Fish.mp3';
import penguinPullAudio from '../../references/Penguin/Pull.mp3';
import penguinYoAudio from '../../references/Penguin/Yo.mp3';

export { SCENE_IDS };

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
        volume: 0.26,
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
    planArt: '/assets/landing/bluecloud_openmouth_1.png',
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
        volume: 0.24,
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
    planArt: '/assets/landing/bluecloud_relax_1.png',
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
        volume: 0.24,
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
    planArt: '/assets/landing/bluecloud_inhale_1.png',
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
    audio: {
      background: {
        source: bunnyBackgroundAudio,
        volume: 0.18,
        fadeInMs: 1000,
        fadeOutMs: 1000,
      },
      effects: {
        balloonBlow: {
          source: bunnyBlowAudio,
          volume: 0.5,
        },
        balloonDeflate: {
          source: bunnyDeflateAudio,
          volume: 0.5,
        },
        balloonPop: {
          source: bunnyPopAudio,
          volume: 0.65,
        },
      },
    },
    layout: PORTRAIT_LAYOUT,
    planPhase: 'Activate',
    planArt: '/assets/bluecloud_below.png',
    practice: {
      renderer: 'bunny',
      title: 'How to Play Bubble Gum Bunny',
      description: 'Puff your cheeks, relax softly, then puff again to grow the bubble.',
      tips: ['Keep your lips closed.', 'Hold each puff for about two seconds.', 'Steady rhythm grows the biggest bubble.'],
      effectTitle: 'Grow the bubble',
      effectDescription: 'Puff softly and keep the bubble floating.',
      previewDemo: { effect: 'bubbleGrow', cycleMs: 3600 },
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
    audio: {
      background: {
        source: lemonBackgroundAudio,
        volume: 0.12,
        fadeInMs: 1000,
        fadeOutMs: 1000,
      },
      effects: {
        lemonSqueeze: {
          source: lemonSqueezeAudio,
          volume: 0.48,
        },
        lemonDrop: {
          source: lemonDropAudio,
          volume: 0.72,
        },
        lemonIce: {
          source: lemonIceAudio,
          volume: 0.68,
        },
      },
    },
    layout: PORTRAIT_LAYOUT,
    planPhase: 'Warm up',
    planArt: '/assets/Bluecloud_nose.png',
    practice: {
      renderer: 'lemon',
      title: 'How to Play Lemon Squeeze',
      description: 'Place both index fingers beside your nose bridge, press inward gently, then release.',
      tips: ['Keep both fingertips visible.', 'Press both sides together.', 'Slow squeeze and release makes more soda.'],
      effectTitle: 'Make lemon soda',
      effectDescription: 'Squeeze evenly and fill the glass with bubbles.',
      previewDemo: { effect: 'lemonSqueeze', cycleMs: 3600 },
    },
  },
  {
    id: SCENE_IDS.penguinFishing,
    order: 7,
    title: 'Penguin Fishing',
    subtitle: 'Raise your eyebrows to lift the line and catch fish through the ice.',
    action: 'Eyebrow raise',
    area: 'Eyebrows',
    areaKey: 'eyebrows',
    stamp: 'Brows',
    mood: 'Icy fishing',
    symbol: 'penguin',
    renderer: 'penguinFishing',
    interaction: 'eyebrowRaise',
    handTracking: 'none',
    audio: {
      background: {
        source: penguinBackgroundAudio,
        volume: 0.18,
        fadeInMs: 1000,
        fadeOutMs: 1000,
      },
      effects: {
        pullLine: { source: penguinPullAudio, volume: 0.65 },
        fishNibble: { source: penguinFishAudio, volume: 0.5 },
        catchFish: { source: penguinCatchAudio, volume: 0.62 },
        celebration: { source: penguinYoAudio, volume: 0.58 },
      },
    },
    layout: { ...FULL_VIEWPORT_LAYOUT, className: 'full-viewport-routine penguin-viewport-routine' },
    planPhase: 'Unwind',
    planArt: '/assets/Bluecloud_eyebrow.png',
    practice: {
      renderer: 'penguin',
      title: 'How to Play Penguin Fishing',
      description: 'Gently raise both eyebrows and hold steady to pull the fishing line up through the ice.',
      tips: ['Keep your face centered and relaxed.', 'Raise both eyebrows gently, without lifting your chin.', 'Hold the raise until the penguin catches a fish, then relax and repeat.'],
      effectTitle: 'Catch the fish',
      effectDescription: 'Lift your eyebrows, pull the line, and reel in a fish.',
      previewDemo: { effect: 'penguinFishing', cycleMs: 3600 },
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

// Resolves "today's 3 scenes" for a given Program Day from the centralized
// schedule in scheduleConfig.js — the schedule's array order is preserved
// as-is (the actual session order), never re-sorted or shuffled here.
export function getDailySceneIdsForProgramDay(programDay) {
  return getScheduledSceneIds(programDay);
}

export function getDailyScenesForProgramDay(programDay) {
  return getDailySceneIdsForProgramDay(programDay).map((sceneId) => getSceneById(sceneId));
}

// Legacy Day-1 defaults, kept for the few call sites that have no Program Day
// context (e.g. a dev-only result preview). Prefer getDailyScenesForProgramDay
// / getDailySceneIdsForProgramDay wherever a Program Day is available.
export const dailyScenes = Object.freeze(getDailyScenesForProgramDay(FIRST_SCHEDULED_DAY));
export const TODAY_SCENE_IDS = Object.freeze(getDailySceneIdsForProgramDay(FIRST_SCHEDULED_DAY));

export function getUpcomingDailyScenes(sceneId, count = 1) {
  return getUpcomingScenes(sceneId, count, dailyScenes);
}
