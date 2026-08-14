export const LANDMARK_MODES = {
  real: 'real-landmark',
  mock: 'mock-landmark',
  demo: 'no-camera-demo',
};

const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';
const VISION_WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';

const landmarkIndexes = {
  noseCenter: 1,
  chin: 152,
  mouthLeft: 61,
  mouthRight: 291,
  mouthCenter: 13,
  mouthBottom: 14,
  faceTop: 10,
  faceLeft: 234,
  faceRight: 454,
  leftEyeInner: 133,
  leftEyeOuter: 33,
  leftEyeUpper: 159,
  leftEyeLower: 145,
  rightEyeInner: 362,
  rightEyeOuter: 263,
  rightEyeUpper: 386,
  rightEyeLower: 374,
  jawLeft: 172,
  jawRight: 397,
};

const FACE_OVAL_INDEXES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109,
];

const REQUIRED_FEATURES = [
  'noseCenter',
  'chin',
  'mouthLeft',
  'mouthRight',
  'mouthCenter',
  'mouthBottom',
  'faceTop',
  'faceLeft',
  'faceRight',
  'leftEyeInner',
  'leftEyeOuter',
  'leftEyeLower',
  'rightEyeInner',
  'rightEyeOuter',
  'rightEyeLower',
  'jawLeft',
  'jawRight',
];

let faceLandmarkerPromise = null;

export async function createFaceLandmarker() {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = import('@mediapipe/tasks-vision').then(
      async ({ FaceLandmarker, FilesetResolver }) => {
        const vision = await FilesetResolver.forVisionTasks(VISION_WASM_URL);
        const baseOptions = {
          modelAssetPath: FACE_MODEL_URL,
        };
        const options = {
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
        };

        try {
          return await FaceLandmarker.createFromOptions(vision, {
            ...options,
            baseOptions: {
              ...baseOptions,
              delegate: 'GPU',
            },
          });
        } catch {
          return FaceLandmarker.createFromOptions(vision, {
            ...options,
            baseOptions: {
              ...baseOptions,
              delegate: 'CPU',
            },
          });
        }
      },
    );
  }

  return faceLandmarkerPromise;
}

export function normalizeLandmarkData(result, mode = LANDMARK_MODES.real) {
  const landmarks = result?.faceLandmarks?.[0];
  if (!Array.isArray(landmarks) || landmarks.length === 0) return null;
  const blendshapes = normalizeBlendshapes(result?.faceBlendshapes?.[0]);
  return {
    mode,
    normalizedLandmarks: landmarks.map((point) => ({
      x: clamp(point.x, -0.5, 1.5),
      y: clamp(point.y, -0.5, 1.5),
      z: point.z ?? 0,
    })),
    blendshapes,
    detectedAt: performance.now(),
  };
}

export function createMockLandmarkData(mode = LANDMARK_MODES.mock, time = performance.now()) {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const driftX = Math.sin(time / 1800) * 0.035;
  const driftY = Math.cos(time / 2100) * 0.018;
  const center = { x: 0.5 + driftX, y: 0.5 + driftY };
  const points = {
    noseCenter: [center.x, center.y],
    faceTop: [center.x, center.y - 0.315],
    chin: [center.x, center.y + 0.335],
    faceLeft: [center.x - 0.235, center.y + 0.01],
    faceRight: [center.x + 0.235, center.y + 0.01],
    leftEyeInner: [center.x - 0.058, center.y - 0.115],
    leftEyeOuter: [center.x - 0.165, center.y - 0.118],
    leftEyeUpper: [center.x - 0.112, center.y - 0.148],
    leftEyeLower: [center.x - 0.112, center.y - 0.087],
    rightEyeInner: [center.x + 0.058, center.y - 0.115],
    rightEyeOuter: [center.x + 0.165, center.y - 0.118],
    rightEyeUpper: [center.x + 0.112, center.y - 0.148],
    rightEyeLower: [center.x + 0.112, center.y - 0.087],
    mouthLeft: [center.x - 0.105, center.y + 0.175],
    mouthRight: [center.x + 0.105, center.y + 0.175],
    mouthCenter: [center.x, center.y + 0.155],
    mouthBottom: [center.x, center.y + 0.155 + 0.018 + (Math.sin(time / 820) + 1) * 0.036],
    jawLeft: [center.x - 0.185, center.y + 0.255],
    jawRight: [center.x + 0.185, center.y + 0.255],
  };

  Object.entries(points).forEach(([key, [x, y]]) => {
    landmarks[landmarkIndexes[key]] = { x, y, z: 0 };
  });

  FACE_OVAL_INDEXES.forEach((index, pointIndex) => {
    const angle = (pointIndex / FACE_OVAL_INDEXES.length) * Math.PI * 2;
    landmarks[index] = {
      x: center.x + Math.sin(angle) * 0.225,
      y: center.y - Math.cos(angle) * 0.315,
      z: 0,
    };
  });

  return {
    mode,
    normalizedLandmarks: landmarks,
    blendshapes: {
      noseSneerLeft: (Math.sin(time / 720) + 1) * 0.44,
      noseSneerRight: (Math.sin(time / 760 + 0.6) + 1) * 0.42,
      mouthUpperUpLeft: (Math.sin(time / 720 + 0.3) + 1) * 0.28,
      mouthUpperUpRight: (Math.sin(time / 760 + 0.9) + 1) * 0.26,
      cheekPuff: (Math.sin(time / 1100) + 1) * 0.46,
      mouthPucker: (Math.sin(time / 1180 + 0.45) + 1) * 0.32,
    },
    detectedAt: time,
  };
}

