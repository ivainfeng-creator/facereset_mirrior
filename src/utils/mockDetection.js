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

export function buildResult(stageScores) {
  const eye = stageScores.eye ?? 82;
  const score = Math.round(eye);

  return {
    score,
    metrics: {
      eye,
    },
    comment: '今天的眼周放鬆完成！慢慢滑、輕輕做，比追求完美更重要。',
  };
}
