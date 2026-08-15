const audioEntries = new Map();
let activeBackground = null;
let pendingBackground = null;
let unlockListenerAttached = false;

function canUseAudio() {
  return typeof window !== 'undefined' && typeof Audio !== 'undefined';
}

export function traceAudioLifecycle(event, details = {}) {
  if (import.meta.env.DEV) {
    console.info('[Face Reset][Audio]', event, details);
  }
}

export function getSceneBackgroundDiagnostics(source) {
  if (!import.meta.env.DEV || !source) return null;

  const entry = audioEntries.get(source);
  const audio = entry?.audio;
  return {
    activeBackgroundId: activeBackground?.id || null,
    activeBackgroundGeneration: activeBackground?.generation ?? null,
    pendingBackgroundId: pendingBackground?.id || null,
    pendingBackgroundGeneration: pendingBackground?.generation ?? null,
    audioEntryExists: Boolean(entry),
    audioGeneration: entry?.generation ?? null,
    fadeScheduled: Boolean(entry?.fadeFrame),
    src: audio?.currentSrc || audio?.src || source,
    paused: audio?.paused ?? null,
    currentTime: audio ? Number(audio.currentTime.toFixed(3)) : null,
    muted: audio?.muted ?? null,
    volume: audio ? Number(audio.volume.toFixed(3)) : null,
  };
}

function getAudioEntry(source) {
  if (!canUseAudio() || !source) return null;

  if (!audioEntries.has(source)) {
    const audio = new Audio(source);
    audio.preload = 'auto';
    audioEntries.set(source, {
      audio,
      fadeFrame: null,
      fadeToken: 0,
      generation: 0,
    });
  }

  return audioEntries.get(source);
}

function claim(entry) {
  entry.generation += 1;
  return entry.generation;
}

function cancelFade(entry) {
  if (!entry) return;

  entry.fadeToken += 1;
  if (entry.fadeFrame !== null) window.cancelAnimationFrame(entry.fadeFrame);
  entry.fadeFrame = null;
}

function clampVolume(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.min(1, numericValue));
}

function setSafeVolume(entry, volume) {
  try {
    entry.audio.volume = clampVolume(volume);
    return true;
  } catch (error) {
    traceAudioLifecycle('BGM volume write failed', { name: error?.name });
    return false;
  }
}

function fadeTo(entry, generation, targetVolume, duration, onComplete) {
  if (!entry) return;

  cancelFade(entry);
  const fadeToken = entry.fadeToken;
  const startVolume = clampVolume(entry.audio.volume);
  const finalVolume = clampVolume(targetVolume);
  const durationMs = Math.max(1, Number(duration) || 0);
  const startTime = performance.now();
  let completed = false;

  const completeFade = () => {
    if (completed) return;
    completed = true;
    entry.fadeFrame = null;
    onComplete?.();
  };

  const step = (now) => {
    if (entry.generation !== generation || entry.fadeToken !== fadeToken) return;

    const elapsedMs = Math.max(0, Number(now) - startTime);
    const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
    const computedVolume = startVolume + (finalVolume - startVolume) * progress;
    const volumeWritten = setSafeVolume(entry, progress >= 1 ? finalVolume : computedVolume);

    if (progress < 1 && volumeWritten) {
      entry.fadeFrame = window.requestAnimationFrame(step);
      return;
    }

    completeFade();
  };

  entry.fadeFrame = window.requestAnimationFrame(step);
}

function attachUnlockListener() {
  if (!canUseAudio() || unlockListenerAttached) return;

  unlockListenerAttached = true;
  const unlock = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    unlockListenerAttached = false;
  };

  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
}

export function preloadAudioSources(sources = []) {
  sources.filter(Boolean).forEach((source) => {
    getAudioEntry(source)?.audio.load();
  });
}

export function preloadSceneAudio(sceneAudio) {
  if (!sceneAudio) return;

  preloadAudioSources([
    sceneAudio.background?.source,
    ...Object.values(sceneAudio.effects || {}).map((effect) => effect.source),
  ]);
}

// Call from an existing tap/click before entering a scene. The priming token prevents the
// asynchronous muted play callback from ever pausing a scene that starts afterwards.
export function unlockAudio() {
  if (!canUseAudio()) return;

  traceAudioLifecycle('unlock requested');
  audioEntries.forEach((entry, source) => {
    const { audio } = entry;
    if (!audio.paused) return;

    const generation = claim(entry);
    const previousMuted = audio.muted;
    audio.muted = true;
    traceAudioLifecycle('priming requested', { source });
    audio.play()
      .then(() => {
        if (entry.generation !== generation) return;
        audio.pause();
        audio.currentTime = 0;
        audio.muted = previousMuted;
        traceAudioLifecycle('priming finished', { source });
      })
      .catch((error) => {
        if (entry.generation !== generation) return;
        audio.muted = previousMuted;
        traceAudioLifecycle('priming blocked', { source, name: error?.name });
      });
  });

  if (pendingBackground) {
    const background = pendingBackground;
    pendingBackground = null;
    startSceneBackground(background);
  }
}

