import { interactionScenes } from '../data/scenes.js';

let hasWarnedAboutInvalidDebugScene = false;

export function getActiveDebugSceneId() {
  // Vite replaces DEV at build time, so production never reads debugScene.
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;

  const debugScene = new URLSearchParams(window.location.search).get('debugScene');
  if (!debugScene) return null;

  const scene = interactionScenes.find((candidate) => candidate.id === debugScene);
  if (scene) return scene.id;

  if (!hasWarnedAboutInvalidDebugScene) {
    hasWarnedAboutInvalidDebugScene = true;
    console.warn('[Face Reset] Ignoring unknown debugScene.', {
      debugScene,
      supportedSceneIds: interactionScenes.map((candidate) => candidate.id),
    });
  }

  return null;
}
