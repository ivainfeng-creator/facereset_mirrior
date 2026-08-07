import { useRef, useState } from 'react';

export default function LandingScreen({ onStart }) {
  const mascotRef = useRef(null);
  const [eyeOffset, setEyeOffset] = useState(null);

  const handlePointerMove = (event) => {
    const box = mascotRef.current?.getBoundingClientRect();
    if (!box) return;
    const percent = (event.clientX - box.left) / box.width;
    const clamped = Math.max(0, Math.min(1, percent));
    setEyeOffset(Math.round(clamped * 30));
  };

  return (
    <section
      className="screen landing-screen welcome-landing welcome-v2"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setEyeOffset(null)}
    >
      <main className="welcome-v2-stage" aria-label="Face Reset introduction">
        <div className="welcome-v2-logo" aria-hidden="true">
          <div
            className={`welcome-mascot ${eyeOffset === null ? 'is-idle' : 'is-following'}`}
            ref={mascotRef}
            style={eyeOffset === null ? undefined : { '--fr-look': `${eyeOffset}px` }}
          >
            <span className="welcome-bracket">(</span>
            <svg className="welcome-eyes" viewBox="44 72 143 75" focusable="false">
              <defs>
                <clipPath id="welcome-eye-left">
                  <path
                    transform="translate(50 78.2) scale(0.43382)"
                    d="M135.5 56.5C135.5 67 104.003 70.5 67 70.5C29.9969 70.5 0 69.5 0 56.5C0 25.2959 29.9969 0 67 0C104.003 0 135.5 25.2959 135.5 56.5Z"
                  />
                </clipPath>
                <clipPath id="welcome-eye-right">
                  <path
                    transform="translate(122 78.2) scale(0.43382)"
                    d="M135.5 56.5C135.5 67 104.003 70.5 67 70.5C29.9969 70.5 0 69.5 0 56.5C0 25.2959 29.9969 0 67 0C104.003 0 135.5 25.2959 135.5 56.5Z"
                  />
                </clipPath>
              </defs>
              <path
                transform="translate(50 78.2) scale(0.43382)"
                fill="#ffffff"
                d="M135.5 56.5C135.5 67 104.003 70.5 67 70.5C29.9969 70.5 0 69.5 0 56.5C0 25.2959 29.9969 0 67 0C104.003 0 135.5 25.2959 135.5 56.5Z"
              />
              <path
                transform="translate(122 78.2) scale(0.43382)"
                fill="#ffffff"
                d="M135.5 56.5C135.5 67 104.003 70.5 67 70.5C29.9969 70.5 0 69.5 0 56.5C0 25.2959 29.9969 0 67 0C104.003 0 135.5 25.2959 135.5 56.5Z"
              />
              <g clipPath="url(#welcome-eye-left)">
                <circle className="welcome-pupil" cx="63.9" cy="92.1" r="20" fill="#404040" />
              </g>
              <g clipPath="url(#welcome-eye-right)">
                <circle className="welcome-pupil" cx="135.9" cy="92.1" r="20" fill="#404040" />
              </g>
              <path
                transform="translate(104.6 115) scale(0.4565)"
                fill="#404040"
                d="M45.5 0C45.5 13.3735 43.2459 26.9535 39.6055 37.3105C37.7918 42.4704 35.56 47.0438 32.9316 50.4092C30.376 53.6814 26.8804 56.5 22.5 56.5C18.4669 56.5 15.0473 54.407 12.3711 51.5312C9.70015 48.6612 7.47837 44.7266 5.69629 40.1992C2.12266 31.1203 0 18.8506 0 5.5H8C8 18.1066 10.0186 29.3369 13.1406 37.2686C14.7064 41.2464 16.4719 44.1945 18.2275 46.0811C19.9779 47.9619 21.4245 48.5 22.5 48.5C23.2282 48.5 24.6622 48.001 26.627 45.4854C28.5189 43.0628 30.3984 39.3777 32.0576 34.6572C35.3628 25.2537 37.5 12.5837 37.5 0H45.5Z"
              />
            </svg>
            <span className="welcome-bracket">)</span>
          </div>
        </div>

        <div className="welcome-v2-bottom">
          <div className="welcome-v2-title-stack" aria-hidden="true">
            <span className="welcome-v2-word">FACE</span>
            <span className="welcome-v2-word">RESET</span>
          </div>

          <p>
            A playful <strong>3-minute</strong> session
            <br />
            to relax your face.
          </p>

          <button className="journey-button welcome-start-button" onClick={onStart}>
            <span>Start</span>
          </button>
        </div>
      </main>
    </section>
  );
}
