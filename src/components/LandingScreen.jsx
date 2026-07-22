export default function LandingScreen({ onStart }) {
  return (
    <section className="screen landing-screen welcome-landing">
      <main className="welcome-copy" aria-label="Face Reset introduction">
        <h1>Face Reset</h1>
        <p>A playful 2-minute journey to help your face unwind.</p>
      </main>

      <button className="journey-button" onClick={onStart}>
        <span>Start Journey</span>
        <span className="journey-arrow" aria-hidden="true" />
      </button>
    </section>
  );
}
