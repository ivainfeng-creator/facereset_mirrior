import { useEffect, useState } from 'react';
import { loadPassportProgress } from '../utils/progressAdapter.js';
import { buildDailyPlanSummary } from '../utils/dailyPlan.js';
import { fetchProgramDayLeaderboard } from '../utils/supabaseProgressAdapter.js';

export default function LeaderboardScreen({ habit, onBack, onRestart }) {
  const passport = loadPassportProgress(habit);
  const programDay = buildDailyPlanSummary(habit).programDay;
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    void fetchProgramDayLeaderboard(programDay).then((data) => {
      if (!isCurrent) return;
      setRows(data.map((row) => ({
        rank: Number(row.rank),
        name: row.display_name || 'Anonymous',
        score: Math.max(0, Number(row.total_score) || 0),
        detail: `${row.completed_sessions}/3 sessions`,
      })));
      setIsLoading(false);
    });
    return () => {
      isCurrent = false;
    };
  }, [programDay, habit?.updatedAt]);

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
            <strong>{buildDailyPlanSummary(habit).score}</strong>
          </div>
          <div>
            <span>Streak</span>
            <strong>{passport.streak || 0}</strong>
          </div>
        </section>

        <section className="leaderboard-list">
          {rows.map((row) => (
            <article key={`${row.rank}-${row.name}`}>
              <span>{row.rank}</span>
              <div>
                <strong>{row.name}</strong>
                <small>{row.detail}</small>
              </div>
              <b>{row.score}</b>
            </article>
          ))}
          {!isLoading && !rows.length && <p>No completed Day {programDay} scores yet.</p>}
          {isLoading && <p>Loading leaderboard...</p>}
        </section>

        <footer className="passport-actions">
          <button type="button" onClick={onRestart}>Play again</button>
          <button type="button" onClick={onBack}>Back to result</button>
        </footer>
      </main>
    </section>
  );
}
