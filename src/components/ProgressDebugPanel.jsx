import { useMemo, useState } from 'react';
import {
  clearAllProgress,
  clearTodayProgressDebug,
  loadProgressDebugSnapshot,
  seedProgressDebug,
  seedSessionOneCompleteDebug,
} from '../utils/progressAdapter.js';

export default function ProgressDebugPanel({ onProgressChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('');
  const snapshot = useMemo(() => loadProgressDebugSnapshot(), [revision]);
  const recentHistory = snapshot.history || [];

  const refresh = (nextMessage = '') => {
    setMessage(nextMessage);
    setRevision((value) => value + 1);
    onProgressChange?.();
  };

  const clearToday = () => {
    clearTodayProgressDebug();
    refresh('已清除今天的打卡與紀錄');
  };

  const clearAll = () => {
    if (!window.confirm('確定要清除這台裝置上的 Face Reset 進度嗎？')) return;
    clearAllProgress();
    refresh('已清除本機進度，device id 會保留');
  };

  const seedWeek = () => {
    seedProgressDebug(7);
    refresh('已建立 7 天測試資料');
  };

  const seedSessionOneComplete = () => {
    seedSessionOneCompleteDebug();
    refresh('已重現 Session 1 完成狀態');
  };

  return (
    <aside className={`progress-debug-panel ${isOpen ? 'is-open' : ''}`} aria-label="Progress debug panel">
      <button className="progress-debug-toggle" onClick={() => setIsOpen((value) => !value)} type="button">
        <span>進度 Debug</span>
        <strong>{snapshot.streak || 0} 天</strong>
      </button>

      {isOpen && (
        <div className="progress-debug-drawer">
          <header>
            <div>
              <p>本機進度面板</p>
              <h2>Local Progress</h2>
            </div>
            <button onClick={() => setIsOpen(false)} type="button" aria-label="Close progress debug panel">×</button>
          </header>

          <section className="progress-debug-grid" aria-label="Progress summary">
            <DebugMetric label="今天" value={snapshot.isCheckedInToday ? '已完成' : '未完成'} />
            <DebugMetric label="連續天數" value={`${snapshot.streak || 0}`} />
            <DebugMetric label="最佳分數" value={`${snapshot.bestScore || 0}`} />
            <DebugMetric label="總次數" value={`${snapshot.totalSessions || 0}`} />
          </section>

          <section className="progress-debug-section">
            <h3>資料來源</h3>
            <p>目前使用 localStorage，未來 VIVERSE / Supabase 可以替換同一組 adapter。</p>
            <code>{snapshot.deviceId || 'guest-local'}</code>
          </section>

          <section className="progress-debug-section">
            <h3>臉部區域</h3>
            <div className="progress-debug-areas">
              {(snapshot.areaProgress || []).map((area) => (
                <div key={area.key}>
                  <span>{area.label}</span>
                  <strong>{area.count}/{area.target}</strong>
                  <progress value={area.progress} max="1" />
                </div>
              ))}
            </div>
          </section>

          <section className="progress-debug-section">
            <h3>最近紀錄</h3>
            <div className="progress-debug-history">
              {recentHistory.length > 0 ? (
                recentHistory.slice(0, 6).map((entry) => (
                  <article key={entry.id || `${entry.date}-${entry.sceneId}`}>
                    <span>{entry.date}</span>
                    <strong>{entry.sceneTitle || entry.stamp}</strong>
                    <b>{entry.score}</b>
                  </article>
                ))
              ) : (
                <p>還沒有完成紀錄。</p>
              )}
            </div>
          </section>

          <section className="progress-debug-section">
            <h3>測試工具</h3>
            <div className="progress-debug-actions">
              <button onClick={seedSessionOneComplete} type="button">Session 1 完成</button>
              <button onClick={seedWeek} type="button">模擬 7 天</button>
              <button onClick={clearToday} type="button">清除今天</button>
              <button onClick={clearAll} type="button">清除全部</button>
            </div>
            {message && <p className="progress-debug-message">{message}</p>}
          </section>
        </div>
      )}
    </aside>
  );
}

function DebugMetric({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