export function getVideoDisplayRect(videoSize, containerSize, objectFit = 'cover') {
  if (!videoSize.width || !videoSize.height || !containerSize.width || !containerSize.height) {
    return {
      x: 0,
      y: 0,
      width: containerSize.width || 1,
      height: containerSize.height || 1,
      scale: 1,
    };
  }

  const scaleFunction = objectFit === 'contain' ? Math.min : Math.max;
  const scale = scaleFunction(containerSize.width / videoSize.width, containerSize.height / videoSize.height);
  const width = videoSize.width * scale;
  const height = videoSize.height * scale;

  return {
    x: (containerSize.width - width) / 2,
    y: (containerSize.height - height) / 2,
    width,
    height,
    scale,
  };
}

export function mapNormalizedPointToCanvas(point, displayRect, { mirrored = true } = {}) {
  const x = mirrored ? 1 - point.x : point.x;
  return {
    x: displayRect.x + x * displayRect.width,
    y: displayRect.y + point.y * displayRect.height,
    z: point.z ?? 0,
  };
}

export function extractFaceFeatures(landmarkData, displayRect, options = {}) {
  if (!landmarkData?.normalizedLandmarks?.length || !displayRect) return null;
  const getPoint = (name) =>
    mapNormalizedPointToCanvas(landmarkData.normalizedLandmarks[landmarkIndexes[name]], displayRect, options);
  const getIndexPoint = (index) =>
    mapNormalizedPointToCanvas(landmarkData.normalizedLandmarks[index], displayRect, options);

  const leftEye = normalizeEyeRegion({
    inner: getPoint('leftEyeInner'),
    outer: getPoint('leftEyeOuter'),
    upper: getPoint('leftEyeUpper'),
    lower: getPoint('leftEyeLower'),
  });
  const rightEye = normalizeEyeRegion({
    inner: getPoint('rightEyeInner'),
    outer: getPoint('rightEyeOuter'),
    upper: getPoint('rightEyeUpper'),
    lower: getPoint('rightEyeLower'),
  });
  const mouthUpper = getPoint('mouthCenter');
  const mouthLower = getPoint('mouthBottom');
  const mouthWidth = distance(getPoint('mouthLeft'), getPoint('mouthRight'));
  const mouthOpenDistance = distance(mouthUpper, mouthLower);
  const mouth = {
    leftCorner: getPoint('mouthLeft'),
    rightCorner: getPoint('mouthRight'),
    upper: mouthUpper,
    lower: mouthLower,
    center: midpoint(mouthUpper, mouthLower),
    openDistance: mouthOpenDistance,
    openRatio: mouthWidth ? mouthOpenDistance / mouthWidth : 0,
    width: mouthWidth,
  };
  const jaw = {
    left: getPoint('jawLeft'),
    right: getPoint('jawRight'),
    chin: getPoint('chin'),
  };
  const face = {
    top: getPoint('faceTop'),
    left: getPoint('faceLeft'),
    right: getPoint('faceRight'),
    chin: jaw.chin,
    noseCenter: getPoint('noseCenter'),
  };
  const faceOval = FACE_OVAL_INDEXES.map(getIndexPoint).filter(isPoint);
  const bounds = getDisplayFaceBounds({ face, leftEye, rightEye, mouth, jaw, faceOval });
  const faceScale = Math.max(bounds.width, bounds.height);

  return {
    mode: landmarkData.mode,
    leftEye,
    rightEye,
    mouth,
    jaw,
    face,
    faceScale,
    blendshapes: landmarkData.blendshapes || {},
    nose: {
      center: face.noseCenter,
      sniffRatio: getNoseSniffRatio({
        blendshapes: landmarkData.blendshapes || {},
        face,
        mouth,
        faceScale,
      }),
    },
    cheeks: {
      puffRatio: getCheekPuffRatio({
        blendshapes: landmarkData.blendshapes || {},
        mouth,
        faceScale,
      }),
    },
    eyeRegions: extractEyeRegions({ leftEye, rightEye, mouth, faceScale }),
    hasRequiredLandmarks: hasRequiredLandmarks(landmarkData.normalizedLandmarks),
    bounds,
    faceOval,
  };
}

