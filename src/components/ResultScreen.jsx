import { useMemo, useState } from 'react';
import { getSceneById } from '../data/scenes.js';

const MAX_RESULT_SCORE = 1000;

const SEEDED_LEADERS = [
  { name: 'Mika T.', score: 970 },
  { name: 'Jonas R.', score: 950 },
  { name: 'Aiko S.', score: 930 },
  { name: 'Devon L.', score: 900 },
  { name: 'Priya N.', score: 860 },
  { name: 'Sora K.', score: 840 },
  { name: 'Bea M.', score: 820 },
  { name: 'Tomas V.', score: 790 },
  { name: 'Lena H.', score: 770 },
  { name: 'Ravi P.', score: 740 },
];

export default function ResultScreen({ result, habit, onRestart, onTodayPlan, onLeaderboard }) {
  const [exportMessage, setExportMessage] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [leaderboardName, setLeaderboardName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [isNameModalDismissed, setIsNameModalDismissed] = useState(false);
  const score = result?.score ?? 880;
  const scene = getSceneById(result?.sceneId);
  const sceneTitle = result?.sceneTitle || scene.title;
  const focusLabel = result?.area || scene.area || 'Face Reset';
  const topPercent = getTopPercent(score);
  const holdSeconds = Math.max(1, Math.round(result?.holdSeconds || result?.durationSeconds || 52));
  const todayProgress = getTodayPlanProgress(habit, result);
  const leaderboard = useMemo(
    () => buildLeaderboardRows(score, leaderboardName, sceneTitle),
    [leaderboardName, sceneTitle, score],
  );
  const userRow = leaderboard.find((row) => row.isUser);
  const isTopTen = (userRow?.rank || 99) <= 10;
  const showNameModal = isTopTen && !leaderboardName && !isNameModalDismissed;

  const downloadVideo = async () => {
    setIsExporting(true);
    setExportMessage('Creating your animated reset video...');
    try {
      const video = await createResultVideo({ result, habit });
      downloadBlob(video.blob, `face-reset-vibe.${video.extension}`);
      setExportMessage(`Downloaded ${video.extension.toUpperCase()} video.`);
    } catch {
      const image = await createResultImage({ result, habit });
      downloadBlob(image.blob, 'face-reset-vibe.png');
      setExportMessage('Video export was not supported here, so a PNG was downloaded.');
    } finally {
      setIsExporting(false);
    }
  };

  const shareVideo = async () => {
    setIsExporting(true);
    setExportMessage('Preparing video for Photos or Instagram...');
    try {
      const video = await createResultVideo({ result, habit });
      const file = new File([video.blob], `face-reset-vibe.${video.extension}`, { type: video.mimeType });

      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: 'Face Reset Mirror',
          text: 'My Face Reset vibe today.',
        });
        setExportMessage('Share sheet opened. On iPhone, choose Save Video or Instagram if available.');
      } else {
        downloadBlob(video.blob, `face-reset-vibe.${video.extension}`);
        setExportMessage('This browser cannot save to Photos directly. Video downloaded for manual upload.');
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        setExportMessage('Share cancelled.');
      } else {
        setExportMessage('Sharing was not available here. Try downloading the video instead.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const submitLeaderboardName = (event) => {
    event.preventDefault();
    const trimmedName = nameDraft.trim();
    if (!trimmedName) return;
    setLeaderboardName(trimmedName.slice(0, 18));
    setIsNameModalDismissed(true);
  };

  return (
    <section className="screen result-screen reset-result-screen result-dashboard-screen">
      <main className="result-dashboard-shell" aria-label="Face Reset result">
        <header className="result-dashboard-header">
          <div>
            <p>TODAY'S FOCUS / {focusLabel.toUpperCase()}</p>
            <div className="result-title-row">
              <h1>{sceneTitle}</h1>
              <span className="result-header-progress" aria-label={`${todayProgress.completed} of ${todayProgress.total} completed`}>
                <i style={{ width: `${Math.max(8, (todayProgress.completed / todayProgress.total) * 100)}%` }} />
              </span>
              <strong>{todayProgress.completed} / {todayProgress.total}</strong>
            </div>
          </div>

          <div className="result-toolbar" aria-label="Result tools">
            <button onClick={downloadVideo} disabled={isExporting} type="button" aria-label="Download">
              <DownloadIcon />
            </button>
            <button onClick={shareVideo} disabled={isExporting} type="button" aria-label="Share">
              <ShareIcon />
            </button>
          </div>
        </header>

        <div className="result-dashboard-grid">
          <section className="result-left-column">
            <div className="result-stat-card">
              <div className="result-main-score">
                <strong>{score}</strong>
                <span>/1000</span>
              </div>
              <div className="result-stat-block">
                <span>RANKING</span>
                <strong>TOP {topPercent}%</strong>
              </div>
              <div className="result-stat-block">
                <span>HOLD TIME</span>
                <strong>{holdSeconds} SEC</strong>
              </div>
            </div>

            <ResultRadarPanel result={result} />
          </section>

          <aside className="result-right-column">
            <ResultLeaderboard rows={leaderboard} sceneTitle={sceneTitle} />

            <section className="result-plan-strip" aria-label="Today's plan">
              <div className="result-plan-strip-header">
                <span>TODAY'S PLAN</span>
                <strong>{Math.max(0, todayProgress.total - todayProgress.completed)} LEFT / NEXT: {sceneTitle.toUpperCase()}</strong>
              </div>
              <div className="result-plan-meter">
                <i style={{ width: `${Math.max(8, (todayProgress.completed / todayProgress.total) * 100)}%` }} />
              </div>
              <ol>
                {todayProgress.items.map((item, index) => (
                  <li className={index < todayProgress.completed ? 'is-done' : ''} key={item}>
                    <strong>{index + 1}</strong>
                    {item}
                  </li>
                ))}
              </ol>
            </section>

            <div className="result-dashboard-actions">
              <button type="button" onClick={onTodayPlan || onLeaderboard}>Today's plan</button>
              <button type="button" onClick={onRestart}>Try again</button>
            </div>
          </aside>
        </div>

        {exportMessage && <p className="export-message result-dashboard-message">{exportMessage}</p>}
      </main>

      {showNameModal && (
        <LeaderboardNameModal
          nameDraft={nameDraft}
          onChange={setNameDraft}
          onClose={() => setIsNameModalDismissed(true)}
          onSubmit={submitLeaderboardName}
        />
      )}
    </section>
  );
}

function ResultRadarPanel({ result }) {
  const afterMetrics = normalizeDownloadRadar(result?.radar).slice(0, 5);
  const beforeMetrics = afterMetrics.map((metric, index) => ({
    ...metric,
    value: Math.max(24, (metric.value || 0) - 13 - index),
  }));
  const afterPoints = getRadarPointString(afterMetrics);
  const beforePoints = getRadarPointString(beforeMetrics);

  return (
    <section className="result-radar-card" aria-label="Before and after radar">
      <div className="result-radar-topline">
        <span>BEFORE / AFTER</span>
        <div>
          <b className="before-key">BEFORE</b>
          <b className="after-key">AFTER</b>
        </div>
      </div>
      <div className="result-radar-stage">
        <svg viewBox="0 0 420 420" role="img" aria-label="Result radar chart">
          {[0.33, 0.66, 1].map((level) => (
            <circle className="result-radar-ring" cx="210" cy="210" r={150 * level} key={level} />
          ))}
          {afterMetrics.map((metric, index) => {
            const point = getRadarAxisPoint(index, afterMetrics.length, 174);
            return (
              <line
                className="result-radar-axis-line"
                x1="210"
                y1="210"
                x2={point.x}
                y2={point.y}
                key={metric.label}
              />
            );
          })}
          <polygon className="result-radar-before" points={beforePoints} />
          <polygon className="result-radar-after-fill" points={afterPoints} />
          <polygon className="result-radar-after-line" points={afterPoints} />
          {afterMetrics.map((metric, index) => {
            const valuePoint = getRadarValuePoint(metric.value, index, afterMetrics.length);
            const labelPoint = getRadarAxisPoint(index, afterMetrics.length, 188);
            return (
              <g key={`${metric.label}-label`}>
                <circle className="result-radar-node" cx={valuePoint.x} cy={valuePoint.y} r="8" />
                <text className="result-radar-label" x={labelPoint.x} y={labelPoint.y}>
                  {metric.label.toUpperCase()}
                </text>
                <text className="result-radar-delta" x={labelPoint.x} y={labelPoint.y + 20}>
                  +{Math.max(7, Math.round((metric.value - beforeMetrics[index].value) * 0.85))}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="result-radar-mascot" aria-hidden="true">
          <span className="mascot-eye left" />
          <span className="mascot-eye right" />
          <span className="mascot-mouth" />
        </div>
      </div>
    </section>
  );
}

function ResultLeaderboard({ rows, sceneTitle }) {
  return (
    <section className="result-leaderboard-card" aria-label="Today's leaderboard">
      <header>
        <span>TODAY'S LEADERBOARD</span>
        <strong>{sceneTitle}</strong>
      </header>
      <ol>
        {rows.slice(0, 10).map((row) => (
          <li className={row.isUser ? 'is-user' : ''} key={`${row.rank}-${row.name}`}>
            <span>{row.rank}</span>
            <i>{row.name.charAt(0).toUpperCase()}</i>
            <strong>{row.name}</strong>
            <b>{row.score}</b>
          </li>
        ))}
      </ol>
    </section>
  );
}

function LeaderboardNameModal({ nameDraft, onChange, onClose, onSubmit }) {
  return (
    <div className="leaderboard-name-backdrop" role="presentation">
      <form className="leaderboard-name-modal" onSubmit={onSubmit} aria-label="Join leaderboard">
        <button type="button" className="leaderboard-name-close" onClick={onClose} aria-label="Close">×</button>
        <h2>YOU'RE IN TOP 10!</h2>
        <p>Enter a display name to appear on leaderboard.</p>
        <input
          autoFocus
          type="text"
          value={nameDraft}
          maxLength={18}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter your name"
          aria-label="Display name"
        />
        <button type="submit" disabled={!nameDraft.trim()}>
          Join the Leaderboard
        </button>
      </form>
    </div>
  );
}

function RestartIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8 7H4v4" />
      <path d="M5 11a7 7 0 1 0 2-5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 4v10" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 20h14" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.6" />
      <path d="m8.2 13.2 7.6 4.6" />
    </svg>
  );
}

function buildLeaderboardRows(score, name, sceneTitle) {
  const rows = [
    ...SEEDED_LEADERS,
    {
      name: name || 'You',
      score,
      detail: sceneTitle,
      isUser: true,
    },
  ].sort((a, b) => b.score - a.score);

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

function getTodayPlanProgress(habit, result) {
  const today = new Date().toISOString().slice(0, 10);
  const completedSceneIds = new Set(
    (habit?.history || [])
      .filter((entry) => entry.date === today)
      .map((entry) => entry.sceneId)
      .filter(Boolean),
  );
  if (result?.sceneId) completedSceneIds.add(result.sceneId);

  const items = ['Whale Mouth', 'Cloud Garden', 'Flower Collector'];
  const completed = Math.min(items.length, Math.max(1, completedSceneIds.size || 1));

  return {
    completed,
    total: items.length,
    items,
  };
}

function getRadarPointString(metrics) {
  return metrics
    .map((metric, index) => {
      const point = getRadarValuePoint(metric.value, index, metrics.length);
      return `${point.x},${point.y}`;
    })
    .join(' ');
}

function getRadarValuePoint(value, index, total) {
  const safeValue = Math.max(0, Math.min(100, value || 0));
  return getRadarAxisPoint(index, total, 150 * (safeValue / 100));
}

function getRadarAxisPoint(index, total, radius) {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
  return {
    x: 210 + Math.cos(angle) * radius,
    y: 210 + Math.sin(angle) * radius,
  };
}

async function createResultImage({ result, habit }) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const width = 900;
  const height = 1200;
  const score = result?.score ?? 88;
  const snapshots = result?.snapshots || [];
  const radar = normalizeDownloadRadar(result?.radar);
  const images = await Promise.all(snapshots.slice(0, 5).map((snapshot) => loadImage(snapshot.image)));
  const hero = images[Math.floor(images.length / 2)];
  canvas.width = width;
  canvas.height = height;

  drawResultFrame(context, {
    habit,
    hero,
    progress: 1,
    radar,
    result,
    score,
    showPlay: true,
    width,
    height,
  });

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve({ blob, extension: 'png', mimeType: 'image/png' }), 'image/png');
  });
}

