import { SCENE_IDS } from './scenes.js';

export const PRESS_SIGNAL_TUNING = {
  enterThreshold: 0.46,
  releaseThreshold: 0.25,
  activateMs: 110,
  releaseMs: 210,
  missingToleranceMs: 280,
  attackSeconds: 0.1,
  releaseSeconds: 0.24,
};

export const sceneInteractionTuning = {
  [SCENE_IDS.whaleDream]: {
    actionType: 'mouth_open',
    feedbackInitial: 'Open wide and guide little fish in',
    input: {
      baseline: 0.07,
      range: 0.22,
      wideThreshold: 0.8,
    },
    signal: {
      enterThreshold: 0.42,
      releaseThreshold: 0.3,
      activateMs: 90,
      releaseMs: 190,
      attackSeconds: 0.09,
      releaseSeconds: 0.22,
    },
    scoring: {
      flowBase: 0.24,
      flowByValue: 0.3,
      decay: 1.45,
      minimumFlow: 0,
      holdBase: 10,
      holdByValue: 18,
      stableHoldBonus: 1.5,
      eventBase: 1.2,
      eventByValue: 3,
      stableEventBonus: 0.75,
      fishScore: 0.5,
      specialEvery: 18,
      specialScore: 2,
      completionModulo: 30,
    },
  },
  [SCENE_IDS.whaleDream2]: {
    actionType: 'mouth_open',
    feedbackInitial: 'Open wide and wake the pufferfish dream',
    input: {
      baseline: 0.07,
      range: 0.22,
      wideThreshold: 0.65,
    },
    signal: {
      enterThreshold: 0.36,
      releaseThreshold: 0.2,
      activateMs: 90,
      releaseMs: 190,
      attackSeconds: 0.09,
      releaseSeconds: 0.22,
    },
    scoring: {
      flowBase: 0.13,
      flowByValue: 0.18,
      decay: 0.1,
      minimumFlow: 0.08,
      eventBase: 1,
      eventByValue: 2.4,
      stableEventBonus: 0.5,
      releaseHoldSeconds: 0.45,
      longHoldSeconds: 1.2,
      releaseScore: 2,
      longHoldScore: 5,
      specialEvery: 25,
      specialScore: 4,
      completionModulo: 18,
    },
  },
  [SCENE_IDS.templeGarden]: {
    actionType: 'dual_press',
    feedbackInitial: 'Press both temples gently',
    signal: {
      enterThreshold: 0.34,
      releaseThreshold: 0.16,
      activateMs: 90,
      releaseMs: 380,
      missingToleranceMs: 460,
      attackSeconds: 0.12,
      releaseSeconds: 0.32,
    },
    scoring: {
      oneSideHintThreshold: 0.3,
      balanceHintThreshold: 0.58,
      syncBonusThreshold: 0.72,
      flowBase: 0.15,
      flowByBalance: 0.18,
      decay: 0.13,
      minimumFlow: 0,
      holdBase: 18,
      holdByQuality: 14,
      nourishmentRate: 1 / 1.8,
      nourishmentBonus: 2,
      stableNourishmentBonus: 4,
      growthBase: 0.023,
      growthByFlow: 0.017,
    },
  },
  [SCENE_IDS.flowerCollector]: {
    actionType: 'nose_sniff',
    feedbackInitial: 'Scrunch your nose to gather popcorn',
    input: {
      minimumBlendshapeSignal: 0.03,
      baseline: 0.04,
      range: 0.18,
      strongThreshold: 0.55,
    },
    signal: {
      enterThreshold: 0.22,
      releaseThreshold: 0.08,
      activateMs: 90,
      releaseMs: 160,
      missingToleranceMs: 140,
      attackSeconds: 0.09,
      releaseSeconds: 0.16,
    },
    scoring: {
      flowBase: 0.16,
      flowByValue: 0.18,
      decay: 0.19,
      minimumFlow: 0.08,
      eventBase: 10,
      eventByValue: 5,
      strongEventBonus: 0.7,
      releaseHoldSeconds: 0.55,
      releaseScore: 1,
      comboReleaseScore: 3,
      specialEvery: 25,
      specialScore: 3,
      completionModulo: 24,
    },
  },
  [SCENE_IDS.bubbleGumBunny]: {
    actionType: 'cheek_puff',
    feedbackInitial: 'Puff your cheeks to grow the bubble',
    input: {
      baseline: 0.12,
      range: 0.6,
    },
    signal: {
      enterThreshold: 0.32,
      releaseThreshold: 0.2,
      activateMs: 130,
      releaseMs: 220,
      attackSeconds: 0.13,
      releaseSeconds: 0.28,
    },
    scoring: {
      growthBase: 0.07,
      growthByValue: 0.12,
      decay: 0.045,
      minBubbleSize: 0.06,
      maxBubbleSize: 1,
      holdBonusSeconds: 1.1,
      holdEventRate: 0.55,
      holdEventScore: 3,
      stageMultiplier: 4.2,
      stageScore: 4,
      popThreshold: 0.985,
      popHoldSeconds: 0.8,
      resetSize: 0.07,
      resetStage: 0,
      popScore: 10,
      comboBonusScore: 4,
      releaseHoldSeconds: 0.6,
      longHoldSeconds: 1.8,
      releaseScore: 5,
      longHoldBonusScore: 3,
    },
  },
  [SCENE_IDS.lemonSqueeze]: {
    actionType: 'dual_press',
    feedbackInitial: 'Press both sides of your nose',
    signal: PRESS_SIGNAL_TUNING,
    scoring: {
      oneSideHintThreshold: 0.28,
      balanceHintThreshold: 0.54,
      syncBonusThreshold: 0.72,
      completedHoldSeconds: 0.3,
      sodaBase: 0.03,
      sodaBySqueeze: 0.03,
      sodaByBalance: 0.02,
      minSodaLevel: 0.06,
      maxSodaLevel: 0.94,
      ingredientOffset: 0.03,
      ingredientMultiplier: 2,
      ingredientScore: 2,
      releaseScore: 3,
      syncBonusScore: 3,
      sipSeconds: 2.95,
      sipScore: 13,
      sipDropBase: 0.2,
      sipDropStep: 0.1,
      sipMinAfterDrop: 0.32,
      sipMaxAfterDrop: 0.63,
      sipBaseLevel: 0.8,
      sipLevelStep: 0.035,
      sipHintLevel: 0.8,
    },
  },
};

