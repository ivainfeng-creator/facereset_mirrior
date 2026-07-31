import { interactionScenes } from '../data/scenes.js';

export default function ThemeScreen({ selectedScene, onBack, onSelect }) {
  return (
    <section className="screen theme-screen">
      <main className="theme-card" aria-label="Choose Face Reset theme">
        <button className="scan-close-button theme-close-button" onClick={onBack} aria-label="Back to alignment" />

        <div className="theme-copy">
          <p>Today’s Face Reset</p>
          <h1>Pick an area</h1>
          <span>Relax one part of your face and collect today’s passport stamp.</span>
        </div>

        <div className="theme-list">
          {interactionScenes.map((scene) => (
            <button
              key={scene.id}
              className={`theme-option ${scene.symbol} ${selectedScene === scene.id ? 'is-selected' : ''}`}
              onClick={() => onSelect(scene.id)}
              type="button"
            >
              <span className="theme-symbol" aria-hidden="true" />
              <span className="theme-option-copy">
                <strong>{scene.title}</strong>
                <small>{scene.area} · {scene.subtitle}</small>
              </span>
              <span className="theme-action">{scene.action}</span>
            </button>
          ))}
        </div>
      </main>
    </section>
  );
}
