export const SCENE_IDS = {
  rainWiper: 'rainWiper',
  whaleDream: 'whaleDream',
  templeGarden: 'templeGarden',
  flowerCollector: 'flowerCollector',
  bubbleGumBunny: 'bubbleGumBunny',
};

export const interactionScenes = [
  {
    id: SCENE_IDS.rainWiper,
    title: 'Rain Wiper',
    subtitle: 'Glide under your eyes and clear a rainy window.',
    action: 'Under-eye glide',
    area: 'Under-eye',
    areaKey: 'underEye',
    stamp: 'Eyes',
    mood: 'Cozy rain',
    symbol: 'rain',
  },
  {
    id: SCENE_IDS.whaleDream,
    title: 'Whale Dream',
    subtitle: 'Open wide and let little fish drift out.',
    action: 'Mouth opening',
    area: 'Mouth + jaw',
    areaKey: 'mouth',
    stamp: 'Mouth',
    mood: 'Dream ocean',
    symbol: 'whale',
  },
  {
    id: SCENE_IDS.templeGarden,
    title: 'Cloud Garden',
    subtitle: 'Press both temples and let the garden breathe.',
    action: 'Temple press',
    area: 'Temples',
    areaKey: 'temples',
    stamp: 'Temples',
    mood: 'Soft garden',
    symbol: 'cloud',
  },
  {
    id: SCENE_IDS.flowerCollector,
    title: 'Flower Collector',
    subtitle: 'Wrinkle your nose and inhale the blossoms.',
    action: 'Nose sniff',
    area: 'Nose',
    areaKey: 'nose',
    stamp: 'Nose',
    mood: 'Bloom field',
    symbol: 'flower',
  },
  {
    id: SCENE_IDS.bubbleGumBunny,
    title: 'Bubble Gum Bunny',
    subtitle: 'Puff your cheeks and grow a soft pink bubble.',
    action: 'Cheek puff',
    area: 'Cheeks',
    areaKey: 'cheeks',
    stamp: 'Cheeks',
    mood: 'Pastel cute',
    symbol: 'bunny',
  },
];

export function getSceneById(sceneId) {
  return interactionScenes.find((scene) => scene.id === sceneId) || interactionScenes[1];
}
