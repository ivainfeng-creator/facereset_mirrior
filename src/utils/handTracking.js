import { LANDMARK_MODES, mapNormalizedPointToCanvas } from './faceLandmarks.js';

const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';
const VISION_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const INDEX_FINGERTIP_INDEX = 8;

let handLandmarkerPromise = null;

export async function initializeHandLandmarker() {
  if (!handLandmarkerPromise) {
    handLandmarkerPromise = import('@mediapipe/tasks-vision').then(
      async ({ FilesetResolver, HandLandmarker }) => {
        const vision = await FilesetResolver.forVisionTasks(VISION_WASM_URL);
        return HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: HAND_MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });
      },
    );
  }

  return handLandmarkerPromise;
}

export function normalizeHandLandmarks(result, mode = LANDMARK_MODES.real) {
  const landmarks = result?.landmarks?.[0];
  if (!Array.isArray(landmarks) || landmarks.length === 0) return null;
  return {
    mode,
    normalizedLandmarks: landmarks.map((point) => ({
      x: point.x,
      y: point.y,
      z: point.z ?? 0,
    })),
    detectedAt: performance.now(),
  };
}

export function getIndexFingertip(handData) {
  const point = handData?.normalizedLandmarks?.[INDEX_FINGERTIP_INDEX];
  if (!point) return null;
  return {
    x: point.x,
    y: point.y,
    z: point.z ?? 0,
  };
}

export function mapHandCoordinatesToCanvas(point, displayRect, options = {}) {
  if (!point || !displayRect) return null;
  return mapNormalizedPointToCanvas(point, displayRect, options);
}

export function createMockFingertip(trajectories, time = performance.now()) {
  const paths = trajectories?.filter((trajectory) => trajectory?.points?.length > 1) || [];
  if (!paths.length) {
    return {
      point: null,
      mode: LANDMARK_MODES.demo,
      label: 'Waiting for guide path',
    };
  }

  const pathIndex = Math.floor(time / 3200) % paths.length;
  const path = paths[pathIndex];
  const loop = (time % 3200) / 3200;
  const eased = 0.5 - Math.cos(loop * Math.PI) / 2;
  const point = samplePathByProgress(path.points, eased);

  return {
    point,
    mode: LANDMARK_MODES.demo,
    label: 'Mock fingertip',
  };
}

function samplePathByProgress(points, progress) {
  if (!points.length) return null;
  const index = Math.min(points.length - 1, Math.round(progress * (points.length - 1)));
  return points[index];
}
