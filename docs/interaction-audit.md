# Face Reset interaction audit

## Scope

The shared runtime is `RoutineScreen.jsx`. Face input comes from MediaPipe Face Landmarker through `useFaceLandmarks.js`; two-hand fingertip input comes from MediaPipe Hand Landmarker through `useHandTracking.js`. All scenes share the 60-second routine timer and event score UI.

| Scene | Input and previous behavior | Audit finding | Priority | Implemented change | Main files |
| --- | --- | --- | --- | --- | --- |
| Whale's Lunch | Mouth open ratio moved 30 fixed fish toward one point; progress-derived score | Fish did not recycle visually and score was not tied to fish entering the mouth | High | Smoothed mouth state with hysteresis; 24 reusable fish loop through curved intake cycles; fish and special-fish events drive score and combo | `RoutineScreen.jsx`, `styles.css` |
| Whale Dream 2 | Same mouth ratio posted into the XR iframe every 120 ms | Raw mouth jitter reached the iframe; interval cleanup already existed | Medium | Uses the same smoothed mouth state and tracking-gap tolerance as Whale's Lunch; iframe interval remains cleaned up on unmount | `RoutineScreen.jsx`, `interactionSignal.js` |
| Bunny Puff | Cheek ratio directly changed bubble size; stage score could become one-way after reaching max | Threshold flicker, no natural repeated max-size loop, score partly progress-derived | High | Smoothed puff state; partial release shrink; max-size hold gently returns to medium size; cycle, hold and stage events score once | `RoutineScreen.jsx`, `styles.css` |
| Lemon Squeeze | Both fingertip distances were averaged; ingredients only unlocked once; score followed liquid level | Single-side control was visually coupled; full glass progression became repetitive | High | Independent left/right signals and lemon deformation; press-release cycle scoring; ingredient cycle resets after varied sip events | `RoutineScreen.jsx`, `styles.css` |
| Flower Collector | Large fixed DOM sets; suction animation paused mid-flight; flower count grew from time rather than completed events | High DOM cost, abrupt paused objects, count/visual mismatch risk | High | Fixed reusable pools reduced from 292 to 150 elements; suction loops recycle continuously and fade with smoothed input; collected and special-flower events drive score | `RoutineScreen.jsx`, `styles.css` |
| Cloud Garden | Fixed rain particles looped, but both sides shared an averaged rain value; growth reached a permanent final state | Single-side presses were unclear; completion could become visually static | High | Independent cloud/rain intensity, held-input rain, press-release cycle scoring, cyclic garden growth and persistent idle motion | `RoutineScreen.jsx`, `styles.css` |

## Shared findings

| Area | Previous risk | Change |
| --- | --- | --- |
| Input stability | A landmark update directly triggered scoring; short missing-frame gaps could interrupt an interaction | Shared attack/release smoothing, separate enter/release thresholds, debounce, and 260-280 ms tracking-gap tolerance |
| State transitions | Active/idle was mostly a single threshold | Signals now expose idle, detecting, active, holding, releasing, recovering, and tracking-lost phases |
| Timing | The routine ended after 20 seconds | Routine duration is now 60 seconds |
| Scoring | Generic demo feedback score could make a scene start around 68 and progress values could score without user events | Scene score starts at zero and only scene events increase it |
| Long-run performance | Flower Collector rendered almost 300 decorative entities | Entity counts are capped and reused; no scene appends entities over time |
| Cleanup | Face and hand RAF loops, iframe sync interval, routine timers | Existing cleanup is retained; the new interaction timer is also cleared on unmount |

## Manual acceptance checks

1. Keep each scene open for at least 60 seconds and repeat the action after 10, 30, and 50 seconds.
2. Briefly move out of frame for under 250 ms; the scene should ease out instead of snapping.
3. Hold each action continuously for 3-5 seconds; feedback must continue without creating extra DOM nodes.
4. Release slowly and repeat; score should increase only on object, hold, stage, or completed-cycle events.
5. For Cloud Garden and Lemon Squeeze, test one hand at a time and then both hands together.
6. Verify iPhone portrait layouts at 390 x 844 and 430 x 932, especially camera preview, close button, score, timer, and main character.
