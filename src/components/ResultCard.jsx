import { useEffect, useState } from 'react';

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
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const snapshots = (result?.snapshots || []).slice(0, 5);
  const heroIndex = Math.max(0, Math.floor(snapshots.length / 2));
  const fallbackSnapshot = snapshots[heroIndex]?.image;
  const radar = normalizeRadar(result?.radar);

  useEffect(() => {
    if (!isPreviewing) return undefined;
    const timer = window.setTimeout(() => setIsPreviewing(false), 2800);
    return () => window.clearTimeout(timer);
  }, [isPreviewing, previewKey]);

  const playPreview = () => {
    if (!snapshots.length) return;
    setPreviewKey((current) => current + 1);
    setIsPreviewing(true);
  };

  return (
    <div className="result-share-card vibe-card result-vibe-card" id="result-card">
      <div className="vibe-radar-stage">
        <RadarGraphic metrics={radar} />
        <button
          className={`vibe-face-reel ${isPreviewing ? 'playing' : ''}`}
          type="button"
          onClick={playPreview}
          aria-label="Preview captured Face Reset expressions"
        >
          {snapshots.length ? (
            snapshots.map((snapshot, index) => (
              <img
                className={index === heroIndex ? 'is-hero' : ''}
                alt={`Face Reset expression ${index + 1}`}
                key={`${previewKey}-${snapshot.id || index}`}
                src={snapshot.image}
                style={{ '--index': index }}
              />
            ))
          ) : (
            <div className="vibe-face-placeholder">
              <span>Face Reset</span>
            </div>
          )}
          <span className={`vibe-play-button ${isPreviewing ? 'playing' : ''}`} aria-hidden="true" />
        </button>
        {fallbackSnapshot && <img className="vibe-hidden-fallback" alt="" src={fallbackSnapshot} />}
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
