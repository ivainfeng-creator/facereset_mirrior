# Face Reset Mirror

Face Reset Mirror is a mobile-first React hackathon demo for a light AI mirror facial relaxation experience. Users open the app, enable their camera, align their face, and follow a short guided Face Reset routine for eye relaxation, jaw release, smile stretch, and a playful expression challenge.

This is a wellness and self-care demo, not a medical, beauty-treatment, or face-shaping product. The current MVP uses browser camera access plus mock AI feedback so the full routine remains stable even when real computer vision is unavailable.

## Features

- Vite + React single-page web app
- Browser `getUserMedia` camera mirror
- Demo Mode fallback when camera permission is denied or unavailable
- Optional MediaPipe Face Landmarker integration for real facial landmarks
- Landmark-based overlay paths for under-eye, jawline, mouth corners, and full-face prompts
- Guided routine with face overlays, direction cues, countdown, progress, and mock AI scoring
- `localStorage` streak and latest result tracking
- Downloadable result card generated in the browser
- No backend, login, or upload flow

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
