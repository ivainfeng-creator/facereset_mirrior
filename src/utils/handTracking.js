import { LANDMARK_MODES, mapNormalizedPointToCanvas } from './faceLandmarks.js';

const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';
const VISION_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const INDEX_FINGERTIP_INDEX = 8;
const INDEX_DIP_INDEX = 7;
const INDEX_PIP_INDEX = 6;

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
          numHands: 2,
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

export function normalizeAllHandLandmarks(result, mode = LANDMARK_MODES.real) {
  const hands = result?.landmarks;
  if (!Array.isArray(hands) || hands.length === 0) return [];
  return hands
    .filter((landmarks) => Array.isArray(landmarks) && landmarks.length > INDEX_FINGERTIP_INDEX)
    .map((landmarks) => ({
      mode,
      normalizedLandmarks: landmarks.map((point) => ({
        x: point.x,
        y: point.y,
        z: point.z ?? 0,
      })),
      detectedAt: performance.now(),
    }));
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

export function getIndexFingerControlPoint(handData) {
  const tip = handData?.normalizedLandmarks?.[INDEX_FINGERTIP_INDEX];
  const dip = handData?.normalizedLandmarks?.[INDEX_DIP_INDEX];
  const pip = handData?.normalizedLandmarks?.[INDEX_PIP_INDEX];
  if (!tip) return null;
  if (!dip || !pip) return getIndexFingertip(handData);

  return {
    x: tip.x * 0.72 + dip.x * 0.2 + pip.x * 0.08,
    y: tip.y * 0.74 + dip.y * 0.18 + pip.y * 0.08,
    z: tip.z ?? 0,
  };
}

export function mapHandCoordinatesToCanvas(point, displayRect, options = {}) {
  if (!point || !displayRect) return null;
  return mapNormalizedPointToCanvas(point, displayRect, options);
}

export function createMockFingertip(trajectories, time = performance.now()) {
  const paths = getTrajectoryList(trajectories);
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

export function createMockFingertips(trajectories, time = performance.now()) {
  const paths = getTrajectoryList(trajectories);
  if (!paths.length) {
    return {
      left: null,
      right: null,
      all: [],
      mode: LANDMARK_MODES.demo,
      label: 'Waiting for guide path',
    };
  }

  const loop = (time % 3200) / 3200;
  const phase = loop < 0.5 ? loop * 2 : 2 - loop * 2;
  const left = samplePathByProgress(paths[0].points, phase);
  const right = samplePathByProgress((paths[1] || paths[0]).points, phase);

  return {
    left,
    right,
    all: [left, right],
    mode: LANDMARK_MODES.demo,
    label: 'Mock two-finger wiper',
  };
}

function samplePathByProgress(points, progress) {
  if (!points.length) return null;
  const index = Math.min(points.length - 1, Math.round(progress * (points.length - 1)));
  return points[index];
}

function getTrajectoryList(trajectories) {
  if (Array.isArray(trajectories)) {
    return trajectories.filter((trajectory) => trajectory?.points?.length > 1);
  }
  if (Array.isArray(trajectories?.all)) {
    return trajectories.all.filter((trajectory) => trajectory?.points?.length > 1);
  }
  return [trajectories?.left, trajectories?.right].filter((trajectory) => trajectory?.points?.length > 1);
}
