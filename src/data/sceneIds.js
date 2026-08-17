// Canonical scene ID registry. Kept dependency-free so both scenes.js (the scene
// registry) and scheduleConfig.js (the 7-day schedule) can import it without
// creating a circular dependency between those two files.
export const SCENE_IDS = Object.freeze({
  whaleDream: 'whaleDream',
  whaleDream2: 'whaleDream2',
  templeGarden: 'templeGarden',
  flowerCollector: 'flowerCollector',
  bubbleGumBunny: 'bubbleGumBunny',
  lemonSqueeze: 'lemonSqueeze',
});
