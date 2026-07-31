export function createInteractionSignalState(initialValue = 0) {
  return {
    value: initialValue,
    rawValue: initialValue,
    active: false,
    phase: 'idle',
    candidateMs: 0,
    releaseMs: 0,
    holdMs: 0,
    lastTimestamp: 0,
    lastInputTimestamp: 0,
  };
}

export function updateInteractionSignal(rawValue, timestamp, state, options = {}) {
  const {
    enterThreshold = 0.45,
    releaseThreshold = 0.28,
    activateMs = 110,
    releaseMs = 180,
    missingToleranceMs = 260,
    attackSeconds = 0.1,
    releaseSeconds = 0.2,
  } = options;

  const previousTimestamp = state.lastTimestamp || timestamp;
  const deltaMs = Math.min(100, Math.max(0, timestamp - previousTimestamp));
  const deltaSeconds = Math.max(0.016, deltaMs / 1000);
  const hasInput = Number.isFinite(rawValue);

  if (hasInput) {
    state.rawValue = clamp(rawValue, 0, 1);
    state.lastInputTimestamp = timestamp;
  }

  const inputAge = state.lastInputTimestamp ? timestamp - state.lastInputTimestamp : Infinity;
  const toleratedGap = !hasInput && inputAge <= missingToleranceMs;
  const target = hasInput || toleratedGap ? state.rawValue : 0;
  const timeConstant = target > state.value ? attackSeconds : releaseSeconds;
  const alpha = 1 - Math.exp(-deltaSeconds / Math.max(0.016, timeConstant));
  state.value += (target - state.value) * alpha;

  let justActivated = false;
  let justReleased = false;

  if (!state.active) {
    if (state.value >= enterThreshold) {
      state.candidateMs += deltaMs;
      state.phase = 'detecting';
      if (state.candidateMs >= activateMs) {
        state.active = true;
        state.phase = 'active';
        state.holdMs = 0;
        state.releaseMs = 0;
        justActivated = true;
      }
    } else {
      state.candidateMs = Math.max(0, state.candidateMs - deltaMs * 1.5);
      state.phase = inputAge > missingToleranceMs ? 'tracking-lost' : 'idle';
    }
  } else if (state.value <= releaseThreshold && !toleratedGap) {
    state.releaseMs += deltaMs;
    state.phase = 'releasing';
    if (state.releaseMs >= releaseMs) {
      state.active = false;
      state.phase = inputAge > missingToleranceMs ? 'tracking-lost' : 'recovering';
      state.candidateMs = 0;
      state.releaseMs = 0;
      justReleased = true;
    }
  } else {
    state.releaseMs = 0;
    state.holdMs += deltaMs;
    state.phase = state.holdMs >= 500 ? 'holding' : 'active';
  }

  state.lastTimestamp = timestamp;

  return {
    value: clamp(state.value, 0, 1),
    active: state.active,
    phase: state.phase,
    holdSeconds: state.holdMs / 1000,
    deltaSeconds,
    justActivated,
    justReleased,
    trackingLost: inputAge > missingToleranceMs,
  };
}

export function consumeTimedEvents(progressState, key, ratePerSecond, deltaSeconds) {
  const accumulatorKey = `${key}Accumulator`;
  const nextAccumulator = (progressState[accumulatorKey] || 0) + Math.max(0, ratePerSecond) * deltaSeconds;
  const eventCount = Math.floor(nextAccumulator);
  progressState[accumulatorKey] = nextAccumulator - eventCount;
  return eventCount;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
