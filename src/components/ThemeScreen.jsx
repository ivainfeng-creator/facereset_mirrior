import { SCENE_IDS, getSceneById } from '../data/scenes.js';

const TODAY_PLAN_IDS = [
  SCENE_IDS.whaleDream,
  SCENE_IDS.templeGarden,
  SCENE_IDS.flowerCollector,
];

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCompletedScenesForToday(habit) {
  const todayKey = getLocalDateKey();
  const entries = habit?.history || [];
  return new Set(
    entries
      .filter((entry) => entry.date === todayKey)
      .map((entry) => entry.sceneId)
  );
}

export default function ThemeScreen({ habit, selectedScene, onBack, onSelect }) {
  const todayScenes = TODAY_PLAN_IDS.map(getSceneById);
  const completedScenes = getCompletedScenesForToday(habit);
  const completedCount = todayScenes.filter((scene) => completedScenes.has(scene.id)).length;
  const activeIndex = todayScenes.findIndex((scene) => !completedScenes.has(scene.id));
  const currentDay = Math.min(7, Math.max(1, habit?.streak || 1));
  const isAllDone = completedCount >= todayScenes.length;

  return (
    <section className="screen theme-screen today-plan-screen">
      <main className="theme-card today-plan-card" aria-label="Today’s Face Reset plan">
        <button className="today-plan-close" onClick={onBack} aria-label="Back to welcome">
          ×
        </button>

        <header className="today-plan-hero">
          <h1>
            <span>7-DAY</span>
            <span>FACE RESET</span>
          </h1>
        </header>

        <div className="today-day-block" aria-label={`Today is day ${currentDay}`}>
          <p>TODAY · DAY {currentDay}</p>
          <div className="today-day-chips">
            {Array.from({ length: 7 }, (_, index) => {
              const day = index + 1;
              return (
                <span
                  key={day}
                  className={`today-day-chip ${day === currentDay ? 'is-current' : ''} ${
                    day < currentDay ? 'is-past' : ''
                  }`}
                >
                  {day}
                </span>
              );
            })}
          </div>
        </div>

        <section className="today-focus-card" aria-label="Today’s focus">
          <div className="today-focus-header">
            <div>
              <p>TODAY’S FOCUS</p>
              <h2>FACIAL WARM-UP</h2>
            </div>
            <div className="today-focus-progress" aria-label={`${completedCount} of ${todayScenes.length} complete`}>
              <span className="today-focus-rail">
                <span
                  className="today-focus-fill"
                  style={{ width: `${(completedCount / todayScenes.length) * 100}%` }}
                />
              </span>
              <strong>{completedCount} / {todayScenes.length}</strong>
            </div>
          </div>

          <div className="today-session-list">
            {todayScenes.map((scene, index) => {
              const isDone = completedScenes.has(scene.id);
              const isActive = activeIndex === index;
              const isLocked = activeIndex !== -1 && index > activeIndex;
              const canStart = !isLocked && !isAllDone;
              const rowClassName = [
                'today-session-row',
                selectedScene === scene.id ? 'is-selected' : '',
                isDone ? 'is-done' : '',
                isActive ? 'is-active' : '',
                isLocked ? 'is-locked' : '',
              ].filter(Boolean).join(' ');

              return (
                <button
                  key={scene.id}
                  className={rowClassName}
                  type="button"
                  onClick={() => canStart && onSelect(scene.id)}
                  disabled={!canStart}
                >
                  <span className="today-session-number">{index + 1}.</span>
                  <span className="today-session-copy">
                    <strong>{scene.title}</strong>
                    <small>1 min · {scene.area}</small>
                  </span>
                  {isActive && !isDone && <span className="today-session-hint">Tap to start</span>}
                  {isDone && <span className="today-done-stamp">DONE</span>}
                  {!isDone && <span className="today-session-arrow">→</span>}
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </section>
  );
}
