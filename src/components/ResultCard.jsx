const defaultRadar = [
  { label: 'flowy', value: 84 },
  { label: 'clear', value: 78 },
  { label: 'glowy', value: 88 },
  { label: 'soft', value: 81 },
  { label: 'playful', value: 90 },
];

const labelMap = {
  放鬆雲量: 'flowy',
  雨刷節奏: 'rhythm',
  眼下亮度: 'glowy',
  療癒電波: 'soft',
  好玩程度: 'playful',
  慢慢來力: 'slow',
};

export default function ResultCard({ result, habit }) {
  const snapshots = (result?.snapshots || []).slice(0, 5);
  const fallbackSnapshot = snapshots[Math.floor(snapshots.length / 2)]?.image;
  const radar = normalizeRadar(result?.radar);

  return (
    <div className="result-share-card vibe-card" id="result-card">
      <div className="vibe-header">
        <p className="eyebrow">Face Reset completed</p>
        <h1>what’s your reset vibe?</h1>
        <p>pause and see which face reset mood matches your energy.</p>
      </div>

      <div className="vibe-radar-stage">
        <RadarGraphic metrics={radar} />
        <div className="vibe-face-reel" aria-label="Captured Face Reset expressions">
          {snapshots.length ? (
            snapshots.map((snapshot, index) => (
              <img
                alt={`Face Reset expression ${index + 1}`}
                key={snapshot.id || index}
                src={snapshot.image}
                style={{ '--index': index }}
              />
            ))
          ) : (
            <div className="vibe-face-placeholder">
              <span>Face Reset</span>
            </div>
          )}
          <span className="vibe-play-button" aria-hidden="true" />
        </div>
        {fallbackSnapshot && <img className="vibe-hidden-fallback" alt="" src={fallbackSnapshot} />}
      </div>

      <div className="vibe-footer">
        <div>
          <span>Score</span>
          <strong>{result?.score ?? 88}</strong>
        </div>
        <div>
          <span>Streak</span>
          <strong>Day {result?.streak || habit?.streak || 1}</strong>
        </div>
        <p>{result?.comment || '今天的眼下雨刷完成！慢慢刷、輕輕滑，臉上的雲有被擦亮一點。'}</p>
      </div>
    </div>
  );
}

function RadarGraphic({ metrics }) {
  const center = 180;
  const radius = 132;
  const points = metrics.map((metric, index) => {
    const angle = -Math.PI / 2 + (index / metrics.length) * Math.PI * 2;
    const valueRadius = radius * ((metric.value || 0) / 100);
    return {
      ...metric,
      x: center + Math.cos(angle) * valueRadius,
      y: center + Math.sin(angle) * valueRadius,
      axisX: center + Math.cos(angle) * radius,
      axisY: center + Math.sin(angle) * radius,
      labelX: center + Math.cos(angle) * (radius + 32),
      labelY: center + Math.sin(angle) * (radius + 32),
    };
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <svg className="vibe-radar" viewBox="0 0 360 360" role="img" aria-label="Face Reset vibe radar">
      {[0.34, 0.67, 1].map((level) => (
        <circle className="vibe-radar-ring" cx={center} cy={center} key={level} r={radius * level} />
      ))}
      {points.map((point) => (
        <line className="vibe-radar-axis" key={`axis-${point.label}`} x1={center} y1={center} x2={point.axisX} y2={point.axisY} />
      ))}
      <polygon className="vibe-radar-fill" points={polygon} />
      <polygon className="vibe-radar-stroke" points={polygon} />
      {points.map((point) => (
        <g key={point.label}>
          <circle className="vibe-radar-dot" cx={point.x} cy={point.y} r="4" />
          <text className="vibe-radar-label" x={point.labelX} y={point.labelY}>
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function normalizeRadar(radar) {
  const source = radar?.length ? radar : defaultRadar;
  return source.slice(0, 5).map((metric, index) => ({
    label: labelMap[metric.label] || metric.label || defaultRadar[index]?.label || `vibe ${index + 1}`,
    value: metric.value ?? defaultRadar[index]?.value ?? 80,
  }));
}
