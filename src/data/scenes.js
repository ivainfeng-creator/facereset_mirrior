export const SCENE_IDS = {
  rainWiper: 'rainWiper',
  whaleDream: 'whaleDream',
  templeGarden: 'templeGarden',
};

export const interactionScenes = [
  {
    id: SCENE_IDS.rainWiper,
    title: 'Rain Wiper',
    subtitle: 'Glide under your eyes and clear a rainy window.',
    action: 'Under-eye glide',
    mood: 'Cozy rain',
    symbol: 'rain',
  },
  {
    id: SCENE_IDS.whaleDream,
    title: 'Whale Dream',
    subtitle: 'Open wide and let little fish drift out.',
    action: 'Mouth opening',
    mood: 'Dream ocean',
    symbol: 'whale',
  },
  {
    id: SCENE_IDS.templeGarden,
    title: 'Cloud Garden',
    subtitle: 'Press both temples and let the garden breathe.',
    action: 'Temple press',
    mood: 'Soft garden',
    symbol: 'cloud',
  },
];

export function getSceneById(sceneId) {
  return interactionScenes.find((scene) => scene.id === sceneId) || interactionScenes[1];
}
