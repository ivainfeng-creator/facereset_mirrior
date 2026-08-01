export default function LandingScreen({ onStart, habit }) {
  const streak = habit?.streak || 0;
  const hasCheckedInToday = habit?.latestDate === getLocalDateKey();

  return (
    <section className="screen landing-screen welcome-landing">
      <div className="welcome-streak">
        <span>{hasCheckedInToday ? 'Today done' : `Day ${Math.max(1, streak || 1)}`}</span>
      </div>

      <main className="welcome-copy" aria-label="Face Reset introduction">
        <h1>Face Reset</h1>
        <p>A playful 2-minute journey to help a different part of your face unwind.</p>
      </main>

      <button className="journey-button" onClick={onStart}>
        <span>Start Journey</span>
        <span className="journey-arrow" aria-hidden="true" />
      </button>
    </section>
  );
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
