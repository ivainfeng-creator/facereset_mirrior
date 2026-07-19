export default function ResultCard({ result, habit }) {
  const metrics = [
    ['Eye Relax', result?.metrics?.eye ?? 82],
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
        {result?.comment || '今天的眼周放鬆完成！慢慢滑、輕輕做，比追求完美更重要。'}
      </p>
    </div>
  );
}