async function createResultVideo({ result, habit }) {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error('Video export is not supported in this browser.');
  }

  const width = 900;
  const height = 1200;
  const durationMs = 4200;
  const fps = 30;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const snapshots = result?.snapshots || [];
  const images = await Promise.all(snapshots.slice(0, 5).map((snapshot) => loadImage(snapshot.image)));
  const usableImages = images.filter(Boolean);
  const radar = normalizeDownloadRadar(result?.radar);
  const score = result?.score ?? 88;
  const mimeType = pickVideoMimeType();

  if (!mimeType) {
    throw new Error('No supported video mime type.');
  }

  canvas.width = width;
  canvas.height = height;

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 5_500_000,
  });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data);
  };

  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });
  recorder.start();

  await renderVideoFrames({
    context,
    durationMs,
    fps,
    frame: (progress) => {
      const image = usableImages.length
        ? usableImages[Math.floor(progress * durationMs / 480) % usableImages.length]
        : null;
      drawResultFrame(context, {
        habit,
        hero: image,
        progress,
        radar,
        result,
        score,
        showPlay: false,
        width,
        height,
      });
    },
  });

  recorder.stop();
  stream.getTracks().forEach((track) => track.stop());
  await stopped;

  return {
    blob: new Blob(chunks, { type: mimeType }),
    extension: mimeType.includes('mp4') ? 'mp4' : 'webm',
    mimeType,
  };
}

