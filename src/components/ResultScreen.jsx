import { useEffect, useMemo, useState } from 'react';
import {
  buildDailyPlanSummary,
  buildProgramDayPlanSummary,
  DAILY_TOTAL_MAX_SCORE,
  getCompletedProgramDays,
} from '../utils/dailyPlan.js';
import {
  fetchProgramDayLeaderboard,
  getSupabaseDisplayName,
  saveSupabaseDisplayName,
} from '../utils/supabaseProgressAdapter.js';
import { getDisplayName, normalizeDisplayName, saveDisplayName } from '../utils/storage.js';
import TodayPlanCard from './TodayPlanCard.jsx';

const MAX_RESULT_SCORE = DAILY_TOTAL_MAX_SCORE;
const RESULT_RADAR_LABELS = ['Calm', 'Focus', 'Flow', 'Play', 'Lift'];

export default function ResultScreen({
  result,
  habit,
  selectedProgramDay = null,
  onSelectedProgramDayChange,
  onRestart,
  onTodayPlan,
  onPassport,
  onLeaderboard,
  onProgressChanged,
  shouldPromptForDisplayName = true,
}) {
  const [exportMessage, setExportMessage] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(true);
  const [leaderboardRefreshKey, setLeaderboardRefreshKey] = useState(0);
  const [isNameEntryOpen, setIsNameEntryOpen] = useState(false);
  const [isNameChecking, setIsNameChecking] = useState(false);
  const [isNameSaving, setIsNameSaving] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState('');
  const currentDailyPlan = useMemo(() => buildDailyPlanSummary(habit), [habit]);
  const currentProgramDay = Math.max(1, Number(currentDailyPlan.programDay) || 1);
  const completedProgramDays = getCompletedProgramDays(habit);
  const resolvedSelectedDay = Math.min(7, Math.max(1, Number(selectedProgramDay) || currentProgramDay));
  const isSelectedDayAvailable = resolvedSelectedDay === currentProgramDay || completedProgramDays.has(resolvedSelectedDay);
  const programDay = isSelectedDayAvailable ? resolvedSelectedDay : currentProgramDay;
  const isHistory = programDay !== currentProgramDay;
  const dailyPlan = useMemo(() => {
    const storedPlan = buildProgramDayPlanSummary(habit, programDay);
    const canUseCurrentResult = result?.type === 'daily-plan'
      && !isHistory
      && Number(result.programDay) === currentProgramDay;
    if (!canUseCurrentResult) return storedPlan;
    return {
      ...storedPlan,
      ...result,
      sceneResults: result.sceneResults?.length ? result.sceneResults : storedPlan.sceneResults,
      radar: result.radar?.length ? result.radar : storedPlan.radar,
    };
  }, [currentProgramDay, habit, isHistory, programDay, result]);
  const score = dailyPlan.score;
  const sceneTitle = dailyPlan.sceneTitle;
  const focusLabel = dailyPlan.area;
  const topPercent = getTopPercent(score);
  const holdSeconds = Math.max(1, Math.round(dailyPlan.holdSeconds || 90));

  useEffect(() => {
    if (selectedProgramDay !== programDay) onSelectedProgramDayChange?.(programDay);
  }, [onSelectedProgramDayChange, programDay, selectedProgramDay]);

  useEffect(() => {
    let isCurrent = true;
    const loadLeaderboard = async () => {
      const rows = await fetchProgramDayLeaderboard(programDay);
      if (!isCurrent) return;
      setLeaderboard(rows.map((row) => ({
        rank: Number(row.rank),
        name: row.display_name || 'Anonymous',
        score: Math.max(0, Number(row.total_score) || 0),
      })));
      setIsLeaderboardLoading(false);
    };

    setIsLeaderboardLoading(true);
    void loadLeaderboard();
    return () => {
      isCurrent = false;
    };
  }, [programDay, habit?.updatedAt, leaderboardRefreshKey]);

  useEffect(() => {
    let isCurrent = true;
    if (!shouldPromptForDisplayName || isHistory || !dailyPlan.isComplete) {
      setIsNameEntryOpen(false);
      return () => { isCurrent = false; };
    }

    if (isLeaderboardLoading) {
      return () => { isCurrent = false; };
    }

    const tenthPlaceScore = leaderboard[9]?.score ?? -1;
    const qualifiesForLeaderboard = leaderboard.length < 10 || score >= tenthPlaceScore;
    if (!qualifiesForLeaderboard) {
      setIsNameEntryOpen(false);
      return () => { isCurrent = false; };
    }

    const resolveName = async () => {
      setIsNameChecking(true);
      const localName = getDisplayName(habit);
      if (localName) {
        if (isCurrent) {
          setNameDraft(localName);
          setIsNameEntryOpen(false);
          setIsNameChecking(false);
        }
        return;
      }

      const cloudName = await getSupabaseDisplayName();
      if (!isCurrent) return;
      if (cloudName) {
        saveDisplayName(cloudName);
        onProgressChanged?.();
        setNameDraft(cloudName);
        setIsNameEntryOpen(false);
      } else {
        setIsNameEntryOpen(true);
      }
      setIsNameChecking(false);
    };

    void resolveName();
    return () => { isCurrent = false; };
  }, [
    dailyPlan.isComplete,
    habit?.displayName,
    isHistory,
    isLeaderboardLoading,
    leaderboard,
    onProgressChanged,
    score,
    shouldPromptForDisplayName,
  ]);

  const saveName = async (event) => {
    event.preventDefault();
    const displayName = normalizeDisplayName(nameDraft);
    if (!displayName) {
      setNameError('Enter a display name to join the leaderboard.');
      return;
    }

    setNameError('');
    saveDisplayName(displayName);
    onProgressChanged?.();
    setIsNameSaving(true);
    const saved = await saveSupabaseDisplayName(displayName);
    setIsNameSaving(false);

    if (!saved.ok) {
      setNameError('Saved on this device. Check your connection and try again to sync it to the leaderboard.');
      return;
    }

    setNameDraft(saved.displayName);
    setIsNameEntryOpen(false);
    setLeaderboardRefreshKey((value) => value + 1);
  };

  const downloadVideo = async () => {
    setIsExporting(true);
    setExportMessage('Creating your animated reset video...');
    try {
      const video = await createResultVideo({ result: dailyPlan, habit });
      downloadBlob(video.blob, `face-reset-vibe.${video.extension}`);
      setExportMessage(`Downloaded ${video.extension.toUpperCase()} video.`);
    } catch {
      const image = await createResultImage({ result: dailyPlan, habit });
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
      const video = await createResultVideo({ result: dailyPlan, habit });
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

  return (
    <section className="screen result-screen reset-result-screen result-dashboard-screen">
      <main className="result-challenge-shell" aria-label="Face Reset challenge result">
        <header className="result-challenge-heading">
          <h1>Face Reset Challenge</h1>
          <ol className="result-day-strip" aria-label="Seven day challenge history">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
              const canSelectDay = day === currentProgramDay || completedProgramDays.has(day);
              return (
              <li className={`${day === programDay ? 'is-current ' : ''}${completedProgramDays.has(day) ? 'is-complete ' : ''}${canSelectDay ? 'is-selectable' : 'is-locked'}`} key={day}>
                <button
                  type="button"
                  onClick={() => canSelectDay && onSelectedProgramDayChange?.(day)}
                  disabled={!canSelectDay}
                  aria-current={day === programDay ? 'step' : undefined}
                  aria-label={day === currentProgramDay ? `Current Program Day ${day}` : completedProgramDays.has(day) ? `View Program Day ${day} history` : `Program Day ${day} locked`}
                >
                  {day === programDay ? `DAY ${day}` : day}
                </button>
                {completedProgramDays.has(day) && <span aria-hidden="true">✓</span>}
              </li>
              );
            })}
          </ol>
        </header>

        <div className="result-challenge-grid">
          <section className="result-summary-card">
            <div className="result-summary-top">
              <div>
              <p className="result-eyebrow">PROGRAM DAY {programDay} SCORE</p>
                <div className="result-score-display">
                  <strong>{score}</strong>
                  <span>/ 300</span>
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
            </div>

            <div className="result-achievement-row">
              <strong className="result-ranking-pill"><TrophyIcon />TOP {topPercent} %</strong>
              <span>Better than {Math.max(1, 100 - topPercent)}% of players</span>
            </div>
            <div className="result-delta-row">
              <span><i><UpIcon /></i><strong>+{Math.max(1, score - 268)} pts</strong> from yesterday</span>
              <b><PersonalBestIcon />NEW PERSONAL BEST</b>
            </div>

            <div className="result-summary-divider" />
            <ResultRadarPanel result={dailyPlan} />

            <div className="result-balance-callout">
              <img src="/assets/design-v3/result-mascot.png" alt="" />
              <p>
                <strong>You looks more relaxed and balanced!</strong>
                <span>Keep going for even better results.</span>
              </p>
            </div>
          </section>

          <aside className="result-challenge-right">
            <TodayPlanCard
              className="result-focus-card"
              sceneResults={dailyPlan.sceneResults}
              programDay={programDay}
              onSessionSelect={isHistory ? undefined : onRestart}
              showCompletion={!isHistory}
              isHistory={isHistory}
            />

            <ResultLeaderboard
              rows={leaderboard}
              programDay={programDay}
              isLoading={isLeaderboardLoading}
            />
          </aside>
        </div>

        <nav className="result-dashboard-actions" aria-label="Result navigation">
          <button type="button" onClick={onTodayPlan}>TODAY&apos;S PLAN</button>
          <button type="button" onClick={onPassport}>PASSPORT</button>
          <button type="button" onClick={onLeaderboard}>LEADERBOARD</button>
        </nav>

        {exportMessage && <p className="export-message result-dashboard-message">{exportMessage}</p>}

        {isNameEntryOpen && !isNameChecking && (
          <div className="result-name-entry-backdrop" role="presentation">
            <form className="result-name-entry-modal" onSubmit={saveName}>
              <button
                className="result-name-entry-close"
                type="button"
                aria-label="Close name entry"
                onClick={() => setIsNameEntryOpen(false)}
              >
                ×
              </button>
              <h2>You&apos;re on the leaderboard!</h2>
              <p>Enter a display name to appear on Day {programDay}&apos;s leaderboard.</p>
              <label htmlFor="leaderboard-display-name">Display name</label>
              <input
                id="leaderboard-display-name"
                value={nameDraft}
                maxLength={24}
                placeholder="Enter your name"
                onChange={(event) => {
                  setNameDraft(event.target.value);
                  setNameError('');
                }}
                autoComplete="nickname"
                autoFocus
              />
              {nameError && <small className="result-name-entry-error">{nameError}</small>}
              <button className="result-name-entry-submit" type="submit" disabled={isNameSaving}>
                {isNameSaving ? 'Saving...' : 'Join the Leaderboard'}
              </button>
            </form>
          </div>
        )}
      </main>
    </section>
  );
}

