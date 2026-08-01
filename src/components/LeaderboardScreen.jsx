import { loadLeaderboardRows, loadPassportProgress, submitLeaderboardScore } from '../utils/progressAdapter.js';

export default function LeaderboardScreen({ habit, onBack, onRestart }) {
  const rows = loadLeaderboardRows(habit);
  const passport = loadPassportProgress(habit);
  const submission = submitLeaderboardScore({ score: habit?.latestScore }, habit);
  const userRow = rows.find((row) => row.isUser) || rows[0];

  return (
    <section className="screen leaderboard-screen">
      <main className="leaderboard-card" aria-label="Face Reset Leaderboard">
        <button className="passport-back-button" onClick={onBack} type="button" aria-label="Back" />

        <header className="leaderboard-header">
          <p>Today’s playful rank</p>
          <h1>Top {userRow.percentile || Math.max(4, 24 - userRow.rank * 4)}%</h1>
          <span>Local leaderboard · {passport.totalSessions || 0} saved resets on this device</span>
        </header>

        <section className="leaderboard-user-card">
          <div>
            <span>Your rank</span>
            <strong>#{userRow.rank}</strong>
          </div>
          <div>
            <span>Best score</span>
            <strong>{userRow.score}</strong>
          </div>
          <div>
            <span>Streak</span>
            <strong>{passport.streak || 0}</strong>
          </div>
        </section>

        <section className="leaderboard-list">
          {rows.map((row) => (
            <article className={row.isUser ? 'is-user' : ''} key={row.name}>
              <span>{row.rank}</span>
              <div>
                <strong>{row.name}</strong>
                <small>{row.detail}</small>
              </div>
              <b>{row.score}</b>
            </article>
          ))}
        </section>

        <section className="leaderboard-sdk-card">
          <p>Adapter slot · {submission.provider}</p>
          <span>Scores use the local adapter now. The same call can later submit to VIVERSE Leaderboard.</span>
        </section>

        <footer className="passport-actions">
          <button type="button" onClick={onRestart}>Play again</button>
          <button type="button" onClick={onBack}>Back to result</button>
        </footer>
      </main>
    </section>
  );
}
