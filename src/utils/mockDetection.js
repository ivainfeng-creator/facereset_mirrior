import { routineStages } from '../data/routine.js';
import { SCENE_IDS } from '../data/scenes.js';

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

export function buildResult(stageScores, snapshots = [], sceneId = SCENE_IDS.templeGarden) {
  const sceneScore = stageScores[sceneId] ?? stageScores.temple ?? stageScores.whale ?? stageScores.eye ?? 82;
  const score = Math.round(sceneScore);
  const softVariance = Math.round(Math.sin(score * 0.17) * 5);
  const radar = getSceneRadar(sceneId, score, softVariance);

  return {
    score,
    sceneId,
    metrics: {
      [sceneId]: score,
    },
    radar,
    snapshots,
    comment: getSceneComment(sceneId),
  };
}

function getSceneRadar(sceneId, score, softVariance) {
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
      { label: '吸香力', value: clamp(score + 5, 52, 99) },
      { label: '花朵收集', value: clamp(score + 9 - softVariance, 50, 99) },
      { label: '皺鼻節奏', value: clamp(score + softVariance, 46, 98) },
      { label: '療癒香氣', value: clamp(80 + softVariance * 2, 48, 98) },
      { label: '可愛濃度', value: clamp(86 + Math.round(Math.cos(score * 0.09) * 6), 52, 99) },
      { label: '放鬆回彈', value: clamp(88 - Math.abs(82 - score), 45, 98) },
    ];
  }

  if (sceneId === SCENE_IDS.whaleDream) {
    return [
      { label: '鯨魚呼吸', value: clamp(score + 4, 54, 98) },
      { label: '小魚流量', value: clamp(score + 8 - softVariance, 52, 99) },
      { label: '張嘴穩定', value: clamp(score + softVariance, 48, 98) },
      { label: '夢境感', value: clamp(82 + softVariance * 2, 46, 98) },
      { label: '好玩程度', value: clamp(84 + Math.round(Math.cos(score * 0.11) * 7), 50, 99) },
      { label: '慢慢放鬆', value: clamp(88 - Math.abs(84 - score), 45, 98) },
    ];
  }

  if (sceneId === SCENE_IDS.rainWiper) {
    return [
      { label: '眼下滑順', value: clamp(score + 4, 54, 98) },
      { label: '雨刷節奏', value: clamp(score + softVariance, 48, 98) },
      { label: '玻璃清晰', value: clamp(score + 8 - softVariance, 52, 99) },
      { label: '療癒電波', value: clamp(76 + softVariance * 2, 46, 96) },
      { label: '好玩程度', value: clamp(82 + Math.round(Math.cos(score * 0.11) * 7), 50, 99) },
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

function getSceneComment(sceneId) {
  if (sceneId === SCENE_IDS.bubbleGumBunny) {
    return '今天的 Bubble Gum Bunny 完成！鼓臉節奏很穩，粉紅泡泡也越吹越可愛。';
  }
  if (sceneId === SCENE_IDS.flowerCollector) {
    return '今天的 Flower Collector 完成！鼻子輕輕一皺，花朵都被香氣吸進來了。';
  }
  if (sceneId === SCENE_IDS.whaleDream) {
    return '今天的 Whale Dream 完成！張嘴呼吸很穩，小魚也漂得很夢幻。';
  }
  if (sceneId === SCENE_IDS.rainWiper) {
    return '今天的 Rain Wiper 完成！眼下慢慢滑過，玻璃也被刷得更清楚了。';
  }
  return '今天的 Cloud Garden 完成！雙手輕按太陽穴，雲朵有下雨，花園也慢慢醒來了。';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