function drawResultFrame(context, { habit, hero, progress, radar, result, score, showPlay = false, width, height }) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);

  context.fillStyle = '#0f1111';
  context.textAlign = 'center';
  context.font = '900 58px Inter, sans-serif';
  context.fillText('Nice work', width / 2, 108);
  context.font = '600 28px Inter, sans-serif';
  context.fillText('Your expression looks softer and more relaxed.', width / 2, 154);

  drawRadar(context, radar, width / 2, 560, 330, progress);

  if (hero) {
    const pulse = 1 + Math.sin(progress * Math.PI * 10) * 0.018;
    const size = 284 * pulse;
    drawPortraitCutout(context, hero, width / 2 - size / 2, 560 - size / 2, size, size);
  } else {
    context.fillStyle = '#eef6f3';
    roundRect(context, width / 2 - 142, 418, 284, 284, 72);
    context.fill();
  }

  if (showPlay) {
    drawPlayButton(context, width / 2, 560, 84);
  }

  context.fillStyle = '#0f1111';
  context.textAlign = 'left';
  context.font = '900 42px Inter, sans-serif';
  context.fillText(`Score ${score}`, 76, 1040);
  context.font = '800 26px Inter, sans-serif';
  context.fillText(`Top ${getTopPercent(score)}%`, 76, 1080);

  context.fillStyle = '#515b59';
  context.font = '500 24px Inter, sans-serif';
  wrapText(
    context,
    result?.comment || '今天的眼下雨刷完成！慢慢刷、輕輕滑，臉上的雲有被擦亮一點。',
    76,
    1124,
    748,
    34,
  );
}

