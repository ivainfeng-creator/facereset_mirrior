import { routineStages } from '../data/routine.js';
import { SCENE_IDS } from '../data/scenes.js';
import { clampSceneScore, toFinalSceneScore } from './scoring.js';

const RADAR_SCORE_MAX = 100;

export function getAlignmentStatus(elapsedMs) {
  if (elapsedMs < 900) return { label: 'Center your face', quality: 36 };
  if (elapsedMs < 1800) return { label: 'Move closer', quality: 58 };
  if (elapsedMs < 2800) return { label: 'Hold still', quality: 78 };
  return { label: 'Face detected. Let’s begin your reset.', quality: 96 };
}

export function getRoutineFeedback(stageIndex, stageProgress, globalProgress) {
  const stage = routineStages[stageIndex] || routineStages[0];
  const promptIndex = Math.min(
    stage.prompts.length - 1,
    Math.floor(stageProgress * stage.prompts.length),
  );
  const wave = Math.sin(globalProgress * Math.PI * 5) * 4;
  const score = Math.round(64 + globalProgress * 27 + wave);
  const localScore = Math.round(68 + stageProgress * 22 + Math.sin(stageProgress * Math.PI * 2) * 4);

  return {
    score: Math.min(96, Math.max(62, score)),
    localScore: Math.min(98, Math.max(60, localScore)),
    label: stage.prompts[promptIndex],
    faceQuality: Math.round(72 + Math.sin(globalProgress * Math.PI * 3) * 10),
  };
}

export function buildResult(stageScores, snapshots = [], sceneId = SCENE_IDS.templeGarden, date = null) {
  const rawSceneScore = stageScores[sceneId] ?? stageScores.temple ?? stageScores.whale ?? stageScores.eye ?? 820;
  const score = toFinalSceneScore(rawSceneScore);
  const radarScore = normalizeScoreForRadar(score);
  const softVariance = Math.round(Math.sin(radarScore * 0.17) * 5);
  const radar = getSceneRadar(sceneId, radarScore, softVariance);

  return {
    score,
    sceneId,
    metrics: {
      [sceneId]: score,
    },
    radar,
    snapshots,
    date,
    comment: getSceneComment(sceneId),
  };
}

function getSceneRadar(sceneId, score, softVariance) {
  if (sceneId === SCENE_IDS.lemonSqueeze) {
    return [
      { label: '檸檬同步', value: clamp(score + 5, 52, 99) },
      { label: '氣泡咕嚕', value: clamp(score + 9 - softVariance, 50, 99) },
      { label: '鼻樑節奏', value: clamp(score + softVariance, 46, 98) },
      { label: '清爽療癒', value: clamp(82 + softVariance * 2, 48, 98) },
      { label: '偷喝彩蛋', value: clamp(84 + Math.round(Math.cos(score * 0.1) * 8), 50, 99) },
      { label: 'Combo 感', value: clamp(78 + Math.round(Math.sin(score * 0.13) * 10), 45, 98) },
    ];
  }

  if (sceneId === SCENE_IDS.bubbleGumBunny) {
    return [
      { label: '泡泡膨脹', value: clamp(score + 6, 52, 99) },
      { label: '鼓臉穩定', value: clamp(score + softVariance, 46, 98) },
      { label: '兔耳節奏', value: clamp(score + 8 - softVariance, 50, 99) },
      { label: '粉紅療癒', value: clamp(82 + softVariance * 2, 48, 98) },
      { label: '可愛濃度', value: clamp(88 + Math.round(Math.cos(score * 0.09) * 6), 52, 99) },
      { label: 'Combo 感', value: clamp(78 + Math.round(Math.sin(score * 0.13) * 10), 45, 98) },
    ];
  }

  if (sceneId === SCENE_IDS.flowerCollector) {
    return [
      { label: '吸入力', value: clamp(score + 5, 52, 99) },
      { label: '爆米花收集', value: clamp(score + 9 - softVariance, 50, 99) },
      { label: '皺鼻節奏', value: clamp(score + softVariance, 46, 98) },
      { label: '電影夜氛圍', value: clamp(80 + softVariance * 2, 48, 98) },
      { label: '可愛濃度', value: clamp(86 + Math.round(Math.cos(score * 0.09) * 6), 52, 99) },
      { label: '放鬆回彈', value: clamp(88 - Math.abs(82 - score), 45, 98) },
    ];
  }

  if (sceneId === SCENE_IDS.whaleDream || sceneId === SCENE_IDS.whaleDream2) {
    return [
      { label: sceneId === SCENE_IDS.whaleDream2 ? '河豚呼吸' : '鯨魚張嘴', value: clamp(score + 4, 54, 98) },
      { label: '小魚入口', value: clamp(score + 8 - softVariance, 52, 99) },
      { label: '張嘴穩定', value: clamp(score + softVariance, 48, 98) },
      { label: '海流順暢', value: clamp(82 + softVariance * 2, 46, 98) },
      { label: '好玩程度', value: clamp(84 + Math.round(Math.cos(score * 0.11) * 7), 50, 99) },
      { label: '慢慢放鬆', value: clamp(88 - Math.abs(84 - score), 45, 98) },
    ];
  }

  return [
    { label: '花園呼吸', value: clamp(score + 4, 54, 98) },
    { label: '雙側平衡', value: clamp(score + softVariance, 48, 98) },
    { label: '雲朵雨量', value: clamp(score + 8 - softVariance, 52, 99) },
    { label: '療癒電波', value: clamp(76 + softVariance * 2, 46, 96) },
    { label: '好玩程度', value: clamp(82 + Math.round(Math.cos(score * 0.11) * 7), 50, 99) },
    { label: '慢慢放鬆', value: clamp(88 - Math.abs(84 - score), 45, 98) },
  ];
}

function normalizeScoreForRadar(score) {
  return clampSceneScore(Math.min(score, RADAR_SCORE_MAX));
}

function getSceneComment(sceneId) {
  if (sceneId === SCENE_IDS.lemonSqueeze) {
    return '今天的 Lemon Squeeze 完成！雙側擠壓很同步，Lemon Soda 咕嚕咕嚕冒泡，還被小角色偷喝了一口。';
  }
  if (sceneId === SCENE_IDS.bubbleGumBunny) {
    return '今天的 Bubble Gum Bunny 完成！鼓臉節奏很穩，粉紅泡泡也越吹越可愛。';
  }
  if (sceneId === SCENE_IDS.flowerCollector) {
    return '今天的 Popcorn Collector 完成！鼻子輕輕一皺，爆米花都被吸進來了。';
  }
  if (sceneId === SCENE_IDS.whaleDream) {
    return '今天的 Whale Mouth 完成！張嘴節奏很穩，小魚順著海流游進鯨魚嘴裡。';
  }
  if (sceneId === SCENE_IDS.whaleDream2) {
    return '今天的 Whale Dream 2 完成！張嘴節奏很穩，河豚夢境也被你慢慢喚醒了。';
  }
  return '今天的 Cloud Garden 完成！雙手輕按太陽穴，雲朵有下雨，花園也慢慢醒來了。';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
