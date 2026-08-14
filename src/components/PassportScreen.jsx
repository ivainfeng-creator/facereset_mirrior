import { getPlayerIdentity, loadPassportProgress } from '../utils/progressAdapter.js';

export default function PassportScreen({ habit, onBack, onLeaderboard, onRestart }) {
  const passport = loadPassportProgress(habit);
  const identity = getPlayerIdentity(habit);

  return (
    <section className="screen passport-screen">
      <main className="passport-card" aria-label="Face Reset Passport">
        <button className="passport-back-button" onClick={onBack} type="button" aria-label="Back" />

        <header className="passport-header">
          <p>YOUR FACE RESET PASSPORT</p>
          <h1>{passport.faceCompletion}% RESET</h1>
          <span>{passport.streak || 0} day streak · {passport.totalSessions || 0} total sessions</span>
        </header>

        <section className="passport-week" aria-label="Weekly check-ins">
          {passport.weekDays.map((day) => (
            <div className={`passport-day ${day.completed ? 'done' : ''}`} key={day.key}>
              <span>{day.label}</span>
              <strong>{day.completed ? day.entry?.stamp || 'Reset' : '-'}</strong>
            </div>
          ))}
        </section>

        <section className="passport-face-map" aria-label="Face area progress">
          <div className="passport-face-visual" aria-hidden="true">
            {passport.areaProgress.map((area) => (
              <span
                className={`passport-area-dot ${area.key} ${area.completed ? 'done' : ''}`}
                key={area.key}
                style={{ '--area-progress': area.progress }}
              />
            ))}
          </div>
          <div className="passport-area-list">
            {passport.areaProgress.map((area) => (
              <article key={area.key}>
                <div>
                  <strong>{area.label}</strong>
                  <span>{area.count}/{area.target}</span>
                </div>
                <progress value={area.progress} max="1" />
              </article>
            ))}
          </div>
        </section>

        <section className="passport-save-card">
          <small>PROGRESS STATUS</small>
          <p>Saved on this device</p>
          <span>Current mode: {identity.authMode}. A platform login can later sync this passport across devices.</span>
          <button type="button">Sign in later</button>
        </section>

        <footer className="passport-actions">
          <button type="button" onClick={onRestart}>Do another reset</button>
          <button type="button" onClick={onLeaderboard}>View leaderboard</button>
        </footer>
      </main>
    </section>
  );
}