function getTopPercent(score) {
  const normalizedScore = getScorePercent(score);
  return Math.max(3, Math.min(18, Math.round(22 - normalizedScore * 0.14)));
}

function getScorePercent(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, (numeric / MAX_RESULT_SCORE) * 100));
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawPortraitCutout(context, image, x, y, width, height) {
  context.save();
  context.beginPath();
  context.moveTo(x + width * 0.5, y + height * 0.02);
  context.bezierCurveTo(x + width * 0.94, y + height * 0.02, x + width, y + height * 0.34, x + width * 0.86, y + height * 0.66);
  context.bezierCurveTo(x + width * 0.72, y + height, x + width * 0.18, y + height * 0.92, x + width * 0.08, y + height * 0.62);
  context.bezierCurveTo(x - width * 0.02, y + height * 0.32, x + width * 0.08, y + height * 0.02, x + width * 0.5, y + height * 0.02);
  context.closePath();
  context.clip();
  context.drawImage(image, x, y, width, height);
  context.restore();

  context.save();
  context.lineWidth = 10;
  context.strokeStyle = 'rgba(255,255,255,0.9)';
  context.beginPath();
  context.moveTo(x + width * 0.5, y + height * 0.02);
  context.bezierCurveTo(x + width * 0.94, y + height * 0.02, x + width, y + height * 0.34, x + width * 0.86, y + height * 0.66);
  context.bezierCurveTo(x + width * 0.72, y + height, x + width * 0.18, y + height * 0.92, x + width * 0.08, y + height * 0.62);
  context.bezierCurveTo(x - width * 0.02, y + height * 0.32, x + width * 0.08, y + height * 0.02, x + width * 0.5, y + height * 0.02);
  context.closePath();
  context.stroke();
  context.restore();
}

