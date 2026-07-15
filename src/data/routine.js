export const routineStages = [
  {
    id: 'eye',
    title: 'Eye Relax',
    zhTitle: '眼周放鬆',
    task: '用指尖從眼下內側，輕輕滑向外側。',
    metricLabel: 'Eye Relax',
    accent: '#76b7c6',
    area: 'eyes',
    prompts: ['Great, slow and gentle.', 'Try moving a little slower.', '眼周放鬆完成度穩定上升'],
  },
  {
    id: 'jaw',
    title: 'Jaw Release',
    zhTitle: '下顎放鬆',
    task: '沿著下顎線，從下巴往耳下方向輕輕滑動。',
    metricLabel: 'Jaw Release',
    accent: '#d9a66a',
    area: 'jaw',
    prompts: ['下顎區域已對齊', 'Nice flow.', 'Try relaxing your mouth slightly.'],
  },
  {
    id: 'smile',
    title: 'Smile Stretch',
    zhTitle: '嘴角伸展',
    task: '輕輕微笑，感受嘴角放鬆，不需要用力。',
    metricLabel: 'Smile Stretch',
    accent: '#e48aa1',
    area: 'mouth',
    prompts: ['Natural smile detected.', 'Smile stretch score is warming up.', '放鬆一點，不用太用力。'],
  },
  {
    id: 'funny',
    title: 'Funny Face Reset',
    zhTitle: '表情 Reset 小挑戰',
    task: '做一個最放鬆的鬼臉，釋放今天的臉部壓力。',
    metricLabel: 'Funny Reset',
    accent: '#8d9ce4',
    area: 'challenge',
    prompts: ['情緒釋放成功', '今日可愛表情解鎖', 'Face Reset completed!'],
  },
];

export const STAGE_SECONDS = 20;
