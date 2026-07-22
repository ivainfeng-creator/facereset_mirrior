# Face Reset Mirror

Face Reset Mirror is a mobile-first React hackathon demo for a light AI mirror facial relaxation experience. Users open the app, enable their camera, align their face, and follow a short guided Eye Relax routine focused on the under-eye area.

This is a wellness and self-care demo, not a medical, beauty-treatment, or face-shaping product. The current MVP uses browser camera access plus mock AI feedback so the full routine remains stable even when real computer vision is unavailable.

## Features

- Vite + React single-page web app
- Browser `getUserMedia` camera mirror
- Demo Mode fallback when camera permission is denied or unavailable
- Optional MediaPipe Face Landmarker integration for real facial landmarks
- Landmark-based under-eye trajectory attached to the user's face
- Rain-wiper Eye Relax interaction designed around index-finger guided wiper motion
- Guided routine with face alignment, hand tracking, countdown, progress, sound, and local scoring
- `localStorage` streak and latest result tracking
- Downloadable or shareable animated result video generated in the browser, with PNG fallback
- No backend, login, or upload flow

## Mobile UI Spec

This app is designed primarily for mobile devices in portrait orientation, using iPhone-sized screens as the reference experience.

- Primary layout target: iPhone portrait, roughly 390-430px wide and 844-932px tall.
- Desktop browser previews should still feel like a phone-sized prototype, not a wide desktop app.
- The landing page should keep the main value proposition, start button, and visual preview readable without excessive scrolling.
- The routine page should prioritize the rain-wiper interaction stage, with the camera preview and score HUD kept compact.
- The alignment page should use a full-height portrait mirror surface so face positioning feels natural on mobile.
- Result sharing should favor mobile behavior: preview first, then download or open the native share sheet when available.

## Setup

```bash
npm install
npm run dev
```

Open the local URL shown in your terminal. Camera access usually requires `localhost` or HTTPS.

## Build

```bash
npm run build
```

The production build is generated in `dist/`.

## Vercel Deployment

1. Push this project to a Git repository.
2. Import the repository in Vercel.
3. Use the default Vite settings:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Deploy. Camera access will work on the HTTPS deployment URL after the user grants permission.

## Landmark Modes

- Real landmark mode: uses MediaPipe Face Landmarker when the camera and model load successfully.
- Mock landmark mode: uses the same landmark data shape with generated points when MediaPipe cannot load.
- No-camera demo mode: uses generated landmarks without requiring camera permission.

The overlay mapper accounts for mirrored video and `object-fit: cover` sizing so SVG guidance paths stay aligned with the displayed mirror.

## Known Limitations

- Real MediaPipe landmarks require the browser to load the official Face Landmarker model asset.
- Hand or finger tracking is still mocked.
- Result scores are generated locally for demo feedback and should not be interpreted as health, medical, or beauty outcomes.

## Future Improvements

- Improve MediaPipe landmark calibration across lighting, camera distance, and face angles.
- Add MediaPipe Hand Landmarker for index-finger path tracking.
- Add smoothing filters so overlay paths move more softly when landmarks jitter.
- Add more routine packs, reminders, and richer daily habit history.
