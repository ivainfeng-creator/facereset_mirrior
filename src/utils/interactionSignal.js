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

export const INTERACTION_ACTIONS = {
  mouthOpen: 'mouth_open',
  noseSniff: 'nose_sniff',
  cheekPuff: 'cheek_puff',
  dualPress: 'dual_press',
};

export function createSceneInteractionContract({
  sceneId,
  interaction = {},
  tracking = {},
  features = null,
  fingertips = {},
}) {
  const actionType = getActionType(sceneId);
  const controls = getControlsForAction(actionType, interaction);
  const primaryValue = getPrimaryValue(actionType, controls);
  const isActive = getPrimaryActive(actionType, interaction, primaryValue);
  const phase = interaction.phase || (isActive ? 'active' : 'idle');
  const requiresHands = actionType === INTERACTION_ACTIONS.dualPress;
  const leftHandReady = Boolean(fingertips?.left);
  const rightHandReady = Boolean(fingertips?.right);
  const handReady = requiresHands ? leftHandReady && rightHandReady : true;

  return {
    version: 1,
    sceneId,
    actionType,
    tracking: {
      faceReady: Boolean(tracking.hasLandmarks || features),
      handReady,
      requiresHands,
      detectorMode: tracking.detectorMode || 'unknown',
      handMode: tracking.handMode || 'unknown',
      isDemoMode: Boolean(tracking.isDemoMode),
      quality: Boolean(tracking.hasLandmarks || features) ? 1 : 0,
    },
    controls,
    primary: {
      value: primaryValue,
      active: isActive,
      phase,
      holdSeconds: Number(interaction.holdSeconds || 0),
      justActivated: Boolean(interaction.justActivated),
      justReleased: Boolean(interaction.justReleased),
      stable: phase === 'holding' || Boolean(interaction.isOnTrack),
    },
    game: {
      score: Math.round(interaction.score || 0),
      combo: interaction.combo || 0,
      completion: clamp(interaction.completion || 0, 0, 1),
      eventCount: getEventCountForAction(actionType, interaction),
    },
    feedback: {
      text: interaction.feedback || '',
      level: getFeedbackLevel({ interaction, isActive, phase }),
    },
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getActionType(sceneId) {
  const actionByInteraction = {
    mouthOpening: INTERACTION_ACTIONS.mouthOpen,
    noseSniff: INTERACTION_ACTIONS.noseSniff,
    cheekPuff: INTERACTION_ACTIONS.cheekPuff,
    templePress: INTERACTION_ACTIONS.dualPress,
    lemonSqueeze: INTERACTION_ACTIONS.dualPress,
  };
  return actionByInteraction[getSceneById(sceneId).interaction] || INTERACTION_ACTIONS.mouthOpen;
}

function getControlsForAction(actionType, interaction) {
  const base = {
    mouthOpen: clamp(interaction.mouthOpen || 0, 0, 1),
    noseWrinkle: clamp(interaction.sniff || 0, 0, 1),
    cheekPuff: clamp(interaction.puff || 0, 0, 1),
    leftPress: clamp(interaction.leftPress || 0, 0, 1),
    rightPress: clamp(interaction.rightPress || 0, 0, 1),
    sync: clamp(interaction.sync || 0, 0, 1),
  };

  if (actionType === INTERACTION_ACTIONS.dualPress) {
    return {
      ...base,
      sync: base.sync || 1 - Math.min(1, Math.abs(base.leftPress - base.rightPress)),
    };
  }

  return base;
}

function getPrimaryValue(actionType, controls) {
  if (actionType === INTERACTION_ACTIONS.noseSniff) return controls.noseWrinkle;
  if (actionType === INTERACTION_ACTIONS.cheekPuff) return controls.cheekPuff;
  if (actionType === INTERACTION_ACTIONS.dualPress) {
    return clamp((controls.leftPress + controls.rightPress) / 2, 0, 1);
  }
  return controls.mouthOpen;
}

function getPrimaryActive(actionType, interaction, primaryValue) {
  if (actionType === INTERACTION_ACTIONS.noseSniff) return Boolean(interaction.isSniffing);
  if (actionType === INTERACTION_ACTIONS.cheekPuff) return Boolean(interaction.isPuffing);
  if (actionType === INTERACTION_ACTIONS.dualPress) {
    return Boolean(interaction.isPressing || interaction.isSqueezing || primaryValue > 0.55);
  }
  return Boolean(interaction.isOpen);
}

function getEventCountForAction(actionType, interaction) {
  if (actionType === INTERACTION_ACTIONS.noseSniff) return interaction.flowerCount || 0;
  if (actionType === INTERACTION_ACTIONS.mouthOpen) return interaction.fishCount || 0;
  if (actionType === INTERACTION_ACTIONS.cheekPuff) return interaction.bubbleStage || 0;
  return interaction.combo || 0;
}

function getFeedbackLevel({ interaction, isActive, phase }) {
  if (phase === 'tracking-lost') return 'warning';
  if (interaction.isOnTrack || phase === 'holding') return 'success';
  if (isActive || phase === 'detecting' || phase === 'active') return 'active';
  return 'idle';
}
import { getSceneById } from '../data/scenes.js';