function normalizeBlendshapes(faceBlendshape) {
  const categories = faceBlendshape?.categories;
  if (!Array.isArray(categories)) return {};
  return categories.reduce((result, category) => {
    if (category?.categoryName) {
      result[category.categoryName] = category.score || 0;
    }
    return result;
  }, {});
}

function getNoseSniffRatio({ blendshapes, face, mouth, faceScale }) {
  const blendshapeSignal = Math.max(
    blendshapes.noseSneerLeft || 0,
    blendshapes.noseSneerRight || 0,
    ((blendshapes.mouthUpperUpLeft || 0) + (blendshapes.mouthUpperUpRight || 0)) * 0.62,
  );

  if (blendshapeSignal > 0.03) {
    return clamp(blendshapeSignal / 0.72, 0, 1);
  }

  const noseToMouth = distance(face.noseCenter, mouth.upper);
  const normalized = faceScale ? noseToMouth / faceScale : 0.16;
  return clamp((0.18 - normalized) / 0.07, 0, 1);
}

function getCheekPuffRatio({ blendshapes, mouth, faceScale }) {
  const blendshapeSignal = Math.max(
    blendshapes.cheekPuff || 0,
    (blendshapes.mouthPucker || 0) * 0.72,
    (blendshapes.mouthFunnel || 0) * 0.56,
  );

  if (blendshapeSignal > 0.03) {
    return clamp(blendshapeSignal / 0.72, 0, 1);
  }

  const mouthOpen = mouth.openRatio || 0;
  const mouthWidthRatio = faceScale ? mouth.width / faceScale : 0.26;
  return clamp((0.32 - mouthWidthRatio) / 0.14 + (0.12 - mouthOpen) / 0.18, 0, 1);
}

export function getDisplayFaceBounds({ face, leftEye, rightEye, mouth, jaw, faceOval = [] }) {
  const eyeWidth = distance(leftEye.outer, rightEye.outer);
  const eyeCenter = midpoint(leftEye.center, rightEye.center);
  const eyeToChin = Math.max(80, Math.abs(jaw.chin.y - eyeCenter.y));
  const centerX = face.noseCenter.x;
  const topY = Math.min(face.top.y, eyeCenter.y - eyeToChin * 0.78);
  const bottomY = jaw.chin.y - eyeToChin * 0.16;
  const height = Math.max(eyeToChin * 1.06, bottomY - topY);
  const width = Math.max(eyeWidth * 1.76, height * 0.78);
  const x = centerX - width / 2;
  const y = bottomY - height;

  if (faceOval.length < 8) {
    return {
      x,
      y,
      width,
      height,
      center: {
        x: centerX,
        y: y + height / 2,
      },
    };
  }

  const ovalBounds = getFeatureBounds(faceOval);
  const blendedY = y * 0.9 + ovalBounds.y * 0.1 - eyeToChin * 0.02;
  const blendedHeight = height * 0.92 + ovalBounds.height * 0.08;

  return {
    x,
    y: blendedY,
    width,
    height: blendedHeight,
    center: {
      x: centerX,
      y: blendedY + blendedHeight / 2,
    },
  };
}

export function getAlignmentState(features, containerSize, stability = {}) {
  return getFaceAlignmentStatus(features, containerSize, stability);
}

export function getFaceAlignmentStatus(features, containerSize, stability = {}) {
  if (!features || !containerSize?.width || !containerSize?.height) {
    return {
      label: 'Looking for landmarks',
      quality: 18,
      ready: false,
      checks: createChecks(false),
    };
  }

  const width = features.bounds.width / containerSize.width;
  const height = features.bounds.height / containerSize.height;
  const eyeDistance = distance(features.leftEye.center, features.rightEye.center) / containerSize.width;
  const centerX = features.face.noseCenter.x / containerSize.width;
  const centerY = features.face.noseCenter.y / containerSize.height;
  const centered = centerX > 0.31 && centerX < 0.69 && centerY > 0.24 && centerY < 0.67;
  const closeEnough = width > 0.16 && height > 0.24 && eyeDistance > 0.105;
  const notTooClose = width < 0.78 && height < 0.9 && eyeDistance < 0.4;
  const eyesVisible = isUsableEye(features.leftEye) && isUsableEye(features.rightEye);
  const mouthAndChinVisible = isPoint(features.mouth.leftCorner) && isPoint(features.mouth.rightCorner) && isPoint(features.jaw.chin);
  const requiredLandmarks = features.hasRequiredLandmarks;
  const stable = Boolean(stability.stable);
  const stabilityMs = stability.stabilityMs || 0;

  const checks = {
    centered,
    distance: closeEnough && notTooClose,
    eyes: eyesVisible,
    mouthChin: mouthAndChinVisible,
    stable,
  };

  const passed = Object.values(checks).filter(Boolean).length;
  const quality = Math.round(24 + passed * 14 + Math.min(18, stabilityMs / 90));

  if (!requiredLandmarks || !eyesVisible || !mouthAndChinVisible) {
    return { label: 'Looking for landmarks', quality: Math.max(26, quality), ready: false, checks };
  }
  if (!closeEnough) return { label: 'Move closer', quality: Math.max(38, quality), ready: false, checks };
  if (!notTooClose) return { label: 'Move back a little', quality: Math.max(48, quality), ready: false, checks };
  if (!centered) return { label: 'Center your face', quality: Math.max(58, quality), ready: false, checks };
  if (!stable) {
    return { label: 'Face aligned', quality: Math.max(72, quality), ready: false, checks };
  }

  return { label: 'Landmarks ready', quality: 96, ready: true, checks };
}

