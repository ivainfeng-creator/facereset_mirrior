export default function ResultCard({ result, habit }) {
  const metrics = [
    ['Eye Relax', result?.metrics?.eye ?? 82],
    ['Jaw Release', result?.metrics?.jaw ?? 91],
    ['Smile Stretch', result?.metrics?.smile ?? 76],
  ];

  return (
    <div className="result-card" id="result-card">
      <p className="eyebrow">Face Reset completed</p>
      <h1>今日 Face Reset 分數：{result?.score ?? 88}</h1>
      <div className="result-score-ring">
        <span>{result?.score ?? 88}</span>
      </div>
      <div className="result-metrics">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}%</strong>
          </div>
        ))}
      </div>
      <div className="streak-banner">Streak: Day {result?.streak || habit?.streak || 1}</div>
      <p className="ai-comment">
        {result?.comment || '今天的臉部放鬆完成！記得慢慢來，比做得完美更重要。'}
      </p>
    </div>
  );
}
