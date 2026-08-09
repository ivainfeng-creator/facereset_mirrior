import { useEffect, useMemo, useRef, useState } from 'react';
import {
  clearSceneTuningOverrides,
  getSceneTuning,
  getSceneTuningExport,
  loadSceneTuningOverrides,
  saveSceneTuningValue,
} from '../data/interactionTuning.js';
import { STAGE_SECONDS, routineStages } from '../data/routine.js';
import { SCENE_IDS, getSceneById } from '../data/scenes.js';
import { useFaceLandmarks } from '../hooks/useFaceLandmarks.js';
import { useHandTracking } from '../hooks/useHandTracking.js';
import { buildResult, getRoutineFeedback } from '../utils/mockDetection.js';
import {
  consumeTimedEvents,
  createInteractionSignalState,
  createSceneInteractionContract,
  updateInteractionSignal,
} from '../utils/interactionSignal.js';
import { RAW_SCENE_SCORE_MAX, toFinalSceneScore } from '../utils/scoring.js';
import { MirrorVideo } from './MirrorScreen.jsx';

const regularTotalSeconds = STAGE_SECONDS * routineStages.length;
const debugTotalSeconds = 5 * 60;
const MAX_SCENE_SCORE = RAW_SCENE_SCORE_MAX;

export default function RoutineScreen({ selectedScene = SCENE_IDS.whaleDream, stream, isDemoMode, onComplete, onExit }) {
  const videoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const stageRef = useRef(null);
  const mouthProgressRef = useRef(createMouthProgress());
  const templeProgressRef = useRef(createTempleProgress());
  const lemonProgressRef = useRef(createLemonProgress());
  const noseProgressRef = useRef(createNoseProgress());
  const bubbleProgressRef = useRef(createBubbleProgress());
  const latestInputsRef = useRef({
    features: null,
    fingertips: { left: null, right: null, all: [] },
    templeTargets: null,
    lemonTargets: null,
  });
  const snapshotFramesRef = useRef([]);
  const snapshotTargetsRef = useRef([0.12, 0.3, 0.48, 0.66, 0.84]);
  const [elapsed, setElapsed] = useState(0);
  const [interactionTick, setInteractionTick] = useState(0);
  const [stageScores, setStageScores] = useState({});
  const [interaction, setInteraction] = useState(() => createBaseInteraction(selectedScene));
  const [tuningRevision, setTuningRevision] = useState(0);
  const debugEnabled = isInteractionDebugEnabled();
  const activeTotalSeconds = debugEnabled ? debugTotalSeconds : regularTotalSeconds;
  const activeStageSeconds = activeTotalSeconds / routineStages.length;

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    if (previewVideoRef.current && stream) {
      previewVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  const { containerSize, detectorMode, displayRect, features, hasLandmarks } = useFaceLandmarks({
    videoRef,
    stageRef,
    stream,
    isDemoMode,
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed((current) => {
        const next = Math.min(activeTotalSeconds, current + 1);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeTotalSeconds]);

  useEffect(() => {
    const timer = window.setInterval(() => setInteractionTick((current) => current + 1), 50);
    return () => window.clearInterval(timer);
  }, []);

  const stageIndex = Math.min(routineStages.length - 1, Math.floor(elapsed / activeStageSeconds));
  const stage = routineStages[stageIndex];
  const stageElapsed = elapsed - stageIndex * activeStageSeconds;
  const stageProgress = Math.min(1, stageElapsed / activeStageSeconds);
  const globalProgress = Math.min(1, elapsed / activeTotalSeconds);
  const secondsLeft = Math.max(0, activeTotalSeconds - elapsed);
  const feedback = useMemo(
    () => getRoutineFeedback(stageIndex, stageProgress, globalProgress),
    [stageIndex, stageProgress, globalProgress],
  );
  const templeTargets = useMemo(
    () => createTemplePressTargets(features, containerSize),
    [containerSize, features],
  );
  const templeTrajectories = useMemo(
    () => createTemplePressTrajectories(templeTargets, containerSize),
    [containerSize, templeTargets],
  );
  const lemonTargets = useMemo(
    () => createLemonPressTargets(features, containerSize),
    [containerSize, features],
  );
  const lemonTrajectories = useMemo(
    () => createLemonPressTrajectories(lemonTargets, containerSize),
    [containerSize, lemonTargets],
  );
  const { fingertips, handMode } = useHandTracking({
    videoRef,
    stream,
    isDemoMode,
    displayRect,
    trajectories: selectedScene === SCENE_IDS.templeGarden
      ? templeTrajectories
      : selectedScene === SCENE_IDS.lemonSqueeze
        ? lemonTrajectories
        : undefined,
  });
  const sceneTuning = useMemo(() => getSceneTuning(selectedScene), [selectedScene, tuningRevision]);
  const tuningOverrides = useMemo(() => loadSceneTuningOverrides(selectedScene), [selectedScene, tuningRevision]);

  useEffect(() => {
    latestInputsRef.current = { features, fingertips, templeTargets, lemonTargets };
  }, [features, fingertips, lemonTargets, templeTargets]);

  useEffect(() => {
    mouthProgressRef.current = createMouthProgress();
    templeProgressRef.current = createTempleProgress();
    lemonProgressRef.current = createLemonProgress();
    noseProgressRef.current = createNoseProgress();
    bubbleProgressRef.current = createBubbleProgress();
    setInteraction(createBaseInteraction(selectedScene));
  }, [selectedScene, stage.id]);

  useEffect(() => {
    const now = performance.now();
    const currentInputs = latestInputsRef.current;
    const tuning = sceneTuning;
    let nextInteraction;

    if (selectedScene === SCENE_IDS.templeGarden) {
      nextInteraction = scoreTemplePress({
          features: currentInputs.features,
          fingertips: currentInputs.fingertips,
          targets: currentInputs.templeTargets,
          timestamp: now,
          progressState: templeProgressRef.current,
          stageProgress,
          tuning,
        });
    } else if (selectedScene === SCENE_IDS.lemonSqueeze) {
      nextInteraction = scoreLemonSqueeze({
        features: currentInputs.features,
        fingertips: currentInputs.fingertips,
        targets: currentInputs.lemonTargets,
        timestamp: now,
        progressState: lemonProgressRef.current,
        stageProgress,
        tuning,
      });
    } else if (selectedScene === SCENE_IDS.flowerCollector) {
      nextInteraction = scoreNoseSniff({
        features: currentInputs.features,
        timestamp: now,
        progressState: noseProgressRef.current,
        stageProgress,
        tuning,
      });
    } else if (selectedScene === SCENE_IDS.bubbleGumBunny) {
      nextInteraction = scoreCheekPuff({
        features: currentInputs.features,
        timestamp: now,
        progressState: bubbleProgressRef.current,
        stageProgress,
        tuning,
      });
    } else {
      nextInteraction = scoreMouthOpening({
          features: currentInputs.features,
          timestamp: now,
          progressState: mouthProgressRef.current,
          stageProgress,
          tuning,
        });
    }

    const contract = createSceneInteractionContract({
      sceneId: selectedScene,
      interaction: nextInteraction,
      tracking: {
        detectorMode,
        handMode,
        hasLandmarks,
        isDemoMode,
      },
      features: currentInputs.features,
      fingertips: currentInputs.fingertips,
    });

    setInteraction({
      ...nextInteraction,
      contract,
    });
  }, [detectorMode, handMode, hasLandmarks, interactionTick, isDemoMode, sceneTuning, selectedScene, stageProgress]);

  useEffect(() => {
    const nextTarget = snapshotTargetsRef.current[0];
    if (nextTarget === undefined || globalProgress < nextTarget) return;

    const snapshot = captureRoutineSnapshot({
      video: videoRef.current,
      isDemoMode,
      progress: globalProgress,
      score: toFinalSceneScore(interaction.score),
    });

    if (snapshot) {
      snapshotFramesRef.current = [...snapshotFramesRef.current, snapshot].slice(-5);
      snapshotTargetsRef.current = snapshotTargetsRef.current.slice(1);
    }
  }, [globalProgress, interaction.score, isDemoMode]);

  useEffect(() => {
    setStageScores((current) => ({
      ...current,
      [selectedScene]: Math.max(current[selectedScene] || 0, interaction.score),
    }));
  }, [interaction.score, selectedScene]);

  const rawDisplayScore = Math.max(stageScores[selectedScene] || 0, interaction.score);
  const displayScore = toFinalSceneScore(rawDisplayScore);
  const finishRoutine = () => {
    onComplete(buildResult(
      {
        ...stageScores,
        [selectedScene]: rawDisplayScore,
      },
      snapshotFramesRef.current,
      selectedScene,
    ));
  };

  useEffect(() => {
    if (elapsed >= activeTotalSeconds) {
      finishRoutine();
    }
  }, [activeTotalSeconds, elapsed]);

  const handleTuningChange = (section, key, value) => {
    saveSceneTuningValue(selectedScene, section, key, value);
    setTuningRevision((current) => current + 1);
  };

  const handleTuningReset = () => {
    clearSceneTuningOverrides(selectedScene);
    setTuningRevision((current) => current + 1);
  };

  return (
    <section className="screen routine-screen play-routine-screen">
      <div className="routine-layout play-routine-layout">
        <div className="mirror-stage routine-mirror play-routine-mirror" ref={stageRef}>
          {selectedScene === SCENE_IDS.templeGarden ? (
            <TempleGardenScene interaction={interaction} targets={templeTargets} />
          ) : selectedScene === SCENE_IDS.lemonSqueeze ? (
            <LemonSqueezeScene interaction={interaction} />
          ) : selectedScene === SCENE_IDS.flowerCollector ? (
            <FlowerCollectorScene interaction={interaction} />
          ) : selectedScene === SCENE_IDS.bubbleGumBunny ? (
            <BubbleGumBunnyScene interaction={interaction} />
          ) : selectedScene === SCENE_IDS.whaleDream2 ? (
            <WhaleDream2Scene interaction={interaction} />
          ) : (
            <WhaleDreamScene interaction={interaction} />
          )}
          <TrackingVideo videoRef={videoRef} isDemoMode={isDemoMode} />
          <CameraPreview
            detectorMode={detectorMode}
            handMode={[SCENE_IDS.whaleDream, SCENE_IDS.whaleDream2].includes(selectedScene) ? interaction.isOpen ? 'good-flow' : 'mouth-ready' : handMode}
            isDemoMode={isDemoMode}
            previewVideoRef={previewVideoRef}
            stream={stream}
          />

          <button className="play-close-button" onClick={onExit} aria-label="Close routine" />

          <div className="play-score">
            <span>Score</span>
            <strong>{displayScore}</strong>
          </div>

          <div className="play-timer timer-ring" style={{ '--progress': `${globalProgress * 360}deg` }}>
            <span>{formatTime(secondsLeft)}</span>
            <small>~~~</small>
          </div>

          <div className="play-feedback">
            {interaction.feedback || feedback.label}
          </div>

          {debugEnabled ? (
            <InteractionDebugPanel
              contract={interaction.contract}
              onChange={handleTuningChange}
              onFinish={finishRoutine}
              onReset={handleTuningReset}
              overrides={tuningOverrides}
              tuning={sceneTuning}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function createBaseInteraction(sceneId) {
  const interaction = {
    score: 0,
    completion: 0,
    feedback: getInitialFeedback(sceneId),
    isOnTrack: false,
    mouthOpen: 0,
    flow: 0,
    fishBurst: 0,
    fishCount: 0,
    isOpen: false,
    leftPress: 0,
    rightPress: 0,
    rain: 0,
    growth: 0,
    gardenCycle: 0,
    ripple: 0,
    isPressing: false,
    squeeze: 0,
    sodaLevel: 0.16,
    ingredientStage: 0,
    sip: 0,
    isSqueezing: false,
    sniff: 0,
    flowerCount: 0,
    isSniffing: false,
    puff: 0,
    bubbleSize: 0.07,
    bubbleStage: 0,
    bubblePops: 0,
    justPopped: false,
    combo: 0,
    isPuffing: false,
    sync: 0,
    clarity: 0,
    phase: 'idle',
  };

  return {
    ...interaction,
    contract: createSceneInteractionContract({ sceneId, interaction }),
  };
}

function InteractionDebugPanel({ contract, onChange, onFinish, onReset, overrides, tuning }) {
  const [copyState, setCopyState] = useState('複製 JSON');
  const [isCollapsed, setIsCollapsed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1100px)').matches,
  );

  if (!contract) return null;

  const contractRows = [
    ['action', formatActionType(contract.actionType)],
    ['phase', formatSignalPhase(contract.primary.phase)],
    ['value', toPercent(contract.primary.value)],
    ['active', formatDebugValue(contract.primary.active)],
    ['stable', formatDebugValue(contract.primary.stable)],
    ['hold', `${contract.primary.holdSeconds.toFixed(1)} 秒`],
    ['score', contract.game.score],
    ['combo', contract.game.combo],
    ['face', contract.tracking.faceReady ? formatDebugDetectorMode(contract.tracking.detectorMode) : '尚未就緒'],
    [
      'hand',
      contract.tracking.requiresHands
        ? contract.tracking.handReady
          ? formatDebugDetectorMode(contract.tracking.handMode)
          : '尚未就緒'
        : '不需要',
    ],
  ];
  const inputRows = getDebugRows(tuning?.input);
  const signalRows = getDebugRows(tuning?.signal);
  const scoringRows = getDebugRows(tuning?.scoring);
  const handleCopy = async () => {
    try {
      await window.navigator.clipboard.writeText(getSceneTuningExport(contract.sceneId));
      setCopyState('已複製');
    } catch {
      setCopyState('複製失敗');
    }
    window.setTimeout(() => setCopyState('複製 JSON'), 1400);
  };

  return (
    <aside
      className={`interaction-debug-panel ${isCollapsed ? 'is-collapsed' : ''}`}
      aria-label="場景調參面板"
    >
      <header>
        <span>場景調參</span>
        <strong>{getSceneDebugTitle(contract.sceneId)}</strong>
        <p>這裡只影響本機測試數值，不會直接改正式設定。</p>
        <div className="interaction-debug-actions">
          <button type="button" onClick={() => setIsCollapsed((current) => !current)}>
            {isCollapsed ? '展開' : '收合'}
          </button>
          <button className="debug-panel-secondary-action" type="button" onClick={onReset}>重設</button>
          <button className="debug-panel-secondary-action" type="button" onClick={onFinish}>結束測試</button>
          <button className="debug-panel-secondary-action" type="button" onClick={handleCopy}>{copyState}</button>
        </div>
      </header>
      <div className="interaction-debug-body">
        <DebugSection help="目前模型讀到的即時互動狀態，用來判斷動作是不是有被穩定抓到。" title="即時偵測" rows={contractRows} />
        {inputRows.length ? (
          <TuningSection
            help="把臉部偵測原始值轉成 0-100% 的互動強度。通常先調這區，會直接影響靈敏度。"
            onChange={onChange}
            overrides={overrides?.input}
            rows={inputRows}
            section="input"
            title="輸入映射"
          />
        ) : null}
        {signalRows.length ? (
          <TuningSection
            help="控制什麼時候算開始、什麼時候算放開，以及進入狀態要多快。"
            onChange={onChange}
            overrides={overrides?.signal}
            rows={signalRows}
            section="signal"
            title="觸發判斷"
          />
        ) : null}
        {scoringRows.length ? (
          <TuningSection
            help="控制分數、combo、特殊事件和畫面進度。它不影響偵測靈敏度，只影響回饋節奏。"
            onChange={onChange}
            overrides={overrides?.scoring}
            rows={scoringRows}
            section="scoring"
            title="分數與節奏"
          />
        ) : null}
      </div>
    </aside>
  );
}

function DebugSection({ title, help, rows }) {
  return (
    <section className="interaction-debug-section">
      <h2>{title}</h2>
      {help ? <p>{help}</p> : null}
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{getDebugLabel(label)}</dt>
            <dd>{formatDebugValue(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function TuningSection({ title, help, rows, section, overrides = {}, onChange }) {
  return (
    <section className="interaction-debug-section tuning-section">
      <h2>{title}</h2>
      {help ? <p>{help}</p> : null}
      <div className="tuning-control-list">
        {rows.map(([key, value]) => {
          const bounds = getTuningBounds(key, value);
          const isOverridden = Object.prototype.hasOwnProperty.call(overrides, key);
          const hint = getTuningHint(key);

          return (
            <label className={`tuning-control ${isOverridden ? 'is-overridden' : ''}`} key={`${section}-${key}`}>
              <span>
                <b>{getTuningLabel(key)}</b>
                <em>{formatDebugValue(value)}</em>
                <small>{key}</small>
              </span>
              {hint ? <p>{hint}</p> : null}
              <input
                type="range"
                min={bounds.min}
                max={bounds.max}
                step={bounds.step}
                value={value}
                onChange={(event) => onChange(section, key, parseTuningValue(event.target.value, value))}
              />
              <input
                type="number"
                min={bounds.min}
                max={bounds.max}
                step={bounds.step}
                value={value}
                onChange={(event) => onChange(section, key, parseTuningValue(event.target.value, value))}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}

function getDebugRows(values = {}) {
  return Object.entries(values).filter(([, value]) => value !== undefined && value !== null);
}

function formatDebugValue(value) {
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '-';
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(value < 1 ? 2 : 1).replace(/\.0$/, '');
  }
  return value || '-';
}

function getSceneDebugTitle(sceneId) {
  const scene = getSceneById(sceneId);
  return scene ? `${scene.title} · ${scene.action}` : sceneId;
}

function formatActionType(actionType) {
  const labels = {
    mouth_open: '張嘴',
    dual_press: '雙側按壓',
    nose_sniff: '皺鼻 / 聞香',
    cheek_puff: '鼓嘴',
  };
  return labels[actionType] || actionType;
}

function formatSignalPhase(phase) {
  const labels = {
    idle: '等待動作',
    entering: '正在進入',
    holding: '穩定維持',
    releasing: '正在放開',
  };
  return labels[phase] || phase;
}

function formatDebugDetectorMode(mode) {
  if (mode === 'real-landmark') return '真實 landmarks';
  if (mode === 'mock-landmark') return '模擬 landmarks';
  if (mode === 'real-hand') return '真實手勢';
  if (mode === 'mock-hand') return '模擬手勢';
  if (mode === 'good-flow') return '狀態良好';
  if (mode === 'mouth-ready') return '等待張嘴';
  return 'Demo';
}

function getDebugLabel(key) {
  const labels = {
    action: '動作類型',
    phase: '目前階段',
    value: '互動強度',
    active: '是否觸發',
    stable: '是否穩定',
    hold: '維持時間',
    score: '目前分數',
    combo: '連續次數',
    fishCount: '吃進魚數',
    flowerCount: '收集花數',
    gardenCycle: '花園循環',
    bubblePops: '泡泡爆破次數',
    justPopped: '剛剛爆破',
    face: '臉部偵測',
    hand: '手勢偵測',
  };
  return labels[key] || key;
}

function getTuningLabel(key) {
  const labels = {
    baseline: '基準值',
    range: '有效幅度',
    wideThreshold: '大動作門檻',
    strongThreshold: '強動作門檻',
    enterThreshold: '開始觸發門檻',
    releaseThreshold: '放開門檻',
    activateMs: '觸發延遲',
    releaseMs: '放開延遲',
    missingToleranceMs: '短暫遺失容忍',
    attackSeconds: '進入速度',
    releaseSeconds: '回落速度',
    oneSideHintThreshold: '單側提示門檻',
    balanceHintThreshold: '平衡提示門檻',
    syncBonusThreshold: '同步獎勵門檻',
    completedHoldSeconds: '完成所需維持',
    flowBase: '基礎流動速度',
    flowByValue: '強度加速',
    flowByBalance: '平衡加速',
    decay: '回落速度',
    minimumFlow: '最低流動值',
    eventBase: '基礎事件量',
    eventByValue: '強度事件加成',
    eventByBalance: '平衡事件加成',
    stableEventBonus: '穩定事件加成',
    strongEventBonus: '強動作加成',
    holdScore: '維持加分',
    balancedHoldScore: '平衡維持加分',
    releaseHoldSeconds: '放開前需維持',
    releaseScore: '完成一次加分',
    comboReleaseScore: '連續完成加分',
    longHoldSeconds: '長維持秒數',
    longHoldScore: '長維持加分',
    longHoldBonusScore: '長維持額外分',
    syncBonusScore: '同步獎勵分',
    specialEvery: '特殊事件間隔',
    specialScore: '特殊事件分數',
    completionModulo: '進度循環長度',
    growthBase: '基礎成長',
    growthByCycle: '循環成長',
    growthByFlow: '流動成長',
    growthByValue: '強度成長',
    sodaBase: '汽水基礎上升',
    sodaBySqueeze: '擠壓上升',
    sodaByBalance: '平衡上升',
    minSodaLevel: '最低液面',
    maxSodaLevel: '最高液面',
    ingredientOffset: '配料起始點',
    ingredientMultiplier: '配料速度',
    ingredientScore: '配料加分',
    sipSeconds: '偷喝觸發時間',
    sipScore: '偷喝加分',
    sipDropBase: '偷喝下降量',
    sipDropStep: '偷喝下降增量',
    sipMinAfterDrop: '偷喝後最低液面',
    sipMaxAfterDrop: '偷喝後最高液面',
    sipBaseLevel: '偷喝起始液面',
    sipLevelStep: '偷喝液面增量',
    sipHintLevel: '偷喝提示液面',
    minBubbleSize: '泡泡最小值',
    maxBubbleSize: '泡泡最大值',
    holdBonusSeconds: '維持獎勵秒數',
    holdEventRate: '維持事件速度',
    holdEventScore: '維持事件加分',
    stageMultiplier: '階段倍率',
    stageScore: '階段加分',
    popThreshold: '爆破門檻',
    popHoldSeconds: '爆破維持秒數',
    resetSize: '重置大小',
    resetStage: '重置階段',
    popScore: '爆破分數',
    comboBonusScore: '連續獎勵分',
  };
  return labels[key] || key;
}

function getTuningHint(key) {
  const hints = {
    baseline: '原始偵測值低於這裡時，會被視為沒有動作。太高會變不敏感。',
    range: '從基準值到滿格需要多少變化量。越小越敏感，越大越穩但比較難觸發。',
    wideThreshold: '張嘴多大才算「張很開」，通常影響 special / 強回饋。',
    strongThreshold: '皺鼻或吸氣多強才算強動作。',
    enterThreshold: '互動強度超過這個值才開始算觸發。調低比較敏感，調高比較不誤觸。',
    releaseThreshold: '互動強度低於這個值才算放開。通常要比開始門檻低，避免一直抖動。',
    activateMs: '動作需要維持幾毫秒才正式觸發。越短越快，越長越穩。',
    releaseMs: '放開需要持續幾毫秒才正式結束。越長越不容易誤判放開。',
    attackSeconds: '畫面反應追上動作的速度。越小越即時。',
    releaseSeconds: '放開後畫面回落的速度。越小回得越快。',
    flowBase: '就算動作不強，畫面仍然推進的基礎速度。',
    flowByValue: '動作越強時，畫面推進加速多少。',
    decay: '動作停止後，畫面能量下降速度。',
    eventBase: '每秒基本產生多少事件，例如魚、花、泡泡。',
    eventByValue: '動作越強時，事件增加多少。',
    releaseScore: '完成一次動作循環時給的分數。',
    syncBonusThreshold: '左右動作同步度超過這裡才有 bonus。',
    syncBonusScore: '左右同步成功時加多少分。',
    completionModulo: '控制畫面進度循環速度；數字越大，進度看起來越慢。',
    growthByValue: '動作越強，泡泡或植物成長越快。',
  };
  return hints[key] || '這是該場景的調參值。調整後會即時影響本機測試，但不會直接寫入正式檔案。';
}

function getTuningBounds(key, value) {
  if (key.toLowerCase().includes('ms')) return { min: 0, max: 1000, step: 10 };
  if (key.toLowerCase().includes('seconds')) return { min: 0, max: 5, step: 0.05 };
  if (key.toLowerCase().includes('score')) return { min: 0, max: 20, step: 1 };
  if (key.toLowerCase().includes('every') || key.toLowerCase().includes('modulo')) {
    return { min: 1, max: 80, step: 1 };
  }
  if (key.toLowerCase().includes('multiplier')) return { min: 0, max: 12, step: 0.1 };
  if (value <= 1) return { min: 0, max: 1, step: 0.01 };
  return { min: 0, max: Math.max(10, Math.ceil(value * 2)), step: 0.1 };
}

function parseTuningValue(value, previousValue) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) return previousValue;
  return Number.isInteger(previousValue) ? Math.round(nextValue) : nextValue;
}

function TempleGardenScene({ interaction }) {
  const leftRain = clamp(interaction.leftRain || 0, 0, 1);
  const rightRain = clamp(interaction.rightRain || 0, 0, 1);
  const rain = Math.max(leftRain, rightRain);
  const growth = clamp(interaction.growth || 0, 0, 1);
  const gardenSlots = [
    { id: 'left-back', x: '10%', offset: 0.12, duration: 0.42, scale: 0.72, rise: 12, stemHeight: 108, stemTilt: -11, leafTilt: -7, flowerScale: 0.78, flowerVariant: 'daisy', depth: 2 },
    { id: 'left-front', x: '29%', offset: 0.05, duration: 0.36, scale: 0.96, rise: 2, stemHeight: 140, stemTilt: 8, leafTilt: 7, flowerScale: 0.92, flowerVariant: 'round', depth: 5 },
    { id: 'center', x: '50%', offset: 0.01, duration: 0.31, scale: 1.02, rise: 9, stemHeight: 156, stemTilt: -4, leafTilt: -4, flowerScale: 1, flowerVariant: 'layered', depth: 4 },
    { id: 'right-front', x: '72%', offset: 0.21, duration: 0.5, scale: 0.93, rise: 1, stemHeight: 132, stemTilt: 11, leafTilt: 9, flowerScale: 0.88, flowerVariant: 'daisy', depth: 5 },
    { id: 'right-back', x: '91%', offset: 0.4, duration: 0.58, scale: 0.7, rise: 16, stemHeight: 112, stemTilt: -9, leafTilt: -10, flowerScale: 0.74, flowerVariant: 'round', depth: 2 },
  ].map((slot) => ({
    ...slot,
    growth: clamp((growth - slot.offset) / slot.duration, 0, 1),
  }));
  const drops = useMemo(
    () =>
      Array.from({ length: 38 }, (_, index) => {
        const isLeftSource = index % 2 === 0;
        const laneOffset = (index % 7) - 3;
        const cloudCenter = isLeftSource ? 108 : 276;
        return {
          id: index,
          source: isLeftSource ? 'left' : 'right',
          // These match the actual centers of the two 120px clouds in the 384px scene.
          x: cloudCenter + laneOffset * 11,
          y: 316 + ((index * 23) % 58),
          drift: isLeftSource ? 38 + (index % 4) * 4 : -38 - (index % 4) * 4,
          delay: (index % 13) * 0.09,
          length: 15 + (index % 5) * 6,
          sparkle: index % 7 === 0,
        };
      }),
    [],
  );

  return (
    <div
      className={`temple-garden-scene ${rain > 0.06 ? 'is-pressing' : ''}`}
      style={{
        '--rain': rain,
        '--left-rain': leftRain,
        '--right-rain': rightRain,
        '--growth': growth,
        '--ripple': interaction.ripple || 0,
      }}
      aria-hidden="true"
    >
      <div className="temple-copy">
        <h1>Cloud Garden</h1>
        <p>Press both temples and let the garden breathe</p>
      </div>

      <div className="garden-cloud garden-cloud-left">
        <span />
        <span />
        <span />
      </div>
      <div className="garden-cloud garden-cloud-right">
        <span />
        <span />
        <span />
      </div>

      <div className="garden-rain">
        {drops.map((drop) => (
          <span
            key={drop.id}
            className={`${drop.source} ${drop.sparkle ? 'is-nourishing' : ''}`}
            style={{
              '--drop-x': `${drop.x}px`,
              '--drop-y': `${drop.y}px`,
              '--drop-drift': `${drop.drift}px`,
              '--drop-delay': `${drop.delay}s`,
              '--drop-length': `${drop.length}px`,
            }}
          />
        ))}
      </div>

      <div className="garden-pond">
        <span className="pond-ripple one" />
        <span className="pond-ripple two" />
        <span className="pond-ripple three" />
      </div>

      <div className="garden-growth-zone">
        <span className="garden-impact one" />
        <span className="garden-impact two" />
        <span className="garden-impact three" />
        <span className="garden-impact four" />
        <span className="garden-nutrient one" />
        <span className="garden-nutrient two" />
        <span className="garden-nutrient three" />
        <div className="garden-soil">
          {gardenSlots.map((slot) => (
            <span
              key={`${slot.id}-seed`}
              className="garden-seed"
              style={{
                '--slot-x': slot.x,
                '--slot-growth': slot.growth,
                '--slot-scale': slot.scale,
                '--slot-rise': `${slot.rise}px`,
              }}
            />
          ))}
        </div>
        {gardenSlots.map((slot) => (
          <div
            key={slot.id}
            className={`garden-plant-slot ${slot.id}`}
            style={{
              '--slot-x': slot.x,
              '--slot-growth': slot.growth,
              '--slot-scale': slot.scale,
              '--slot-rise': `${slot.rise}px`,
              '--stem-height': `${slot.stemHeight}px`,
              '--stem-tilt': `${slot.stemTilt}deg`,
              '--leaf-tilt': `${slot.leafTilt}deg`,
              '--flower-scale': slot.flowerScale,
              '--slot-depth': slot.depth,
            }}
            aria-label={`Garden plant ${slot.id}`}
          >
            <span className="plant-axis">
              <span className="plant-stem" />
              <span className="plant-sprout" />
              <span className="plant-leaf leaf-left one" />
              <span className="plant-leaf leaf-right one" />
              <span className="plant-leaf leaf-left two" />
              <span className="plant-leaf leaf-right two" />
              <span className="plant-bud" />
              <span className={`plant-flower ${slot.flowerVariant}`}>
                <i />
                <i />
                <i />
                <i />
                <i />
                <b />
              </span>
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}

function LemonSqueezeScene({ interaction }) {
  const squeeze = clamp(interaction.squeeze || 0, 0, 1);
  const sodaLevel = clamp(interaction.sodaLevel || 0.16, 0.1, 0.94);
  const sip = clamp(interaction.sip || 0, 0, 1);
  const ingredientStage = interaction.ingredientStage || 0;
  const bubbles = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        id: index,
        x: 22 + ((index * 31) % 56),
        y: 19 + ((index * 43) % 70),
        size: 4 + (index % 5) * 2,
        delay: (index % 11) * 0.14,
        duration: 1.8 + (index % 6) * 0.22,
      })),
    [],
  );
  const fizz = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        x: 7 + ((index * 29) % 86),
        y: 12 + ((index * 47) % 66),
        delay: (index % 9) * 0.11,
      })),
    [],
  );

  return (
    <div
      className={`lemon-squeeze-scene ${interaction.isSqueezing ? 'is-squeezing' : ''}`}
      style={{
        '--squeeze': squeeze,
        '--left-squeeze': clamp(interaction.leftPress || 0, 0, 1),
        '--right-squeeze': clamp(interaction.rightPress || 0, 0, 1),
        '--soda-level': sodaLevel,
        '--sip': sip,
        '--combo': interaction.combo || 0,
      }}
      aria-hidden="true"
    >
      <div className="lemon-copy">
        <h1>Lemon Squeeze</h1>
        <p>Press both sides and make a tiny summer soda</p>
      </div>

      <div className="lemon-sun" />
      <div className="lemon-arc one" />
      <div className="lemon-arc two" />

      <div className="lemon-half left">
        <span className="lemon-face" />
      </div>
      <div className="lemon-half right">
        <span className="lemon-face" />
      </div>

      <div className="juice-stream left">
        <span />
        <span />
        <span />
      </div>
      <div className="juice-stream right">
        <span />
        <span />
        <span />
      </div>

      <div className="soda-glass">
        <div className="soda-liquid">
          <span className="soda-surface" />
          {bubbles.map((bubble) => (
            <span
              key={bubble.id}
              className="soda-bubble"
              style={{
                '--bubble-x': `${bubble.x}%`,
                '--bubble-y': `${bubble.y}%`,
                '--bubble-size': `${bubble.size}px`,
                '--bubble-delay': `${bubble.delay}s`,
                '--bubble-duration': `${bubble.duration}s`,
              }}
            />
          ))}
        </div>
        <span className={`soda-ice one ${ingredientStage >= 1 ? 'is-visible' : ''}`} />
        <span className={`soda-ice two ${ingredientStage >= 2 ? 'is-visible' : ''}`} />
        <span className={`soda-slice ${ingredientStage >= 3 ? 'is-visible' : ''}`} />
        <span className={`soda-mint ${ingredientStage >= 4 ? 'is-visible' : ''}`} />
        <span className="soda-straw" />
      </div>

      <div className="lemon-fizz-layer">
        {fizz.map((spark) => (
          <span
            key={spark.id}
            style={{
              '--fizz-x': `${spark.x}%`,
              '--fizz-y': `${spark.y}%`,
              '--fizz-delay': `${spark.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="soda-sipper">
        <span className="sipper-ear left" />
        <span className="sipper-ear right" />
        <span className="sipper-face" />
      </div>

    </div>
  );
}

function WhaleDreamScene({ interaction }) {
  const mouthOpen = clamp(interaction.mouthOpen || 0, 0, 1);
  const fishCount = interaction.fishCount || 0;
  const fishWave = fishCount % 18;
  const mouthCenter = { x: 194, y: 446 };
  const ambientFish = useMemo(
    () =>
      Array.from({ length: 34 }, (_, index) => {
        const fromLeft = index % 2 === 0;
        return {
          id: index,
          side: fromLeft ? 'from-left' : 'from-right',
          x: fromLeft ? -38 - (index % 7) * 16 : 394 + (index % 7) * 16,
          y: 238 + ((index * 37) % 318),
          swimX: fromLeft ? 450 + ((index * 19) % 90) : -450 - ((index * 19) % 90),
          bobY: -18 + (index % 5) * 9,
          delay: (index % 17) * -0.42,
          duration: 7.2 + (index % 8) * 0.45,
          size: 0.42 + (index % 6) * 0.08,
          special: index % 19 === 0,
        };
      }),
    [],
  );
  const fish = useMemo(
    () =>
      Array.from({ length: 42 }, (_, index) => {
        const fromLeft = index % 2 === 0;
        const sideOffset = 24 + ((index * 31) % 96);
        const startX = fromLeft ? -36 - sideOffset : 392 + sideOffset;
        const startY = 232 + ((index * 43) % 274);
        const mouthX = mouthCenter.x + ((index * 13) % 16) - 8;
        const mouthY = mouthCenter.y + ((index * 17) % 14) - 7;

        return {
          id: index,
          delay: (index % 14) * 0.115,
          duration: 0.92 + (index % 8) * 0.075,
          size: 0.58 + (index % 6) * 0.1,
          x: startX,
          y: startY,
          driftX: mouthX - startX,
          driftY: mouthY - startY,
          cruiseX: fromLeft ? 128 + ((index * 23) % 86) : -128 - ((index * 23) % 86),
          cruiseY: -20 + (index % 7) * 7,
          side: fromLeft ? 'from-left' : 'from-right',
          special: index % 17 === 0,
        };
      }),
    [],
  );
  const stars = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        id: index,
        x: 8 + ((index * 23) % 86),
        y: 4 + ((index * 37) % 62),
        size: 1 + (index % 4) * 0.5,
      })),
    [],
  );

  const upperMouth = 387 - mouthOpen * 54;
  const lowerMouth = 395 + mouthOpen * 96;
  const leftMouth = 92 - mouthOpen * 5;
  const rightMouth = 248 + mouthOpen * 15;
  const mouthPath = [
    `M ${leftMouth} ${upperMouth}`,
    `C ${124 + mouthOpen * 2} ${354 - mouthOpen * 38} ${196 + mouthOpen * 4} ${342 - mouthOpen * 28} ${rightMouth} ${367 - mouthOpen * 15}`,
    `C ${231 + mouthOpen * 10} ${393 + mouthOpen * 72} ${158 - mouthOpen * 3} ${422 + mouthOpen * 82} ${leftMouth} ${lowerMouth}`,
    `C ${75 - mouthOpen * 10} ${395 + mouthOpen * 18} ${75 - mouthOpen * 12} ${383 - mouthOpen * 14} ${leftMouth} ${upperMouth}`,
    'Z',
  ].join(' ');

  return (
    <div
      className={`whale-dream-scene ${interaction.isOpen ? 'is-open' : ''}`}
      style={{
        '--mouth-open': mouthOpen,
        '--flow': interaction.flow || 0,
        '--fish-wave': fishWave,
        '--mouth-x': `${mouthCenter.x}px`,
        '--mouth-y': `${mouthCenter.y}px`,
      }}
      aria-hidden="true"
    >
      <div className="whale-stars">
        {stars.map((star) => (
          <span
            key={star.id}
            style={{
              '--star-x': `${star.x}%`,
              '--star-y': `${star.y}%`,
              '--star-size': `${star.size}px`,
              '--star-delay': `${(star.id % 9) * 0.22}s`,
            }}
          />
        ))}
      </div>
      <div className="whale-copy">
        <h1>Whale Mouth</h1>
        <p>Open wide and guide little fish in</p>
      </div>
      <svg className="whale-svg" viewBox="0 0 375 620" role="img" aria-label="Dream whale">
        <defs>
          <radialGradient id="whaleGlow" cx="38%" cy="46%" r="65%">
            <stop offset="0%" stopColor="#8cb5ff" />
            <stop offset="58%" stopColor="#4267c7" />
            <stop offset="100%" stopColor="#22357f" />
          </radialGradient>
          <radialGradient id="mouthGlow" cx="54%" cy="50%" r="62%">
            <stop offset="0%" stopColor="#fff3a9" />
            <stop offset="44%" stopColor="#ffaed2" />
            <stop offset="100%" stopColor="#5d3a90" />
          </radialGradient>
          <linearGradient id="seaGlow" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e7b9ff" stopOpacity="0.74" />
            <stop offset="100%" stopColor="#71e6ff" stopOpacity="0.18" />
          </linearGradient>
        </defs>

        <path className="whale-water" d="M 0 510 C 70 482 132 534 200 504 C 270 474 316 493 375 468 L 375 620 L 0 620 Z" />
        <path
          className="whale-body"
          d="M 101 335 C 111 210 207 161 284 227 C 350 283 344 431 286 495 C 220 568 119 518 89 430 C 59 412 52 372 101 335 Z"
        />
        <path className="whale-belly" d="M 103 368 C 135 328 200 320 248 350 C 231 427 174 470 102 424 C 78 409 76 384 103 368 Z" />
        <path className="whale-mouth-glow" d={mouthPath} />
        <path className="whale-mouth-line" d={`M ${leftMouth + 2} ${upperMouth + 7} C 127 ${354 - mouthOpen * 36} 197 ${343 - mouthOpen * 27} ${rightMouth} ${365 - mouthOpen * 14}`} />
        <path className="whale-eye" d="M 262 323 C 268 344 291 344 297 323" />
        <circle className="whale-cheek" cx="300" cy="369" r="18" />
        <path className="whale-tail" d="M 314 432 C 360 407 354 354 371 342 C 389 383 378 439 337 462 C 366 470 377 501 364 531 C 336 512 313 486 314 432 Z" />
        <path className="whale-spray" d="M 167 217 C 152 180 142 158 125 132 M 182 215 C 184 174 200 153 219 130 M 192 223 C 228 190 250 170 272 148" />
      </svg>

      <div className="ambient-fish-layer">
        {ambientFish.map((item) => (
          <span
            key={item.id}
            className={`ambient-fish ${item.side} ${item.special ? 'is-special' : ''}`}
            style={{
              '--ambient-x': `${item.x}px`,
              '--ambient-y': `${item.y}px`,
              '--ambient-swim-x': `${item.swimX}px`,
              '--ambient-mid-x': `${item.swimX * 0.48}px`,
              '--ambient-bob-y': `${item.bobY}px`,
              '--ambient-scale': item.size,
              '--ambient-delay': `${item.delay}s`,
              '--ambient-duration': `${item.duration}s`,
            }}
          />
        ))}
      </div>
      <div className="fish-layer">
        {fish.map((item) => (
          <span
            key={item.id}
            className={`dream-fish ${item.side} ${item.special ? 'is-special' : ''}`}
            style={{
              '--fish-x': `${item.x}px`,
              '--fish-y': `${item.y}px`,
              '--drift-x': `${item.driftX}px`,
              '--drift-y': `${item.driftY}px`,
              '--cruise-x': `${item.cruiseX}px`,
              '--cruise-y': `${item.cruiseY}px`,
              '--fish-scale': item.size,
              '--fish-delay': `${item.delay - fishWave * 0.055}s`,
              '--fish-duration': `${item.duration}s`,
            }}
          />
        ))}
      </div>
      <div className="whale-suction-particles">
        {Array.from({ length: 14 }, (_, index) => (
          <span
            key={index}
            style={{
              '--particle-x': `${mouthCenter.x + ((index * 41) % 142) - 71}px`,
              '--particle-y': `${mouthCenter.y + ((index * 29) % 112) - 56}px`,
              '--particle-delay': `${(index % 7) * -0.19}s`,
            }}
          />
        ))}
      </div>
      {fishCount > 0 && (
        <div className="fish-eaten-burst" key={fishCount}>
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}

function WhaleDream2Scene({ interaction }) {
  const mouthOpen = clamp(interaction.mouthOpen || 0, 0, 1);
  const xrFrameRef = useRef(null);

  useEffect(() => {
    const sendMouthState = () => {
      xrFrameRef.current?.contentWindow?.postMessage(
        {
          type: 'face-reset-mouth',
          open: mouthOpen,
          isOpen: Boolean(interaction.isOpen),
          flow: interaction.flow || 0,
        },
        window.location.origin,
      );
    };

    sendMouthState();
    const syncTimer = window.setInterval(sendMouthState, 120);
    return () => window.clearInterval(syncTimer);
  }, [interaction.flow, interaction.isOpen, mouthOpen]);

  return (
    <div
      className={`whale-dream-2-scene ${interaction.isOpen ? 'is-open' : ''}`}
      style={{ '--mouth-open': mouthOpen, '--flow': interaction.flow || 0 }}
      aria-hidden="true"
    >
      <iframe
        ref={xrFrameRef}
        className="pufferfish-xr-frame"
        src="/assets/pufferfish-xr.html"
        title="Pufferfish XR"
        loading="eager"
        allow="camera; fullscreen; xr-spatial-tracking; accelerometer; gyroscope"
        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-presentation"
      />
    </div>
  );
}

const FLOWER_PREVIEW_FRAME = { x: 30, y: 30, width: 102, height: 136 };

function getFlowerFrameRingPoint(t, margin = 16) {
  const left = FLOWER_PREVIEW_FRAME.x - margin;
  const right = FLOWER_PREVIEW_FRAME.x + FLOWER_PREVIEW_FRAME.width + margin;
  const top = FLOWER_PREVIEW_FRAME.y - margin;
  const bottom = FLOWER_PREVIEW_FRAME.y + FLOWER_PREVIEW_FRAME.height + margin;
  const w = right - left;
  const h = bottom - top;
  const perimeter = 2 * (w + h);
  const d = ((t % 1) + 1) % 1 * perimeter;

  if (d < w) return { x: left + d, y: top };
  if (d < w + h) return { x: right, y: top + (d - w) };
  if (d < w + h + w) return { x: right - (d - w - h), y: bottom };
  return { x: left, y: bottom - (d - w - h - w) };
}

function getFlowerBezierPoint(t, start, control, end) {
  const mt = 1 - t;
  return {
    x: mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x,
    y: mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y,
  };
}

function easeInFlowerFlight(t) {
  return t * t * t;
}

function FlowerCollectorScene({ interaction }) {
  const sniff = clamp(interaction.sniff || 0, 0, 1);
  const gathered = clamp(interaction.completion || 0, 0, 1);

  const primaryFlowers = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => {
        // Most petals rest low, near the bottle; only the first two hover
        // slightly higher, as if just lifted off the spill.
        const isHovering = index < 2;
        const start = {
          x: 172 + ((index * 43) % 158),
          y: isHovering ? 592 + index * 24 : 690 + ((index - 2) * 27) % 92,
        };
        const ringT = 0.05 + (index / 6) * 0.68;
        const end = getFlowerFrameRingPoint(ringT, 16);
        const control = {
          x: start.x - (start.x - end.x) * 0.55 + (index % 2 === 0 ? 16 : -16),
          y: Math.min(start.y, end.y) - 96 - (index % 3) * 18,
        };
        return {
          id: index,
          start,
          control,
          end,
          hue: index % 4,
          size: 0.88 + (index % 3) * 0.1,
          arrivalFrom: index / 6,
          arrivalTo: (index + 1) / 6,
          idleDelay: (index % 4) * 0.55,
        };
      }),
    [],
  );

  const secondaryFrame = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => {
        const point = getFlowerFrameRingPoint((index + 0.5) / 6, 13);
        return {
          id: index,
          x: point.x,
          y: point.y,
          hue: (index + 2) % 4,
          size: 0.52 + (index % 3) * 0.08,
          revealAt: 0.14 + index * 0.12,
          delay: (index % 4) * 0.5,
        };
      }),
    [],
  );

  const groundPetals = useMemo(
    () =>
      Array.from({ length: 16 }, (_, index) => {
        const bias = Math.pow(index / 15, 0.45);
        return {
          id: index,
          x: 6 + bias * 88,
          y: 3 + ((index % 5) * 3.2),
          size: 0.5 + bias * 0.5 + (index % 3) * 0.05,
          opacity: 0.22 + bias * 0.46,
          hue: index % 4,
          variant: index % 2 === 0 ? 'a' : 'b',
          delay: (index % 7) * 0.3,
          duration: 4.4 + (index % 5) * 0.5,
        };
      }),
    [],
  );

  const atmosphere = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => ({
        id: index,
        x: 10 + ((index * 29) % 82),
        y: 8 + ((index * 37) % 66),
        size: 1.3 + (index % 3) * 0.4,
        duration: 9 + (index % 4) * 2.2,
        delay: (index % 5) * 1.05,
        hue: index % 4,
      })),
    [],
  );

  return (
    <div
      className={`flower-collector-scene ${interaction.isSniffing ? 'is-sniffing' : ''}`}
      style={{
        '--sniff': sniff,
        '--gathered': gathered,
      }}
      aria-hidden="true"
    >
      <div className="flower-copy">
        <h1>Flower Collector</h1>
        <p>Inhale and gather the blossoms</p>
      </div>

      <div className="flower-atmosphere">
        {atmosphere.map((item) => (
          <span
            key={item.id}
            className={`atmosphere-petal hue-${item.hue}`}
            style={{
              '--atmo-x': `${item.x}%`,
              '--atmo-y': `${item.y}%`,
              '--atmo-size': item.size,
              '--atmo-duration': `${item.duration}s`,
              '--atmo-delay': `${item.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="flower-ground">
        {groundPetals.map((petal) => (
          <span
            key={petal.id}
            className={`ground-petal variant-${petal.variant} hue-${petal.hue}`}
            style={{
              '--ground-x': `${petal.x}%`,
              '--ground-y': `${petal.y}%`,
              '--ground-size': petal.size,
              '--ground-opacity': petal.opacity,
              '--ground-delay': `${petal.delay}s`,
              '--ground-duration': `${petal.duration}s`,
            }}
          />
        ))}
      </div>

      <div className="tipped-bottle">
        <span className="bottle-neck" />
        <span className="bottle-face" />
        <span className="bottle-bloom one" />
        <span className="bottle-bloom two" />
        <span className="bottle-bloom three" />
      </div>

      <div className="flower-frame-layer">
        {secondaryFrame.map((dot) => {
          const reveal = clamp((gathered - dot.revealAt) / 0.22, 0, 1);
          return (
            <span
              key={dot.id}
              className={`frame-fill-petal hue-${dot.hue}`}
              style={{
                '--frame-x': `${dot.x}px`,
                '--frame-y': `${dot.y}px`,
                '--frame-size': dot.size,
                '--frame-delay': `${dot.delay}s`,
                opacity: reveal * 0.78,
                transform: `translate(-50%, -50%) scale(${0.5 + reveal * 0.5})`,
              }}
            />
          );
        })}

        {primaryFlowers.map((flower) => {
          const arrivalSpan = flower.arrivalTo - flower.arrivalFrom;
          const arrivalProgress = clamp((gathered - flower.arrivalFrom) / arrivalSpan, 0, 1);
          const liveLean = arrivalProgress <= 0 ? sniff * 0.1 : 0;
          const t = clamp(arrivalProgress + liveLean, 0, 1);
          const eased = easeInFlowerFlight(t);
          const point = getFlowerBezierPoint(eased, flower.start, flower.control, flower.end);
          const scale = flower.size * (1 - eased * 0.3);
          const opacity = 0.5 + eased * 0.42;
          return (
            <span
              key={flower.id}
              className={`primary-flower hue-${flower.hue} ${eased > 0.92 ? 'is-settled' : ''}`}
              style={{
                '--flower-size': flower.size,
                '--flower-idle-delay': `${flower.idleDelay}s`,
                left: `${point.x}px`,
                top: `${point.y}px`,
                opacity,
                transform: `translate(-50%, -50%) scale(${scale})`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function BubbleGumBunnyScene({ interaction }) {
  const puff = clamp(interaction.puff || 0, 0, 1);
  const bubbleSize = clamp(interaction.bubbleSize || 0.07, 0.05, 1);
  const bubblePops = interaction.bubblePops || 0;
  const [isBursting, setIsBursting] = useState(false);
  const lastBubblePopsRef = useRef(bubblePops);
  const sparkles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        x: 12 + ((index * 31) % 78),
        y: 14 + ((index * 47) % 68),
        delay: (index % 9) * 0.12,
        size: 2 + (index % 4),
      })),
    [],
  );
  const hearts = useMemo(
    () =>
      Array.from({ length: 8 }, (_, index) => ({
        id: index,
        x: 16 + ((index * 53) % 70),
        y: 24 + ((index * 41) % 58),
        delay: (index % 6) * 0.22,
      })),
    [],
  );

  useEffect(() => {
    if (bubblePops > lastBubblePopsRef.current) {
      setIsBursting(true);
      const timer = window.setTimeout(() => setIsBursting(false), 520);
      lastBubblePopsRef.current = bubblePops;
      return () => window.clearTimeout(timer);
    }
    lastBubblePopsRef.current = bubblePops;
    return undefined;
  }, [bubblePops]);

  return (
    <div
      className={`bubble-bunny-scene ${interaction.isPuffing ? 'is-puffing' : ''} ${interaction.justPopped ? 'is-popping' : ''} ${isBursting ? 'is-bursting' : ''}`}
      style={{
        '--puff': puff,
        '--bubble-size': bubbleSize,
        '--combo': interaction.combo || 0,
      }}
      aria-hidden="true"
    >
      <div className="bunny-copy">
        <h1>Bubble Gum Bunny</h1>
        <p>Puff, relax, and grow the bubble</p>
      </div>

      <div className="bunny-sparkles">
        {sparkles.map((sparkle) => (
          <span
            key={sparkle.id}
            style={{
              '--sparkle-x': `${sparkle.x}%`,
              '--sparkle-y': `${sparkle.y}%`,
              '--sparkle-delay': `${sparkle.delay}s`,
              '--sparkle-size': `${sparkle.size}px`,
            }}
          />
        ))}
      </div>

      <div className="bunny-hearts">
        {hearts.map((heart) => (
          <span
            key={heart.id}
            style={{
              '--heart-x': `${heart.x}%`,
              '--heart-y': `${heart.y}%`,
              '--heart-delay': `${heart.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="bunny-character">
        <span className="bunny-ear left" />
        <span className="bunny-ear right" />
        <span className="bunny-head" />
        <span className="bunny-cheek left" />
        <span className="bunny-cheek right" />
        <span className="bunny-eye left" />
        <span className="bunny-eye right" />
        <span className="bunny-mouth" />
        <span className="gum-bubble" />
      </div>
      {bubblePops > 0 && (
        <div className="bubble-pop-burst" key={bubblePops}>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      )}

    </div>
  );
}

function TrackingVideo({ videoRef, isDemoMode }) {
  if (isDemoMode) {
    return <div className="tracking-video-placeholder" />;
  }

  return <video ref={videoRef} className="tracking-video" autoPlay playsInline muted />;
}

function CameraPreview({ detectorMode, handMode, isDemoMode, previewVideoRef, stream }) {
  return (
    <div className="camera-preview" aria-label="Front camera preview">
      <div className="preview-header">
        <span className="preview-dot" />
        <span>Front camera</span>
      </div>
      <div className="preview-video-shell">
        {isDemoMode || !stream ? (
          <MirrorVideo videoRef={previewVideoRef} isDemoMode />
        ) : (
          <video ref={previewVideoRef} className="preview-video" autoPlay playsInline muted />
        )}
      </div>
      <div className="preview-status">
        {formatDetectorMode(detectorMode)} face · {formatDetectorMode(handMode)} hand
      </div>
    </div>
  );
}

function FingertipDot({ point, side, isOnTrack }) {
  return (
    <g className={`fingertip-dot ${side} ${isOnTrack ? 'on-track' : ''}`}>
      <line className="finger-control-line" x1={point.x} y1={point.y + 36} x2={point.x} y2={point.y} />
      <circle cx={point.x} cy={point.y} r="15" />
      <circle cx={point.x} cy={point.y} r="6" />
    </g>
  );
}

function formatTime(value) {
  const minutes = Math.floor(value / 60);
  const seconds = String(value % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function toPercent(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function formatDetectorMode(mode) {
  if (mode === 'real-landmark') return 'Real';
  if (mode === 'mock-landmark') return 'Mock';
  return 'Demo';
}

function isInteractionDebugEnabled() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

function captureRoutineSnapshot({ video, isDemoMode, progress, score }) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const width = 360;
  const height = 480;
  canvas.width = width;
  canvas.height = height;

  if (!isDemoMode && video?.videoWidth && video?.videoHeight && video.readyState >= 2) {
    const sourceAspect = video.videoWidth / video.videoHeight;
    const targetAspect = width / height;
    let sourceWidth = video.videoWidth;
    let sourceHeight = video.videoHeight;
    let sourceX = 0;
    let sourceY = 0;

    if (sourceAspect > targetAspect) {
      sourceWidth = video.videoHeight * targetAspect;
      sourceX = (video.videoWidth - sourceWidth) / 2;
    } else {
      sourceHeight = video.videoWidth / targetAspect;
      sourceY = (video.videoHeight - sourceHeight) / 2;
    }

    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    context.restore();
  } else {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#dff4f0');
    gradient.addColorStop(1, '#f7dce8');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.fillStyle = 'rgba(255,255,255,0.74)';
    context.beginPath();
    context.arc(width / 2, height * 0.42, 86, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = 'rgba(7, 20, 24, 0.28)';
  context.fillRect(0, 0, width, height);
  context.fillStyle = 'rgba(215, 255, 248, 0.92)';
  context.beginPath();
  context.arc(width * (0.18 + progress * 0.64), height * 0.92, 7, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.86)';
  context.font = '700 22px Inter, sans-serif';
  context.fillText(String(score), 22, 42);

  return {
    id: `${Date.now()}-${Math.round(progress * 1000)}`,
    image: canvas.toDataURL('image/jpeg', 0.72),
    progress,
    score,
  };
}

function createTemplePressTargets(features, size) {
  const width = size.width || 375;
  const height = size.height || 812;
  if (!features?.leftEye?.outer || !features?.rightEye?.outer) {
    const fallbackY = height * 0.28;
    return {
      left: { x: width * 0.22, y: fallbackY, tolerance: Math.max(42, width * 0.13) },
      right: { x: width * 0.78, y: fallbackY, tolerance: Math.max(42, width * 0.13) },
    };
  }

  const eyes = [features.leftEye, features.rightEye].sort((a, b) => a.center.x - b.center.x);
  const faceScale = features.faceScale || Math.max(width * 0.46, 160);
  // Keep the zones around the temples generous enough for natural finger drift,
  // while still requiring each hand to remain on its own side of the face.
  const outward = clamp(faceScale * 0.105, 20, 48);
  const lift = clamp(faceScale * 0.02, 3, 12);
  const tolerance = clamp(faceScale * 0.3, 70, 126);

  return {
    left: {
      x: clamp(eyes[0].center.x - outward, 18, width - 18),
      y: clamp(eyes[0].center.y - lift, 28, height - 28),
      tolerance,
    },
    right: {
      x: clamp(eyes[1].center.x + outward, 18, width - 18),
      y: clamp(eyes[1].center.y - lift, 28, height - 28),
      tolerance,
    },
  };
}

function createTemplePressTrajectories(targets, size) {
  const width = size.width || 375;
  const height = size.height || 812;
  const leftTarget = targets?.left || { x: width * 0.22, y: height * 0.28, tolerance: 48 };
  const rightTarget = targets?.right || { x: width * 0.78, y: height * 0.28, tolerance: 48 };

  const left = createGesturePath({
    id: 'temple-left-press',
    start: { x: clamp(leftTarget.x - width * 0.14, 8, width - 8), y: leftTarget.y + height * 0.015 },
    control: { x: leftTarget.x - width * 0.06, y: leftTarget.y },
    end: leftTarget,
    tolerance: leftTarget.tolerance,
  });
  const right = createGesturePath({
    id: 'temple-right-press',
    start: { x: clamp(rightTarget.x + width * 0.14, 8, width - 8), y: rightTarget.y + height * 0.015 },
    control: { x: rightTarget.x + width * 0.06, y: rightTarget.y },
    end: rightTarget,
    tolerance: rightTarget.tolerance,
  });

  return { left, right, all: [left, right] };
}

function createLemonPressTargets(features, size) {
  const width = size.width || 375;
  const height = size.height || 812;
  const fallbackY = height * 0.3;

  if (!features?.face?.noseCenter || !features?.leftEye?.center || !features?.rightEye?.center) {
    return {
      left: { x: width * 0.42, y: fallbackY, tolerance: Math.max(34, width * 0.11) },
      right: { x: width * 0.58, y: fallbackY, tolerance: Math.max(34, width * 0.11) },
    };
  }

  const eyeDistance = Math.max(72, Math.abs(features.rightEye.center.x - features.leftEye.center.x));
  const faceScale = features.faceScale || Math.max(width * 0.42, 150);
  const sideOffset = clamp(eyeDistance * 0.22, 24, 52);
  const lift = clamp(faceScale * 0.08, 12, 34);
  const tolerance = clamp(faceScale * 0.14, 38, 72);
  const nose = features.face.noseCenter;

  return {
    left: {
      x: clamp(nose.x - sideOffset, 18, width - 18),
      y: clamp(nose.y - lift, 34, height - 34),
      tolerance,
    },
    right: {
      x: clamp(nose.x + sideOffset, 18, width - 18),
      y: clamp(nose.y - lift, 34, height - 34),
      tolerance,
    },
  };
}

function createLemonPressTrajectories(targets, size) {
  const width = size.width || 375;
  const height = size.height || 812;
  const leftTarget = targets?.left || { x: width * 0.42, y: height * 0.3, tolerance: 44 };
  const rightTarget = targets?.right || { x: width * 0.58, y: height * 0.3, tolerance: 44 };

  const left = createGesturePath({
    id: 'lemon-left-squeeze',
    start: { x: clamp(leftTarget.x - width * 0.12, 8, width - 8), y: leftTarget.y + height * 0.012 },
    control: { x: leftTarget.x - width * 0.04, y: leftTarget.y },
    end: leftTarget,
    tolerance: leftTarget.tolerance,
  });
  const right = createGesturePath({
    id: 'lemon-right-squeeze',
    start: { x: clamp(rightTarget.x + width * 0.12, 8, width - 8), y: rightTarget.y + height * 0.012 },
    control: { x: rightTarget.x + width * 0.04, y: rightTarget.y },
    end: rightTarget,
    tolerance: rightTarget.tolerance,
  });

  return { left, right, all: [left, right] };
}

function createGesturePath({ id, start, control, end, tolerance }) {
  return {
    id,
    start,
    control,
    end,
    tolerance,
    points: sampleQuadraticPoints(start, control, end, 34),
  };
}

function sampleQuadraticPoints(start, control, end, count) {
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    const inverse = 1 - t;
    return {
      x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
      y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
    };
  });
}

function scoreTemplePress({ features, fingertips, targets, timestamp, progressState, stageProgress, tuning }) {
  const scoring = tuning.scoring;
  const leftRaw = scoreTempleSide({ point: fingertips.left, target: targets?.left });
  const rightRaw = scoreTempleSide({ point: fingertips.right, target: targets?.right });
  const left = updateInteractionSignal(leftRaw.available ? leftRaw.press : null, timestamp, progressState.leftSignal, tuning.signal);
  const right = updateInteractionSignal(rightRaw.available ? rightRaw.press : null, timestamp, progressState.rightSignal, tuning.signal);
  const bothPressing = left.active && right.active;
  const onePressing = left.active || right.active || left.value > scoring.oneSideHintThreshold || right.value > scoring.oneSideHintThreshold;
  const balanced = 1 - Math.min(1, Math.abs(left.value - right.value));
  const deltaSeconds = Math.max(left.deltaSeconds, right.deltaSeconds);

  if (bothPressing) {
    const holdQuality = clamp((left.value + right.value) / 2, 0, 1) * balanced;
    progressState.flow = clamp(progressState.flow + deltaSeconds * (scoring.flowBase + holdQuality * scoring.flowByBalance), 0, 1);
    progressState.gardenNourishment = clamp(
      (progressState.gardenNourishment || 0) + deltaSeconds * (scoring.growthBase + holdQuality * scoring.growthByFlow),
      0,
      1,
    );
    progressState.score += deltaSeconds * (scoring.holdBase + holdQuality * scoring.holdByQuality);

    const nourishmentEvents = consumeTimedEvents(progressState, 'gardenNourishment', scoring.nourishmentRate, deltaSeconds);
    progressState.score += nourishmentEvents * (balanced > scoring.syncBonusThreshold ? scoring.stableNourishmentBonus : scoring.nourishmentBonus);
    progressState.gardenCycle += nourishmentEvents;
  } else {
    progressState.flow = clamp(progressState.flow - deltaSeconds * scoring.decay, scoring.minimumFlow, 1);
  }

  const leftRain = clamp(left.value * (left.active ? 1 : 0.58), 0, 1);
  const rightRain = clamp(right.value * (right.active ? 1 : 0.58), 0, 1);
  const rain = bothPressing ? clamp((leftRain + rightRain) / 2, 0, 1) : Math.max(leftRain, rightRain) * 0.48;
  const growth = clamp(progressState.gardenNourishment || 0, 0, 1);
  progressState.score = Math.min(MAX_SCENE_SCORE, progressState.score);

  return {
    score: Math.round(progressState.score),
    completion: growth,
    feedback: getTemplePressFeedback({ features, fingertips, bothPressing, onePressing, balanced, growth, tuning }),
    isOnTrack: bothPressing,
    leftPress: left.value,
    rightPress: right.value,
    leftRain,
    rightRain,
    rain,
    growth,
    gardenCycle: progressState.gardenCycle,
    ripple: clamp(rain * 0.78 + growth * 0.28, 0, 1),
    flow: progressState.flow,
    isPressing: bothPressing,
    combo: progressState.combo,
    holdSeconds: Math.min(left.holdSeconds, right.holdSeconds),
    justActivated: left.justActivated || right.justActivated,
    justReleased: left.justReleased || right.justReleased,
    phase: bothPressing ? 'holding' : onePressing ? 'detecting' : 'idle',
  };
}

function scoreTempleSide({ point, target }) {
  if (!point || !target) {
    return { press: 0, distance: Infinity, available: false };
  }
  const distance = Math.hypot(point.x - target.x, point.y - target.y);
  const tolerance = target.tolerance || 54;
  const press = clamp(1 - distance / tolerance, 0, 1);
  return { press, distance, available: true };
}

function getTemplePressFeedback({ features, fingertips, bothPressing, onePressing, balanced, growth, tuning }) {
  if (!features) return 'Find your face';
  if (!fingertips?.left && !fingertips?.right) return 'Show both index fingers';
  if (!fingertips.left || !fingertips.right) return 'Use both hands on your temples';
  if (!onePressing) return 'Move both fingers to your temples';
  if (!bothPressing) return 'Press both sides at the same time';
  if (balanced < tuning.scoring.balanceHintThreshold) return 'Balance both sides gently';
  if (growth > 0.88) return 'Beautiful, your garden is in bloom';
  if (growth > 0.58) return 'Keep holding gently to help the garden bloom';
  return 'Hold both temples calmly to nourish the garden';
}

function scoreLemonSqueeze({ features, fingertips, targets, timestamp, progressState, stageProgress, tuning }) {
  const scoring = tuning.scoring;
  const leftRaw = scoreTempleSide({ point: fingertips.left, target: targets?.left });
  const rightRaw = scoreTempleSide({ point: fingertips.right, target: targets?.right });
  const left = updateInteractionSignal(leftRaw.available ? leftRaw.press : null, timestamp, progressState.leftSignal, tuning.signal);
  const right = updateInteractionSignal(rightRaw.available ? rightRaw.press : null, timestamp, progressState.rightSignal, tuning.signal);
  const bothPressing = left.active && right.active;
  const onePressing = left.active || right.active || left.value > scoring.oneSideHintThreshold || right.value > scoring.oneSideHintThreshold;
  const balanced = 1 - Math.min(1, Math.abs(left.value - right.value));
  const squeeze = clamp((left.value + right.value) / 2, 0, 1);
  const elapsedSeconds = Math.max(left.deltaSeconds, right.deltaSeconds);

  if (bothPressing) {
    progressState.sodaLevel = clamp(
      progressState.sodaLevel + (scoring.sodaBase + squeeze * scoring.sodaBySqueeze + balanced * scoring.sodaByBalance) * elapsedSeconds,
      scoring.minSodaLevel,
      scoring.maxSodaLevel,
    );
  }

  const ingredientStage = Math.min(4, Math.max(0, Math.floor((progressState.sodaLevel - scoring.ingredientOffset) * scoring.ingredientMultiplier)));
  if (ingredientStage > progressState.ingredientStage) {
    progressState.score += (ingredientStage - progressState.ingredientStage) * scoring.ingredientScore;
    progressState.ingredientStage = ingredientStage;
  }

  if (left.justReleased || right.justReleased) {
    const completedBoth = left.holdSeconds >= scoring.completedHoldSeconds && right.holdSeconds >= scoring.completedHoldSeconds;
    if (completedBoth) {
      progressState.combo = Math.min(12, progressState.combo + 1);
      progressState.score += scoring.releaseScore + (balanced > scoring.syncBonusThreshold ? scoring.syncBonusScore : 0);
    }
  }

  let sip = 0;
  if (progressState.sodaLevel > progressState.nextSipLevel) {
    progressState.sipCycle += elapsedSeconds;
    sip = Math.sin(Math.min(1, progressState.sipCycle / scoring.sipSeconds) * Math.PI);
    if (progressState.sipCycle > scoring.sipSeconds) {
      progressState.sodaLevel = clamp(progressState.sodaLevel - (scoring.sipDropBase + (progressState.sipCount % 3) * scoring.sipDropStep), scoring.sipMinAfterDrop, scoring.sipMaxAfterDrop);
      progressState.score += scoring.sipScore;
      progressState.sipCount += 1;
      progressState.sipCycle = 0;
      progressState.nextSipLevel = scoring.sipBaseLevel + (progressState.sipCount % 3) * scoring.sipLevelStep;
      progressState.ingredientStage = Math.min(4, Math.max(0, Math.floor((progressState.sodaLevel - scoring.ingredientOffset) * scoring.ingredientMultiplier)));
    }
  } else {
    progressState.sipCycle = Math.max(0, progressState.sipCycle - elapsedSeconds * 1.5);
  }

  progressState.score = Math.min(MAX_SCENE_SCORE, progressState.score);

  return {
    score: Math.round(progressState.score),
    completion: clamp(progressState.sodaLevel, 0, 1),
    feedback: getLemonSqueezeFeedback({ features, fingertips, bothPressing, onePressing, balanced, sodaLevel: progressState.sodaLevel, tuning }),
    isOnTrack: bothPressing && balanced > scoring.balanceHintThreshold,
    leftPress: left.value,
    rightPress: right.value,
    squeeze,
    sodaLevel: progressState.sodaLevel,
    ingredientStage: progressState.ingredientStage,
    sip,
    combo: progressState.combo,
    flow: progressState.sodaLevel,
    isSqueezing: bothPressing,
    holdSeconds: Math.min(left.holdSeconds, right.holdSeconds),
    justActivated: left.justActivated || right.justActivated,
    justReleased: left.justReleased || right.justReleased,
    phase: bothPressing ? 'holding' : onePressing ? 'detecting' : 'idle',
  };
}

function getLemonSqueezeFeedback({ features, fingertips, bothPressing, onePressing, balanced, sodaLevel, tuning }) {
  if (!features?.face?.noseCenter) return 'Find your face';
  if (!fingertips?.left && !fingertips?.right) return 'Show both index fingers';
  if (!fingertips.left || !fingertips.right) return 'Use both fingers beside your nose';
  if (!onePressing) return 'Move fingers beside your nose bridge';
  if (!bothPressing) return 'Squeeze both lemon halves together';
  if (balanced < tuning.scoring.balanceHintThreshold) return 'Balance left and right squeeze';
  if (sodaLevel > tuning.scoring.sipHintLevel) return 'Tiny friend is stealing a sip';
  return 'Fresh squeeze, bubbles rising';
}

function getInitialFeedback(sceneId) {
  return getSceneTuning(sceneId).feedbackInitial;
}

function scoreCheekPuff({ features, timestamp, progressState, stageProgress, tuning }) {
  const scoring = tuning.scoring;
  const ratio = features?.cheeks?.puffRatio;
  const rawPuff = Number.isFinite(ratio) ? clamp((ratio - tuning.input.baseline) / tuning.input.range, 0, 1) : null;
  const signal = updateInteractionSignal(rawPuff, timestamp, progressState.signal, tuning.signal);
  const puff = signal.value;
  const isPuffing = signal.active;
  const isStable = signal.phase === 'holding';
  const elapsedSeconds = signal.deltaSeconds;

  if (isPuffing) {
    progressState.bubbleSize = clamp(progressState.bubbleSize + (scoring.growthBase + puff * scoring.growthByValue) * elapsedSeconds, scoring.minBubbleSize, scoring.maxBubbleSize);
    const holdEvents = consumeTimedEvents(progressState, 'bubbleHold', signal.holdSeconds > scoring.holdBonusSeconds ? scoring.holdEventRate : 0, elapsedSeconds);
    progressState.score += holdEvents * scoring.holdEventScore;
  } else {
    progressState.bubbleSize = clamp(progressState.bubbleSize - scoring.decay * elapsedSeconds, scoring.minBubbleSize, scoring.maxBubbleSize);
  }

  const nextStage = Math.min(4, Math.floor(progressState.bubbleSize * scoring.stageMultiplier));
  if (nextStage > progressState.stage) {
    progressState.score += (nextStage - progressState.stage) * scoring.stageScore;
    progressState.stage = nextStage;
  }

  if (progressState.bubbleSize >= scoring.popThreshold) {
    progressState.maxHold += elapsedSeconds;
    if (progressState.maxHold >= scoring.popHoldSeconds) {
      progressState.bubbleSize = scoring.resetSize;
      progressState.stage = scoring.resetStage;
      progressState.maxHold = 0;
      progressState.bubblePops += 1;
      progressState.justPopped = true;
      progressState.combo = Math.min(12, progressState.combo + 1);
      progressState.score += scoring.popScore + (progressState.combo >= 3 ? scoring.comboBonusScore : 0);
    } else {
      progressState.justPopped = false;
    }
  } else {
    progressState.maxHold = 0;
    progressState.justPopped = false;
  }

  if (signal.justReleased && signal.holdSeconds >= scoring.releaseHoldSeconds) {
    progressState.combo = Math.min(12, progressState.combo + 1);
    progressState.score += scoring.releaseScore + (signal.holdSeconds >= scoring.longHoldSeconds ? scoring.longHoldBonusScore : 0);
  }
  progressState.score = Math.min(MAX_SCENE_SCORE, progressState.score);

  return {
    score: Math.round(progressState.score),
    completion: progressState.bubbleSize,
    feedback: getCheekPuffFeedback({ features, isPuffing, isStable, bubbleSize: progressState.bubbleSize, combo: progressState.combo || 0 }),
    isOnTrack: isPuffing && isStable,
    puff,
    bubbleSize: progressState.bubbleSize,
    bubbleStage: progressState.stage,
    bubblePops: progressState.bubblePops,
    justPopped: progressState.justPopped,
    combo: progressState.combo,
    isPuffing,
    holdSeconds: signal.holdSeconds,
    justActivated: signal.justActivated,
    justReleased: signal.justReleased,
    phase: signal.phase,
  };
}

function getCheekPuffFeedback({ features, isPuffing, isStable, bubbleSize, combo }) {
  if (!features?.cheeks) return 'Find your face';
  if (!isPuffing) return 'Puff your cheeks, then relax softly';
  if (!isStable) return 'Hold the bubble steady';
  if (combo >= 3) return 'Combo rhythm, bunny loves it';
  if (bubbleSize > 0.78) return 'Big bubble sparkle bonus';
  return 'Nice puff, keep the bubble growing';
}

function scoreNoseSniff({ features, timestamp, progressState, stageProgress, tuning }) {
  const scoring = tuning.scoring;
  const ratio = features?.nose?.sniffRatio;
  const rawSniff = Number.isFinite(ratio) ? clamp((ratio - tuning.input.baseline) / tuning.input.range, 0, 1) : null;
  const signal = updateInteractionSignal(rawSniff, timestamp, progressState.signal, tuning.signal);
  const sniff = signal.value;
  const isSniffing = signal.active;
  const isStrong = sniff > tuning.input.strongThreshold;
  const isControlled = signal.phase === 'holding';
  const elapsedSeconds = signal.deltaSeconds;

  if (isSniffing) {
    progressState.flow = clamp(progressState.flow + elapsedSeconds * (scoring.flowBase + sniff * scoring.flowByValue), 0, 1);
    const collected = consumeTimedEvents(progressState, 'flower', scoring.eventBase + sniff * scoring.eventByValue + (isStrong ? scoring.strongEventBonus : 0), elapsedSeconds);
    if (collected > 0) {
      progressState.flowerCount += collected;
      const special = Math.floor(progressState.flowerCount / scoring.specialEvery) - progressState.specialFlowers;
      progressState.specialFlowers += Math.max(0, special);
      progressState.score += collected + Math.max(0, special) * scoring.specialScore;
    }
  } else {
    progressState.flow = clamp(progressState.flow - elapsedSeconds * scoring.decay, scoring.minimumFlow, 1);
  }

  if (signal.justReleased && signal.holdSeconds >= scoring.releaseHoldSeconds) {
    progressState.combo = Math.min(12, progressState.combo + 1);
    progressState.score += progressState.combo >= 3 ? scoring.comboReleaseScore : scoring.releaseScore;
  }
  progressState.score = Math.min(MAX_SCENE_SCORE, progressState.score);

  return {
    score: Math.round(progressState.score),
    completion: clamp((progressState.flowerCount % scoring.completionModulo) / scoring.completionModulo, 0, 1),
    feedback: getNoseSniffFeedback({ features, isSniffing, isStrong, isControlled }),
    isOnTrack: isSniffing && isControlled,
    sniff,
    flowerCount: progressState.flowerCount,
    flow: progressState.flow,
    isSniffing,
    combo: progressState.combo,
    holdSeconds: signal.holdSeconds,
    justActivated: signal.justActivated,
    justReleased: signal.justReleased,
    phase: signal.phase,
  };
}

function getNoseSniffFeedback({ features, isSniffing, isStrong, isControlled }) {
  if (!features?.nose) return 'Find your face';
  if (!isSniffing) return 'Wrinkle your nose like smelling a flower';
  if (!isControlled) return 'Hold the scent gently';
  if (isStrong) return 'Lovely inhale, blossoms are gathering';
  return 'Good, scrunch a little stronger';
}

function scoreMouthOpening({ features, timestamp, progressState, stageProgress, tuning }) {
  const scoring = tuning.scoring;
  const ratio = features?.mouth?.openRatio;
  const rawOpen = Number.isFinite(ratio) ? clamp((ratio - tuning.input.baseline) / tuning.input.range, 0, 1) : null;
  const signal = updateInteractionSignal(rawOpen, timestamp, progressState.signal, tuning.signal);
  const mouthOpen = signal.value;
  const elapsedSeconds = signal.deltaSeconds;
  const isOpen = signal.active;
  const isWide = mouthOpen > tuning.input.wideThreshold;
  const isStable = signal.phase === 'holding';

  if (isOpen) {
    progressState.flow = clamp(progressState.flow + elapsedSeconds * (scoring.flowBase + mouthOpen * scoring.flowByValue), 0, 1);
    progressState.score += elapsedSeconds * (
      scoring.holdBase
      + mouthOpen * scoring.holdByValue
      + (isStable ? scoring.stableHoldBonus : 0)
    );
    const eaten = consumeTimedEvents(progressState, 'fish', scoring.eventBase + mouthOpen * scoring.eventByValue + (isStable ? scoring.stableEventBonus : 0), elapsedSeconds);
    if (eaten > 0) {
      progressState.fishCount += eaten;
      const special = Math.floor(progressState.fishCount / scoring.specialEvery) - progressState.specialFish;
      progressState.specialFish += Math.max(0, special);
      progressState.score += eaten * scoring.fishScore + Math.max(0, special) * scoring.specialScore;
    }
  } else {
    progressState.flow = clamp(progressState.flow - elapsedSeconds * scoring.decay, scoring.minimumFlow, 1);
  }

  if (signal.justReleased && signal.holdSeconds >= 0.45) progressState.combo = Math.min(12, progressState.combo + 1);
  progressState.score = Math.min(MAX_SCENE_SCORE, progressState.score);

  return {
    score: Math.round(progressState.score),
    completion: clamp((progressState.fishCount % scoring.completionModulo) / scoring.completionModulo, 0, 1),
    feedback: getMouthOpeningFeedback({ features, isOpen, isWide, isStable, mouthOpen }),
    isOnTrack: isOpen && isStable,
    mouthOpen,
    flow: progressState.flow,
    fishBurst: isOpen ? clamp(mouthOpen + progressState.flow * 0.25, 0, 1) : 0,
    fishCount: progressState.fishCount,
    combo: progressState.combo,
    isOpen,
    holdSeconds: signal.holdSeconds,
    justActivated: signal.justActivated,
    justReleased: signal.justReleased,
    phase: signal.phase,
  };
}

function getMouthOpeningFeedback({ features, isOpen, isWide, isStable, mouthOpen }) {
  if (!features?.mouth) return 'Find your face';
  if (!isOpen) return 'Open wide and invite the fish in';
  if (!isStable && mouthOpen > 0.45) return 'Hold the whale mouth steady';
  if (isWide) return 'Great flow, little fish are swimming in';
  return 'Nice, open a little wider';
}

function createMouthProgress() {
  return {
    score: 0,
    flow: 0.08,
    fishCount: 0,
    specialFish: 0,
    combo: 0,
    fishAccumulator: 0,
    signal: createInteractionSignalState(),
  };
}

function createTempleProgress() {
  return {
    score: 0,
    flow: 0,
    combo: 0,
    gardenCycle: 0,
    gardenNourishment: 0,
    gardenNourishmentAccumulator: 0,
    leftSignal: createInteractionSignalState(),
    rightSignal: createInteractionSignalState(),
  };
}

function createLemonProgress() {
  return {
    score: 0,
    sodaLevel: 0.16,
    ingredientStage: 0,
    sipCycle: 0,
    sipCount: 0,
    nextSipLevel: 0.82,
    combo: 0,
    leftSignal: createInteractionSignalState(),
    rightSignal: createInteractionSignalState(),
  };
}

function createNoseProgress() {
  return {
    score: 0,
    flow: 0.08,
    flowerCount: 0,
    specialFlowers: 0,
    combo: 0,
    flowerAccumulator: 0,
    signal: createInteractionSignalState(),
  };
}

function createBubbleProgress() {
  return {
    score: 0,
    bubbleSize: 0.07,
    bubblePops: 0,
    justPopped: false,
    combo: 0,
    stage: 0,
    maxHold: 0,
    bubbleHoldAccumulator: 0,
    signal: createInteractionSignalState(),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value) {
  return Number(value.toFixed(2));
}