function ResultRadarPanel({ result }) {
  const [rotationStep, setRotationStep] = useState(0);
  const afterMetrics = normalizeDownloadRadar(result?.radar)
    .slice(0, 5)
    .map((metric, index) => ({ ...metric, label: RESULT_RADAR_LABELS[index] }));
  const snapshots = (result?.snapshots || []).filter((snapshot) => snapshot?.image).slice(0, 3);
  const metricDeltas = [13, 11, 18, 16, 14];
  const beforeMetrics = afterMetrics.map((metric, index) => ({
    ...metric,
    value: Math.max(24, (metric.value || 0) - metricDeltas[index]),
  }));
  const axes = [-90, -18, 54, 126, 198].map((angle) => angle + rotationStep * 72);
  const radius = 89;
  const rotationDegrees = rotationStep * 72;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRotationStep((current) => (current + 1) % 5);
    }, 2600);
    return () => window.clearInterval(timer);
  }, []);
  const pointFor = (value, index, extraRadius = 0) => {
    const angle = axes[index] * Math.PI / 180;
    const distance = extraRadius || (Math.max(0, Math.min(100, value)) / 100) * radius;
    return {
      x: 100 + Math.cos(angle) * distance,
      y: 100 + Math.sin(angle) * distance,
    };
  };
  const afterPoints = afterMetrics.map((metric, index) => {
    const point = pointFor(metric.value, index);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(' ');
  const beforePoints = beforeMetrics.map((metric, index) => {
    const point = pointFor(metric.value, index);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(' ');
  return (
    <section className="result-radar-card" aria-label="Your face balance">
      <div className="result-radar-topline">
        <span>YOUR FACE BALANCE <i aria-hidden="true">i</i></span>
        <div>
          <b className="before-key">Before</b>
          <b className="after-key">After</b>
        </div>
      </div>
      <div className="result-radar-stage">
        <ResultRadarPortrait
          snapshots={snapshots}
          activeIndex={snapshots.length ? rotationStep % snapshots.length : 0}
          rotationDegrees={rotationDegrees}
        />
        <svg viewBox="0 0 200 200" role="img" aria-label="Result radar chart">
          <circle className="result-radar-ring" cx="100" cy="100" r={radius} />
          {afterMetrics.map((metric, index) => {
            const point = pointFor(100, index, radius);
            return (
              <line
                className="result-radar-axis-line"
                x1="100"
                y1="100"
                x2={point.x}
                y2={point.y}
                key={metric.label}
              />
            );
          })}
          {!snapshots.length && (
            <image
              className="result-radar-photo"
              href="/assets/design-v3/result-mascot.png"
              x="11"
              y="11"
              width="178"
              height="178"
              preserveAspectRatio="xMidYMid meet"
            />
          )}
          <polygon className="result-radar-before" points={beforePoints} />
          <polygon className="result-radar-after" points={afterPoints} />
          {afterMetrics.map((metric, index) => {
            const valuePoint = pointFor(metric.value, index);
            return (
              <circle
                className="result-radar-node"
                cx={valuePoint.x}
                cy={valuePoint.y}
                r="3.8"
                key={`${metric.label}-node`}
              />
            );
          })}
        </svg>
        {afterMetrics.map((metric, index) => {
          const angle = axes[index] * Math.PI / 180;
          const labelRadius = Math.min(radius + 26, (metric.value / 100) * radius + 30);
          const x = 50 + (Math.cos(angle) * labelRadius) / 2;
          const y = 50 + (Math.sin(angle) * labelRadius) / 2;
          return (
            <div
              className="result-radar-axis-label"
              key={`${metric.label}-label`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span>{metric.label.toUpperCase()}</span>
              <strong>+{metricDeltas[index]}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ResultRadarPortrait({ snapshots, activeIndex, rotationDegrees }) {
  if (!snapshots.length) return null;

  return (
    <div
      className="result-radar-portrait"
      aria-label="Your session portraits"
      style={{ '--radar-turn': `${rotationDegrees}deg` }}
    >
      {snapshots.map((snapshot, index) => (
        <img
          className={index === activeIndex ? 'is-active' : ''}
          src={snapshot.image}
          alt={`Portrait from ${snapshot.sceneId}`}
          key={snapshot.id || `${snapshot.sceneId}-${index}`}
        />
      ))}
      {snapshots.length > 1 && (
        <div className="result-radar-portrait-dots" aria-hidden="true">
          {snapshots.map((snapshot, index) => <i className={index === activeIndex ? 'is-active' : ''} key={snapshot.id || index} />)}
        </div>
      )}
    </div>
  );
}

function ResultLeaderboard({ rows, programDay, isLoading }) {
  return (
    <section className="result-leaderboard-card" aria-label={`Day ${programDay} leaderboard`}>
      <header>
        <span>DAY {programDay} LEADERBOARD</span>
      </header>
      <ol>
        {rows.slice(0, 10).map((row) => (
          <li key={`${row.rank}-${row.name}`}>
            <span>{row.rank}</span>
            <i>{row.name.charAt(0).toUpperCase()}</i>
            <strong>{row.name}</strong>
            <b>{row.score}</b>
          </li>
        ))}
        {!isLoading && !rows.length && (
          <li className="result-leaderboard-empty">Complete all 3 sessions to be the first on Day {programDay}.</li>
        )}
        {isLoading && <li className="result-leaderboard-empty">Loading leaderboard...</li>}
      </ol>
    </section>
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

function TrophyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 960 960">
      <path d="M280 880v-80h160V676q-49-11-87.5-41.5T296 556q-75-9-125.5-65.5T120 360v-40q0-33 23.5-56.5T200 240h80v-80h400v80h80q33 0 56.5 23.5T840 320v40q0 74-50.5 130.5T664 556q-18 48-56.5 78.5T520 676v124h160v80H280Zm0-408V320h-80v40q0 38 22 68.5t58 43.5Zm400 0q36-13 58-43.5t22-68.5v-40h-80v152Z" />
    </svg>
  );
}

function UpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 19V6" />
      <path d="m6 11.5 6-6 6 6" />
    </svg>
  );
}

function PersonalBestIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 960 960">
      <path d="m354 713 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143Zm126 167q-83 0-156-31.5T197 763q-54-54-85.5-127T80 480q0-83 31.5-156T197 197q54-54 127-85.5T480 80q83 0 156 31.5T763 197q54 54 85.5 127T880 480q0 83-31.5 156T763 763q-54 54-127 85.5T480 880Z" />
    </svg>
  );
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
  context.fillText('Full reset complete', width / 2, 108);
  context.font = '600 28px Inter, sans-serif';
  context.fillText('Three sessions, one softer face.', width / 2, 154);

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
    result?.comment || 'Today’s three Face Reset sessions are complete.',
    76,
    1124,
    748,
    34,
  );
}

function getTopPercent(score) {
  const normalizedScore = getScorePercent(score);
  return Math.max(3, Math.min(18, Math.round(24 - normalizedScore * 0.2)));
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
