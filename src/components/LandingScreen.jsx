export default function LandingScreen({ onStart, isExiting = false }) {
  return (
    <section className={`screen landing-screen welcome-v3 ${isExiting ? 'is-paper-under' : ''}`}>
      <main className="welcome-v3-stage" aria-label="Face Reset introduction">
        <header className="welcome-v3-heading">
          <h1>
            FACE
            <br />
            RESET
          </h1>
          <p>Small exercises. Big face relief.</p>
        </header>

        <div className="welcome-v3-mascots" aria-hidden="true">
          <div className="welcome-v3-sticker welcome-v3-sticker-main">
            <img src="/assets/design-v3/welcome-main.png" alt="" />
          </div>
          <div className="welcome-v3-sticker welcome-v3-sticker-left">
            <img src="/assets/design-v3/welcome-left.png" alt="" />
          </div>
          <div className="welcome-v3-sticker welcome-v3-sticker-right">
            <img src="/assets/design-v3/welcome-right.png" alt="" />
          </div>
          <img
            className="welcome-v3-sparkle"
            src="/assets/design-v3/welcome-sparkle.png"
            alt=""
          />
          <div className="welcome-v3-badge">
            3 sessions A DAY
          </div>
        </div>

        <button className="welcome-v3-start" onClick={onStart} disabled={isExiting}>
          START
        </button>
      </main>
    </section>
  );
}
