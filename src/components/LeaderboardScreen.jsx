import { loadLeaderboardRows, loadPassportProgress } from '../utils/progressAdapter.js';
import { buildDailyPlanSummary, buildProgramDayPlanSummary } from '../utils/dailyPlan.js';

export default function LeaderboardScreen({ habit, onBack, onRestart, programDay: selectedProgramDay = null }) {
  const passport = loadPassportProgress(habit);
  const currentProgramDay = buildDailyPlanSummary(habit).programDay;
  const programDay = Number.isInteger(Number(selectedProgramDay)) && Number(selectedProgramDay) > 0
    ? Number(selectedProgramDay)
    : currentProgramDay;
  const dailyPlan = buildProgramDayPlanSummary(habit, programDay);
  const rows = loadLeaderboardRows(habit);

  return (
    <section className="screen leaderboard-screen">
      <main className="leaderboard-card" aria-label="Face Reset Leaderboard">
        <button className="passport-back-button" onClick={onBack} type="button" aria-label="Back" />

        <header className="leaderboard-header">
          <p>Program Day {programDay}</p>
          <h1>Day {programDay} Leaderboard</h1>
          <span>Complete all 3 sessions to enter this Program Day ranking.</span>
        </header>

        <section className="leaderboard-user-card">
          <div>
            <span>Program day</span>
            <strong>#{programDay}</strong>
          </div>
          <div>
            <span>Daily score</span>
            <strong>{dailyPlan.score}</strong>
          </div>
          <div>
            <span>Streak</span>
            <strong>{passport.streak || 0}</strong>
          </div>
        </section>

        <section className="leaderboard-list">
          {rows.map((row) => (
            <article
              className={row.rank <= 3 ? `is-medal rank-${row.rank}` : ''}
              key={`${row.rank}-${row.name}`}
            >
              <span>{row.rank}</span>
              <div>
                <strong>{row.name}</strong>
                <small>{row.detail}</small>
              </div>
              <b>{row.score}</b>
            </article>
          ))}
          {!rows.length && <p className="leaderboard-status">No Day {programDay} scores yet.</p>}
        </section>

        <footer className="passport-actions">
          <button type="button" onClick={onRestart}>Play again</button>
          <button type="button" onClick={onBack}>Back to result</button>
        </footer>
      </main>
    </section>
  );
}
