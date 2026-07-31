import { routineStages } from '../data/routine.js';

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

export function buildResult(stageScores, snapshots = []) {
  const temple = stageScores.temple ?? stageScores.whale ?? stageScores.eye ?? 82;
  const score = Math.round(temple);
  const softVariance = Math.round(Math.sin(score * 0.17) * 5);
  const radar = [
    { label: '花園呼吸', value: clamp(score + 4, 54, 98) },
    { label: '雙側平衡', value: clamp(temple + softVariance, 48, 98) },
    { label: '雲朵雨量', value: clamp(score + 8 - softVariance, 52, 99) },
    { label: '療癒電波', value: clamp(76 + softVariance * 2, 46, 96) },
    { label: '好玩程度', value: clamp(82 + Math.round(Math.cos(score * 0.11) * 7), 50, 99) },
    { label: '慢慢放鬆', value: clamp(88 - Math.abs(84 - score), 45, 98) },
  ];

  return {
    score,
    metrics: {
      temple,
    },
    radar,
    snapshots,
    comment: '今天的 Cloud Garden 完成！雙手輕按太陽穴，雲朵有下雨，花園也慢慢醒來了。',
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
