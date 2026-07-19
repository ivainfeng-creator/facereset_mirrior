export default function LandingScreen({ onStart, habit }) {
  return (
    <section className="screen landing-screen">
      <nav className="topbar">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">Face Reset Mirror</span>
        <span className="streak-pill">Day {habit.streak || 0}</span>
      </nav>

      <div className="hero-layout">
        <div className="hero-copy">
          <p className="eyebrow">AI mirror daily reset</p>
          <h1>Face Reset Mirror</h1>
          <p className="subtitle">每天 2 分鐘，跟著 AI 鏡子放鬆你的臉。</p>
          <p className="description">
            透過鏡頭對準自己的臉，跟著畫面提示完成一段眼周放鬆練習。用指尖沿著下眼周軌跡慢慢滑動，輕鬆建立每日 Face Reset 小習慣。
          </p>
          <button className="primary-button" onClick={onStart}>
            <span className="button-icon camera-icon" aria-hidden="true" />
            Start Today’s Reset
          </button>
          <p className="privacy-note">Camera is used only for real-time demo. No video is uploaded.</p>
        </div>

        <div className="mirror-preview" aria-label="Face Reset Mirror preview">
          <div className="preview-frame">
            <div className="face-guide-preview">
              <span className="eye left" />
              <span className="eye right" />
              <span className="smile-line" />
            </div>
            <div className="scan-line" />
            <div className="preview-label top">Face aligned</div>
            <div className="preview-label bottom">Relax score 88</div>
          </div>
        </div>
      </div>

      <section className="daily-section" aria-label="Daily Face Reset">
        <div>
          <p className="eyebrow">Daily Face Reset</p>
          <h2>把放鬆變成一個很好開始的小習慣</h2>
        </div>
        <div className="habit-grid">
          <article>
            <span className="mini-icon sun-icon" aria-hidden="true" />
            <h3>Morning Reset</h3>
            <p>wake up your face</p>
          </article>
          <article>
            <span className="mini-icon moon-icon" aria-hidden="true" />
            <h3>Night Relax</h3>
            <p>soften screen-time tension</p>
          </article>
          <article>
            <span className="mini-icon sparkle-icon" aria-hidden="true" />
            <h3>Eye Glide Practice</h3>
            <p>follow the under-eye path</p>
          </article>
        </div>
      </section>
    </section>
  );
}