export function extractEyeRegions(featuresOrLandmarks) {
  if (!featuresOrLandmarks) return null;
  if (Array.isArray(featuresOrLandmarks)) {
    const pick = (name) => featuresOrLandmarks[landmarkIndexes[name]];
    return {
      left: normalizeEyeRegion({
        inner: pick('leftEyeInner'),
        outer: pick('leftEyeOuter'),
        upper: pick('leftEyeUpper'),
        lower: pick('leftEyeLower'),
      }),
      right: normalizeEyeRegion({
        inner: pick('rightEyeInner'),
        outer: pick('rightEyeOuter'),
        upper: pick('rightEyeUpper'),
        lower: pick('rightEyeLower'),
      }),
    };
  }

  const { leftEye, rightEye, mouth, faceScale } = featuresOrLandmarks;
  return {
    left: getUnderEyePath(leftEye, getFaceScaleForEye(leftEye, mouth, faceScale)),
    right: getUnderEyePath(rightEye, getFaceScaleForEye(rightEye, mouth, faceScale)),
  };
}

export function getUnderEyePath(eyeLandmarks, faceScale = 160) {
  if (!eyeLandmarks) return null;
  const eyeWidth = distance(eyeLandmarks.inner, eyeLandmarks.outer);
  const downwardOffset = clamp(faceScale * 0.055, 12, Math.max(18, eyeWidth * 0.24));
  const center = eyeLandmarks.center || midpoint(eyeLandmarks.inner, eyeLandmarks.outer);
  const lowerY = Math.max(eyeLandmarks.lower.y, eyeLandmarks.inner.y, eyeLandmarks.outer.y);
  const start = {
    x: eyeLandmarks.inner.x,
    y: lowerY + downwardOffset * 0.82,
  };
  const middle = {
    x: center.x,
    y: Math.max(lowerY, center.y) + downwardOffset * 1.18,
  };
  const end = {
    x: eyeLandmarks.outer.x,
    y: lowerY + downwardOffset * 0.82,
  };

  return {
    ...eyeLandmarks,
    start,
    middle,
    end,
    offset: downwardOffset,
    highlightRadiusX: Math.max(eyeWidth * 0.56, 30),
    highlightRadiusY: Math.max(downwardOffset * 0.9, 12),
  };
}

export function getFeatureBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    },
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createChecks(value) {
  return {
    centered: value,
    distance: value,
    eyes: value,
    mouthChin: value,
    stable: value,
  };
}

function hasRequiredLandmarks(landmarks) {
  return REQUIRED_FEATURES.every((name) => isNormalizedPoint(landmarks[landmarkIndexes[name]]));
}

function normalizeEyeRegion(eye) {
  return {
    ...eye,
    center: midpoint(eye.inner, eye.outer),
    width: distance(eye.inner, eye.outer),
    height: Math.max(4, distance(eye.upper, eye.lower)),
  };
}

function getFaceScaleForEye(eye, mouth, faceScale) {
  if (!eye || !mouth) return faceScale || 160;
  const eyeToMouth = Math.abs(mouth.center.y - eye.center.y);
  return Math.max(faceScale * 0.18, eyeToMouth);
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function distance(a, b) {
  if (!isPoint(a) || !isPoint(b)) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isUsableEye(eye) {
  return isPoint(eye?.inner) && isPoint(eye?.outer) && isPoint(eye?.lower) && eye.width > 12 && eye.height > 3;
}

function isPoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function isNormalizedPoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y) && point.x >= -0.05 && point.x <= 1.05 && point.y >= -0.05 && point.y <= 1.05;
}