export function startSceneBackground({ id, source, volume = 0.35, fadeInMs = 1000 }) {
  const entry = getAudioEntry(source);
  if (!entry) return;

  if (activeBackground?.id === id && activeBackground.source === source && !entry.audio.paused) {
    return;
  }

  if (activeBackground) stopSceneBackground(activeBackground, { fadeOutMs: 0 });

  cancelFade(entry);
  const generation = claim(entry);
  const background = { id, source, volume, fadeInMs, generation };
  const { audio } = entry;
  const isMutedPrimingPlayback = audio.muted && !audio.paused;
  if (!isMutedPrimingPlayback) audio.pause();
  audio.loop = true;
  audio.muted = false;
  audio.volume = 0;
  audio.currentTime = 0;
  activeBackground = background;
  traceAudioLifecycle('BGM play requested', {
    id,
    source,
    generation,
    audio: getSceneBackgroundDiagnostics(source),
  });

  audio.play()
    .then(() => {
      if (entry.generation !== generation || activeBackground?.generation !== generation) return;
      traceAudioLifecycle('BGM play resolved', {
        id,
        source,
        generation,
        audio: getSceneBackgroundDiagnostics(source),
      });
      fadeTo(entry, generation, volume, fadeInMs, () => {
        traceAudioLifecycle('BGM fade-in complete', { id, source, generation });
      });
    })
    .catch((error) => {
      if (entry.generation !== generation || activeBackground?.generation !== generation) return;
      activeBackground = null;
      pendingBackground = background;
      traceAudioLifecycle('BGM play rejected', {
        id,
        source,
        generation,
        name: error?.name,
        audio: getSceneBackgroundDiagnostics(source),
      });
      attachUnlockListener();
    });
}

export function stopSceneBackground(background, { fadeOutMs = 1000 } = {}) {
  if (!background?.source) return;
  if (pendingBackground?.generation === background.generation || pendingBackground?.id === background.id) {
    pendingBackground = null;
  }

  if (
    activeBackground?.id !== background.id
    || activeBackground?.source !== background.source
    || (background.generation && activeBackground.generation !== background.generation)
  ) {
    return;
  }

  const entry = getAudioEntry(background.source);
  if (!entry) return;

  activeBackground = null;
  const generation = claim(entry);
  traceAudioLifecycle('BGM fade-out requested', {
    id: background.id,
    source: background.source,
    generation,
    fadeOutMs,
    audio: getSceneBackgroundDiagnostics(background.source),
  });
  fadeTo(entry, generation, 0, fadeOutMs, () => {
    if (entry.generation !== generation) return;
    entry.audio.pause();
    entry.audio.currentTime = 0;
    traceAudioLifecycle('BGM stopped and reset', {
      id: background.id,
      source: background.source,
      generation,
      audio: getSceneBackgroundDiagnostics(background.source),
    });
  });
}

export function resetSceneBackground(background) {
  if (!background?.source) return;
  if (pendingBackground?.generation === background.generation || pendingBackground?.id === background.id) {
    pendingBackground = null;
  }

  if (
    activeBackground?.id === background.id
    && activeBackground?.source === background.source
    && (!background.generation || activeBackground.generation === background.generation)
  ) {
    activeBackground = null;
  }

  const entry = getAudioEntry(background.source);
  if (!entry) return;

  cancelFade(entry);
  const generation = claim(entry);
  entry.audio.pause();
  entry.audio.currentTime = 0;
  entry.audio.volume = 0;
  traceAudioLifecycle('BGM final reset', {
    id: background.id,
    source: background.source,
    generation,
    audio: getSceneBackgroundDiagnostics(background.source),
  });
}

export function playSceneEffect(effect) {
  if (!effect?.source) return;

  const entry = getAudioEntry(effect.source);
  if (!entry) return;

  cancelFade(entry);
  claim(entry);
  entry.audio.loop = Boolean(effect.loop);
  entry.audio.muted = false;
  entry.audio.volume = effect.volume ?? 0.55;
  entry.audio.currentTime = 0;
  entry.audio.play().catch(() => attachUnlockListener());
}

export function stopSceneEffect(effect) {
  if (!effect?.source) return;

  const entry = getAudioEntry(effect.source);
  if (!entry) return;

  cancelFade(entry);
  claim(entry);
  entry.audio.pause();
  entry.audio.currentTime = 0;
}