function drawPlayButton(context, centerX, centerY, radius) {
  context.save();
  context.fillStyle = 'rgba(255,255,255,0.76)';
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(15,17,17,0.54)';
  context.beginPath();
  context.moveTo(centerX - radius * 0.18, centerY - radius * 0.34);
  context.lineTo(centerX - radius * 0.18, centerY + radius * 0.34);
  context.lineTo(centerX + radius * 0.38, centerY);
  context.closePath();
  context.fill();
  context.restore();
}

function drawRadar(context, metrics, centerX, centerY, radius, progress = 1) {
  const points = metrics.map((metric, index) => {
    const angle = -Math.PI / 2 + (index / metrics.length) * Math.PI * 2;
    const animatedValue = (metric.value || 0) * Math.min(1, 0.38 + progress * 1.2);
    return {
      ...metric,
      angle,
      x: centerX + Math.cos(angle) * radius * (animatedValue / 100),
      y: centerY + Math.sin(angle) * radius * (animatedValue / 100),
      axisX: centerX + Math.cos(angle) * radius,
      axisY: centerY + Math.sin(angle) * radius,
      labelX: centerX + Math.cos(angle) * (radius + 44),
      labelY: centerY + Math.sin(angle) * (radius + 44),
    };
  });

  context.save();
  context.strokeStyle = 'rgba(20,24,24,0.24)';
  context.lineWidth = 2.2;
  [0.34, 0.67, 1].forEach((level) => {
    context.beginPath();
    context.arc(centerX, centerY, radius * level, 0, Math.PI * 2);
    if (level < 1) context.setLineDash([4, 8]);
    else context.setLineDash([]);
    context.stroke();
  });
  context.setLineDash([]);

  points.forEach((point) => {
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(point.axisX, point.axisY);
    context.stroke();
  });

  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.closePath();
  context.fillStyle = 'rgba(118,183,198,0.16)';
  context.strokeStyle = 'rgba(216,123,156,0.7)';
  context.lineWidth = 7;
  context.fill();
  context.stroke();

  context.fillStyle = '#4e5554';
  context.font = '760 23px Inter, sans-serif';
  context.textAlign = 'center';
  points.forEach((point) => {
    context.beginPath();
    context.arc(point.x, point.y, 7, 0, Math.PI * 2);
    context.fill();
    context.fillText(point.label, point.labelX, point.labelY);
  });
  context.restore();
}

function normalizeDownloadRadar(radar) {
  const fallback = [
    { label: 'flowy', value: 84 },
    { label: 'rhythm', value: 78 },
    { label: 'glowy', value: 88 },
    { label: 'soft', value: 81 },
    { label: 'playful', value: 90 },
  ];
  const map = {
    放鬆雲量: 'flowy',
    雨刷節奏: 'rhythm',
    眼下亮度: 'glowy',
    療癒電波: 'soft',
    好玩程度: 'playful',
    慢慢來力: 'slow',
  };
  return (radar?.length ? radar : fallback).slice(0, 5).map((metric, index) => ({
    label: map[metric.label] || metric.label || fallback[index].label,
    value: metric.value ?? fallback[index].value,
  }));
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function renderVideoFrames({ context, durationMs, fps, frame }) {
  const frameCount = Math.ceil((durationMs / 1000) * fps);
  return new Promise((resolve) => {
    let index = 0;
    const render = () => {
      const progress = index / Math.max(1, frameCount - 1);
      frame(progress, context);
      index += 1;
      if (index <= frameCount) {
        window.setTimeout(render, 1000 / fps);
      } else {
        resolve();
      }
    };
    render();
  });
}

function pickVideoMimeType() {
  return [
    'video/mp4;codecs=h264',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.download = filename;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const characters = Array.from(text);
  let line = '';
  let currentY = y;

  characters.forEach((character) => {
    const testLine = line + character;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = character;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  });

  context.fillText(line, x, currentY);
}
