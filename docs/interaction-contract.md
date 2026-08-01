# Face Reset interaction contract

## Purpose

Every playable scene should consume the same interaction contract, regardless of whether the scene is built with CSS, SVG, Canvas, or Three.js. Scene visuals can change freely, but the detection, score, tuning, debug UI, and future platform SDK integration should share this shape.

## Runtime contract

`RoutineScreen.jsx` creates `interaction.contract` on every interaction tick. The visible scene can continue using scene-specific fields like `mouthOpen`, `sniff`, or `leftPress`, but new scenes should prefer the contract below.

```js
{
  version: 1,
  sceneId: 'whaleDream',
  actionType: 'mouth_open',
  tracking: {
    faceReady: true,
    handReady: true,
    requiresHands: false,
    detectorMode: 'real-landmark',
    handMode: 'real-landmark',
    isDemoMode: false,
    quality: 1
  },
  controls: {
    mouthOpen: 0.72,
    noseWrinkle: 0,
    cheekPuff: 0,
    leftPress: 0,
    rightPress: 0,
    sync: 0
  },
  primary: {
    value: 0.72,
    active: true,
    phase: 'holding',
    holdSeconds: 1.4,
    justActivated: false,
    justReleased: false,
    stable: true
  },
  game: {
    score: 42,
    combo: 3,
    completion: 0.56,
    eventCount: 18
  },
  feedback: {
    text: 'Great flow, little fish are swimming in',
    level: 'success'
  }
}
```

## Action types

| Action type | Primary control | Current scenes | Detection source |
| --- | --- | --- | --- |
| `mouth_open` | `controls.mouthOpen` | Whale Mouth, Whale Dream 2 | Face landmarks |
| `nose_sniff` | `controls.noseWrinkle` | Flower Collector | Face landmarks |
| `cheek_puff` | `controls.cheekPuff` | Bubble Gum Bunny | Face landmarks |
| `dual_press` | Average of `leftPress` and `rightPress` | Cloud Garden, Lemon Squeeze | Hand landmarks + face targets |

## Phase meanings

| Phase | Meaning | Typical visual response |
| --- | --- | --- |
| `idle` | User is not performing the action | Scene rests, low ambient motion |
| `detecting` | Input is near threshold but not confirmed | Hint or pre-lighting |
| `active` | Action has just crossed threshold | Start main animation |
| `holding` | Action is stable for at least half a second | Reward effects, stronger animation |
| `releasing` | User is relaxing the action | Ease out, close mouth, stop rain, shrink bubble |
| `recovering` | Completed release after active action | Optional cycle reward |
| `tracking-lost` | Face/hand input is unavailable | Pause scoring and show gentle recovery hint |

## Tuning source

Adjust interaction feel in `src/data/interactionTuning.js`.

Use this file for:

- input normalization values such as mouth baseline and range
- signal thresholds such as enter/release/activate timing
- scoring rates and bonus thresholds
- per-scene initial feedback

Avoid scattering new thresholds inside scene components. If a new scene needs a different sensitivity, add a new entry to `sceneInteractionTuning`.

## Asset contract for UI and 3D

Any new scene asset should expose controls that can be driven by:

| Contract field | Range | Suggested use |
| --- | --- | --- |
| `primary.value` | 0-1 | Main morph, animation speed, shader intensity |
| `primary.phase` | string | State machine transitions |
| `primary.stable` | boolean | Reward state and stronger visual effects |
| `game.completion` | 0-1 | Progression, clarity, fill level, growth |
| `game.combo` | integer | Bonus effects and celebratory layers |
| `feedback.level` | string | UI color or icon state |

For Three.js scenes, prefer a small adapter function like:

```js
updateSceneFromContract(contract) {
  whaleMouth.morphTargetInfluences[0] = contract.controls.mouthOpen;
  fishEmitter.rate = contract.primary.active ? 1 + contract.primary.value * 2 : 0;
  glow.material.opacity = contract.primary.stable ? 0.9 : 0.35;
}
```

## Future data adapter

Session progress now goes through `src/utils/progressAdapter.js`. It currently uses localStorage, but the interface is shaped so VIVERSE, Supabase, Firebase, or another backend can replace it later.

Stable calls:

- `loadHabitProgress()`
- `saveSessionResult(result)`
- `loadPassportProgress(habit)`
- `loadLeaderboardRows(habit)`
- `submitLeaderboardScore(result, habit)`
- `getPlayerIdentity(habit)`

New platform integrations should implement these calls without changing the screens.