export const SCENE_TUNING_STORAGE_KEY = 'face-reset.scene-tuning.v1';

export function getSceneTuning(sceneId) {
  const baseTuning = sceneInteractionTuning[sceneId] || sceneInteractionTuning[SCENE_IDS.whaleDream];
  return mergeTuning(baseTuning, loadSceneTuningOverrides(sceneId));
}

export function loadSceneTuningOverrides(sceneId) {
  if (!canUseLocalStorage()) return {};

  try {
    const saved = window.localStorage.getItem(SCENE_TUNING_STORAGE_KEY);
    if (!saved) return {};
    return JSON.parse(saved)?.[sceneId] || {};
  } catch {
    return {};
  }
}

export function saveSceneTuningValue(sceneId, section, key, value) {
  if (!canUseLocalStorage()) return {};

  const baseValue = sceneInteractionTuning[sceneId]?.[section]?.[key];
  const allOverrides = loadAllSceneTuningOverrides();
  const sceneOverrides = allOverrides[sceneId] || {};
  const sectionOverrides = sceneOverrides[section] || {};

  if (value === baseValue) {
    delete sectionOverrides[key];
  } else {
    sectionOverrides[key] = value;
  }

  if (Object.keys(sectionOverrides).length) {
    sceneOverrides[section] = sectionOverrides;
  } else {
    delete sceneOverrides[section];
  }

  if (Object.keys(sceneOverrides).length) {
    allOverrides[sceneId] = sceneOverrides;
  } else {
    delete allOverrides[sceneId];
  }

  window.localStorage.setItem(SCENE_TUNING_STORAGE_KEY, JSON.stringify(allOverrides));
  return allOverrides[sceneId] || {};
}

export function clearSceneTuningOverrides(sceneId) {
  if (!canUseLocalStorage()) return;

  const allOverrides = loadAllSceneTuningOverrides();
  delete allOverrides[sceneId];
  window.localStorage.setItem(SCENE_TUNING_STORAGE_KEY, JSON.stringify(allOverrides));
}

export function getSceneTuningExport(sceneId) {
  const tuning = getSceneTuning(sceneId);
  return JSON.stringify(tuning, null, 2);
}

function loadAllSceneTuningOverrides() {
  try {
    const saved = window.localStorage.getItem(SCENE_TUNING_STORAGE_KEY);
    return saved ? JSON.parse(saved) || {} : {};
  } catch {
    return {};
  }
}

function mergeTuning(baseTuning, overrides) {
  if (!overrides || !Object.keys(overrides).length) return baseTuning;

  return {
    ...baseTuning,
    input: {
      ...baseTuning.input,
      ...overrides.input,
    },
    signal: {
      ...baseTuning.signal,
      ...overrides.signal,
    },
    scoring: {
      ...baseTuning.scoring,
      ...overrides.scoring,
    },
  };
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}
