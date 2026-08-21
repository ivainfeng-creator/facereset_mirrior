import { useEffect, useMemo, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import { buildDailyPlanSummary, DAILY_TOTAL_MAX_SCORE } from '../utils/dailyPlan.js';
import { getEffectiveLocalDateKey } from '../utils/effectiveDate.js';
import {
  fetchProgramDayLeaderboard,
  getSupabaseDisplayName,
  saveSupabaseDisplayName,
} from '../utils/supabaseProgressAdapter.js';
import { buildLeaderboardDisplayRows } from '../utils/leaderboardDisplay.js';
import { playSceneEffect } from '../utils/audioManager.js';
import { getDisplayName, normalizeDisplayName, saveDisplayName } from '../utils/storage.js';
import TodayPlanCard from './TodayPlanCard.jsx';
import ShareCardPreview, { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from './ShareCardPreview.jsx';
import { pickRandom, SHARE_CARD_MASCOTS, SHARE_CARD_SLOGANS } from '../data/shareCardContent.js';
import { useCaptureUrlsByDate } from '../hooks/useCaptureUrls.js';
import { useI18n } from '../i18n/context.js';

const MAX_RESULT_SCORE = DAILY_TOTAL_MAX_SCORE;
const RESULT_RADAR_LABELS = ['Calm', 'Focus', 'Flow', 'Play', 'Lift'];
const LEADERBOARD_SUBMIT_EFFECT = Object.freeze({
  source: '/audio/Overall/Click-1.mp3',
  volume: 0.7,
});
const RESULT_CARD_FLIP_EFFECT = Object.freeze({
  source: '/audio/Overall/Flip-1.mp3',
  volume: 0.7,
});
const CARD_LAYOUT_ENTRY_DURATION_MS = 780;

export default function ResultScreen({
  result,
  habit,
  onRestart,
  onTodayPlan,
  onPassport,
  onLeaderboard,
  onProgressChanged,
  shouldPromptForDisplayName = true,
  shouldAnimateCardLayout = false,
  cardLayoutAnimationKey = 0,
  daySelector,
  isHistoryOnly = false,
  onCloseHistory,
}) {
  const { t } = useI18n();
  const [cardOrder, setCardOrder] = useState([0, 1, 2]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(isHistoryOnly);
  const [isCardLayoutAnimationActive, setIsCardLayoutAnimationActive] = useState(shouldAnimateCardLayout);
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
  const [carouselTouchStartX, setCarouselTouchStartX] = useState(null);
  const dailyPlan = useMemo(() => {
    const storedPlan = buildDailyPlanSummary(habit, result?.date ? { date: result.date } : undefined);
    if (result?.type !== 'daily-plan') return storedPlan;
    return {
      ...storedPlan,
      ...result,
      sceneResults: result.sceneResults?.length ? result.sceneResults : storedPlan.sceneResults,
      radar: result.radar?.length ? result.radar : storedPlan.radar,
    };
  }, [habit, result]);
  const score = dailyPlan.score;
  const sceneTitle = dailyPlan.sceneTitle;
  const focusLabel = dailyPlan.area;
  const holdSeconds = Math.max(1, Math.round(dailyPlan.holdSeconds || 90));
  const programDay = Math.max(1, Number(dailyPlan.programDay) || 1);
  const shareCardNodeRef = useRef(null);
  const cardLayoutAnimationTimerRef = useRef(null);
  // Locally persisted captures for the day being viewed. Keyed by the plan's own
  // FaceRest date key, so a past day can only ever surface its own photos.
  const captureUrlsByScene = useCaptureUrlsByDate(dailyPlan.date);
  // A completed *earlier* day, not "the history overlay" — the overlay is also how
  // today's Result Page is presented once session 3 lands, and that page must keep
  // its approved three-circle collage.
  const isPastDay = Boolean(dailyPlan.date) && dailyPlan.date !== getEffectiveLocalDateKey();
  const shareCardInstanceKey = `${programDay}-${dailyPlan.date || ''}`;
  const { slogan: shareCardSlogan, mascot: shareCardMascot } = useMemo(
    () => ({ slogan: pickRandom(SHARE_CARD_SLOGANS), mascot: pickRandom(SHARE_CARD_MASCOTS) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shareCardInstanceKey],
  );
  // In-memory captures from the session just finished win; anything missing (a
  // reload, or reopening today's Result from the day selector) falls back to the
  // locally persisted capture for that same date.
  const shareCardPhotos = useMemo(() => {
    const snapshotByScene = new Map(
      (dailyPlan.snapshots || []).filter((snapshot) => snapshot?.image).map((snapshot) => [snapshot.sceneId, snapshot]),
    );
    return (dailyPlan.sceneResults || [])
      .map((entry) => {
        const snapshot = snapshotByScene.get(entry.sceneId);
        const image = snapshot?.image || captureUrlsByScene[entry.sceneId];
        return image ? { sceneId: entry.sceneId, image } : null;
      })
      .filter(Boolean);
  }, [captureUrlsByScene, dailyPlan.sceneResults, dailyPlan.snapshots]);
  const historyCoverPhoto = useMemo(() => (
    isPastDay ? getHistoryCoverPhoto(dailyPlan.sceneResults, shareCardPhotos) : null
  ), [dailyPlan.sceneResults, isPastDay, shareCardPhotos]);
  const shareCardFilename = `facerest-day-${programDay}-share-card.png`;
  // Deliberately measured against real rows only: starter rows are display-only and
  // must not decide whether the player is prompted to join the real leaderboard.
  const qualifiesForLeaderboard = !isLeaderboardLoading && (
    leaderboard.length < 10 || score >= Math.max(0, Number(leaderboard[9]?.total_score) || 0)
  );
  const bringCardToFront = (cardIndex) => {
    if (isCardLayoutAnimationActive) return;
    if (cardOrder[0] !== cardIndex) playSceneEffect(RESULT_CARD_FLIP_EFFECT);

    setCardOrder((currentOrder) => [
      cardIndex,
      ...currentOrder.filter((index) => index !== cardIndex),
    ]);
  };
  const handleCarouselTouchEnd = (event) => {
    if (isCardLayoutAnimationActive || carouselTouchStartX === null) return;

    const horizontalDistance = event.changedTouches[0].clientX - carouselTouchStartX;
    setCarouselTouchStartX(null);
    if (Math.abs(horizontalDistance) < 40) return;

    bringCardToFront(cardOrder[horizontalDistance < 0 ? 2 : 1]);
  };
  const closeHistory = () => {
    if (isHistoryOnly) {
      onCloseHistory?.();
      return;
    }
    setIsHistoryOpen(false);
  };

  const toggleHistory = () => {
    setIsHistoryOpen((isOpen) => {
      const nextIsOpen = !isOpen;
      window.clearTimeout(cardLayoutAnimationTimerRef.current);
      setIsCardLayoutAnimationActive(nextIsOpen);

      if (nextIsOpen) {
        cardLayoutAnimationTimerRef.current = window.setTimeout(
          () => setIsCardLayoutAnimationActive(false),
          CARD_LAYOUT_ENTRY_DURATION_MS,
        );
      }

      return nextIsOpen;
    });
  };

  useEffect(() => {
    if (!shouldAnimateCardLayout) return undefined;

    setCardOrder([0, 1, 2]);
    setIsHistoryOpen(true);
    setIsCardLayoutAnimationActive(true);
    window.clearTimeout(cardLayoutAnimationTimerRef.current);
    cardLayoutAnimationTimerRef.current = window.setTimeout(
      () => setIsCardLayoutAnimationActive(false),
      CARD_LAYOUT_ENTRY_DURATION_MS,
    );
    return () => window.clearTimeout(cardLayoutAnimationTimerRef.current);
    // Intentionally keyed only on cardLayoutAnimationKey (one animation trigger = one
    // key bump). App.jsx flips shouldAnimateCardLayout back to false ~800ms after
    // triggering it, close to this effect's own 780ms unlock timer; if that prop were
    // also a dependency, that later flip would re-run this effect, its cleanup would
    // cancel the pending unlock timer, and the guard clause above (shouldAnimateCardLayout
    // now false) would return without ever unlocking — leaving cards stuck unclickable
    // whenever the two timers raced. Reading the prop only via closure avoids that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardLayoutAnimationKey]);

  // The history overlay scrolls internally; locking the page behind it stops the
  // background from scrolling away under the card stack on touch devices.
  useEffect(() => {
    if (!isHistoryOpen) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [isHistoryOpen]);

  useEffect(() => {
    let isCurrent = true;
    const loadLeaderboard = async () => {
      const rows = await fetchProgramDayLeaderboard(programDay);
      if (!isCurrent) return;
      setLeaderboard(rows);
      setIsLeaderboardLoading(false);
    };

    setIsLeaderboardLoading(true);
    void loadLeaderboard();
    return () => {
      isCurrent = false;
    };
  }, [programDay, habit?.displayName, habit?.updatedAt, leaderboardRefreshKey]);

  // Supabase has no "is me" flag, so the player's own row is matched on the
  // display name they submitted with. Falls back to no highlight when the
  // player has not named themselves yet. Starter rows are never "me".
  const ownName = getDisplayName(habit);
  const displayLeaderboard = useMemo(() => (
    buildLeaderboardDisplayRows(programDay, leaderboard).map((row) => ({
      ...row,
      me: !row.isSeed && Boolean(ownName) && normalizeDisplayName(row.name) === ownName,
    }))
  ), [programDay, leaderboard, ownName]);

  useEffect(() => {
    let isCurrent = true;
    if (!shouldPromptForDisplayName || !dailyPlan.isComplete) {
      setIsNameEntryOpen(false);
      return () => { isCurrent = false; };
    }

    if (isLeaderboardLoading) {
      return () => { isCurrent = false; };
    }

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
    isLeaderboardLoading,
    leaderboard,
    onProgressChanged,
    score,
    shouldPromptForDisplayName,
  ]);

  const saveName = async (event) => {
    event.preventDefault();
    playSceneEffect(LEADERBOARD_SUBMIT_EFFECT);
    const displayName = normalizeDisplayName(nameDraft);
    if (!displayName) {
      setNameError(t('result.name.errorEmpty'));
      return;
    }

    setNameError('');
    saveDisplayName(displayName);
    onProgressChanged?.();
    setIsNameSaving(true);
    const saved = await saveSupabaseDisplayName(displayName);
    setIsNameSaving(false);

    if (!saved.ok) {
      setNameError(t('result.name.errorSync'));
      return;
    }

    setNameDraft(saved.displayName);
    setIsNameEntryOpen(false);
    setLeaderboardRefreshKey((value) => value + 1);
  };

  const renderShareCardBlob = async () => {
    const node = shareCardNodeRef.current;
    if (!node) throw new Error('Share card is not ready yet.');
    const exportOptions = { width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT, pixelRatio: 1, cacheBust: true };
    // toBlob embeds @font-face CSS by fetching it over the network; if that stalls
    // (offline, blocked font host, slow proxy) it would otherwise hang indefinitely,
    // so the whole render (including the no-embedded-fonts retry) is time-bounded.
    const render = toBlob(node, exportOptions).catch(() => toBlob(node, { ...exportOptions, skipFonts: true }));
    return withTimeout(render, 12000);
  };

  const downloadShareCard = async () => {
    setIsExporting(true);
    setExportMessage(t('share.creating'));
    try {
      const blob = await renderShareCardBlob();
      downloadBlob(blob, shareCardFilename);
      setExportMessage(t('share.downloaded'));
    } catch {
      setExportMessage(t('share.createFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  const shareShareCard = async () => {
    setIsExporting(true);
    setExportMessage(t('share.preparing'));
    try {
      const blob = await renderShareCardBlob();
      const file = new File([blob], shareCardFilename, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: 'FaceRest',
          text: shareCardSlogan.join(' '),
        });
        setExportMessage(t('share.sheetOpened'));
      } else {
        downloadBlob(blob, shareCardFilename);
        setExportMessage(t('share.sheetUnavailable'));
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        setExportMessage(t('share.cancelled'));
      } else {
        setExportMessage(t('share.failed'));
      }
    } finally {
      setIsExporting(false);
    }
  };

  const historyModal = isHistoryOpen && (
    <div className="result-history-overlay">
      <section
        className="result-history-modal"
        aria-label={t('result.historyAria')}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="result-carousel"
          aria-label={t('result.cardsAria')}
          onTouchStart={(event) => setCarouselTouchStartX(event.touches[0].clientX)}
          onTouchEnd={handleCarouselTouchEnd}
          onTouchCancel={() => setCarouselTouchStartX(null)}
        >
          <div
            className={`result-challenge-grid ${isCardLayoutAnimationActive ? 'is-card-layout-entering' : ''}`}
            key={cardLayoutAnimationKey}
          >
            <div
              className={`result-card-stack is-stack-${cardOrder.indexOf(0)}`}
              onClick={isCardLayoutAnimationActive ? undefined : () => bringCardToFront(0)}
            >
              <div className="result-card-content" inert={cardOrder.indexOf(0) !== 0}>
                <ResultShareCard
                  cardRef={shareCardNodeRef}
                  slogan={shareCardSlogan}
                  mascot={shareCardMascot}
                  photos={shareCardPhotos}
                  coverPhoto={historyCoverPhoto}
                  isExporting={isExporting}
                  onDownload={downloadShareCard}
                  onShare={shareShareCard}
                />
              </div>
            </div>
            <div
              className={`result-card-stack is-stack-${cardOrder.indexOf(1)}`}
              onClick={isCardLayoutAnimationActive ? undefined : () => bringCardToFront(1)}
            >
              <div className="result-card-content" inert={cardOrder.indexOf(1) !== 0}>
                <TodayPlanCard
                  className="result-focus-card"
                  sceneResults={dailyPlan.sceneResults}
                  programDay={programDay}
                  onSessionSelect={onRestart}
                  showCompletion
                  shouldAnimateCompletionBanner={cardOrder.indexOf(1) === 0}
                />
              </div>
            </div>
            <div
              className={`result-card-stack is-stack-${cardOrder.indexOf(2)}`}
              onClick={isCardLayoutAnimationActive ? undefined : () => bringCardToFront(2)}
            >
              <div className="result-card-content" inert={cardOrder.indexOf(2) !== 0}>
                <ResultLeaderboard rows={displayLeaderboard} programDay={programDay} score={score} isLoading={isLeaderboardLoading} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  if (isHistoryOnly) return historyModal;

  return (
    <section className="screen result-screen reset-result-screen result-dashboard-screen">
      <main className="result-challenge-shell" aria-label={t('result.shellAria')}>
        <header className="result-challenge-heading">
          <div className="result-challenge-heading-row">
            <h1>{t('plan.hero')}</h1>
            <button className="result-today-plan-action" type="button" onClick={onTodayPlan}>
              {t('result.todaysPlan')}
            </button>
          </div>
          {daySelector}
        </header>

        <button
          className={`result-history-fab${isHistoryOpen ? ' is-active' : ''}`}
          type="button"
          aria-label={t(isHistoryOpen ? 'result.historyClose' : 'result.historyOpen')}
          aria-expanded={isHistoryOpen}
          data-label={t(isHistoryOpen ? 'result.historyClose' : 'result.historyOpen')}
          onClick={toggleHistory}
        >
          {isHistoryOpen ? <CloseIcon /> : <HistoryIcon />}
        </button>

        {historyModal}

        {exportMessage && <p className="export-message result-dashboard-message">{exportMessage}</p>}

        {isNameEntryOpen && !isNameChecking && (
          <div className="result-name-entry-backdrop" role="presentation">
            <form className="result-name-entry-modal" onSubmit={saveName}>
              <button
                className="result-name-entry-close"
                type="button"
                aria-label={t('result.name.closeAria')}
                onClick={() => setIsNameEntryOpen(false)}
              >
                ×
              </button>
              <header className="result-name-entry-heading">
                <h2>{t('result.name.title')}</h2>
                <p>{t('result.name.body')}</p>
              </header>
              <div className={`result-name-entry-field${nameError ? ' is-error' : ''}`}>
                <input
                  id="leaderboard-display-name"
                  aria-label={t('result.name.fieldAria')}
                  value={nameDraft}
                  maxLength={24}
                  placeholder={t('result.name.placeholder')}
                  onChange={(event) => {
                    setNameDraft(event.target.value);
                    setNameError('');
                  }}
                  autoComplete="nickname"
                  autoFocus
                />
                {nameError && <small className="result-name-entry-error">{nameError}</small>}
              </div>
              <button className="result-name-entry-submit" type="submit" disabled={isNameSaving}>
                {t(isNameSaving ? 'result.name.saving' : 'result.name.submit')}
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

function ResultLeaderboard({ rows, programDay, score, isLoading }) {
  const { t } = useI18n();

  return (
    <section className="result-leaderboard-card" aria-label={t('result.leaderboardAria', { day: programDay })}>
      <div className="result-leaderboard-summary">
        <p className="result-eyebrow">{t('result.scoreboard', { day: programDay })}</p>
        <div className="result-score-display">
          <strong>{score}</strong>
          <span>{t('result.outOf')}</span>
        </div>
        <div className="result-delta-row">
          <b><PersonalBestIcon />{t('result.personalBest')}</b>
        </div>
      </div>
      <ol>
        {rows.slice(0, 10).map((row) => {
          const className = [
            row.rank <= 3 ? `rank-${row.rank}` : '',
            row.me ? 'is-user' : '',
          ].filter(Boolean).join(' ');

          return (
            <li className={className} key={`${row.rank}-${row.name}`}>
              <span>{row.rank}</span>
              <i>{row.name.charAt(0).toUpperCase()}</i>
              <strong>{row.name}</strong>
              <b>{row.score}</b>
            </li>
          );
        })}
        {!isLoading && !rows.length && (
          <li className="result-leaderboard-empty">{t('result.leaderboardEmpty', { day: programDay })}</li>
        )}
        {isLoading && <li className="result-leaderboard-empty">{t('result.leaderboardLoading')}</li>}
      </ol>
    </section>
  );
}

function ResultShareCard({ cardRef, slogan, mascot, photos, coverPhoto, isExporting, onDownload, onShare }) {
  const { t } = useI18n();

  return (
    <section className="result-summary-card">
      <ShareCardPreview ref={cardRef} slogan={slogan} mascot={mascot} photos={photos} coverPhoto={coverPhoto} />
      <div className="result-toolbar result-card-toolbar" aria-label={t('result.toolsAria')}>
        <button onClick={onDownload} disabled={isExporting} type="button" aria-label={t('result.downloadAria')}><DownloadIcon /></button>
        <button onClick={onShare} disabled={isExporting} type="button" aria-label={t('result.shareAria')}><ShareIcon /></button>
      </div>
    </section>
  );
}

// History shows a single photo, chosen deterministically as the earliest session
// of that day that still has a locally persisted capture, so the same past day
// always renders the same face. Returns null when nothing is stored, which keeps
// the existing IP-only (mascot) fallback.
function getHistoryCoverPhoto(sceneResults = [], photos = []) {
  const photoByScene = new Map(photos.map((photo) => [photo.sceneId, photo]));
  const sessionIndex = (sceneResults || []).findIndex((entry) => photoByScene.has(entry.sceneId));
  if (sessionIndex === -1) return null;

  return { ...photoByScene.get(sceneResults[sessionIndex].sceneId), sessionIndex };
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

function HistoryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 -960 960 960">
      <path d="m489-460 91-55 91 55-24-104 80-69-105-9-42-98-42 98-105 9 80 69-24 104Zm19 260h224q-7 26-24 42t-44 20L228-85q-33 5-59.5-15.5T138-154L85-591q-4-33 16-59t53-30l46-6v80l-36 5 54 437 290-36Zm-148-80q-33 0-56.5-23.5T280-360v-440q0-33 23.5-56.5T360-880h440q33 0 56.5 23.5T880-800v440q0 33-23.5 56.5T800-280H360Zm0-80h440v-440H360v440Zm220-220ZM218-164Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function PersonalBestIcon() {
  return (
    <svg aria-hidden="true" height="12px" width="12px" viewBox="0 -960 960 960" fill="currentColor">
      <path d="M320-240l160-122 160 122-60-198 160-114H544l-64-208-64 208H220l160 114-60 198ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
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

function getScorePercent(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, (numeric / MAX_RESULT_SCORE) * 100));
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

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.download = filename;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Export timed out.')), timeoutMs);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}
