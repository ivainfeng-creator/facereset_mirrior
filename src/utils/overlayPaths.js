import { getFeatureBounds, getUnderEyePath } from './faceLandmarks.js';

export function generateUnderEyeMassagePaths(features) {
  return createUnderEyeCurve(features?.leftEye, features?.rightEye, features?.faceScale, features?.mouth);
}

export function createUnderEyeCurve(leftEye, rightEye, faceScale = 160, mouth = null) {
  if (!leftEye || !rightEye) return [];
  return [leftEye, rightEye].map((eye, index) => {
    const eyeScale = mouth ? Math.max(faceScale * 0.18, Math.abs(mouth.center.y - eye.center.y)) : faceScale;
    const underEye = getUnderEyePath(eye, eyeScale);
    const start = underEye.start;
    const control = underEye.middle;
    const end = underEye.end;
    const points = sampleQuadratic(start, control, end, 34);
    const dots = sampleQuadratic(start, control, end, 7);
    const arrow = createArrowForCurve(dots);
    const trackWidth = clamp(faceScale * 0.062, 24, 38);

    return {
      id: index === 0 ? 'under-eye-left' : 'under-eye-right',
      label: index === 0 ? 'Left under-eye glide' : 'Right under-eye glide',
      d: quadraticPath(start, control, end),
      start,
      end,
      control,
      points,
      dots,
      arrow,
      tolerance: trackWidth * 0.72,
      trackWidth,
      highlight: createUnderEyeHighlight(underEye),
    };
  });
}

export function createUnderEyePath(faceLandmarks) {
  return generateUnderEyeMassagePaths(faceLandmarks);
}

export function createJawlinePath(jawLandmarks, faceScale = 180) {
  if (!jawLandmarks) return [];
  const { chin, left, right } = jawLandmarks;
  const lift = clamp(faceScale * 0.035, 8, 24);
  const leftControl = {
    x: (chin.x + left.x) / 2,
    y: Math.max(chin.y, left.y) + lift,
  };
  const rightControl = {
    x: (chin.x + right.x) / 2,
    y: Math.max(chin.y, right.y) + lift,
  };

  return [
    {
      id: 'jaw-left',
      label: 'Chin to left jaw',
      d: quadraticPath(chin, leftControl, left),
      start: chin,
      end: left,
      control: leftControl,
      points: sampleQuadratic(chin, leftControl, left, 36),
      dots: sampleQuadratic(chin, leftControl, left, 7),
      tolerance: clamp(faceScale * 0.07, 28, 44),
      trackWidth: clamp(faceScale * 0.075, 28, 42),
    },
    {
      id: 'jaw-right',
      label: 'Chin to right jaw',
      d: quadraticPath(chin, rightControl, right),
      start: chin,
      end: right,
      control: rightControl,
      points: sampleQuadratic(chin, rightControl, right, 36),
      dots: sampleQuadratic(chin, rightControl, right, 7),
      tolerance: clamp(faceScale * 0.07, 28, 44),
      trackWidth: clamp(faceScale * 0.075, 28, 42),
    },
  ];
}

export function createJawReleasePath(faceLandmarks) {
  if (!faceLandmarks) return [];
  return createJawlinePath(faceLandmarks.jaw, faceLandmarks.faceScale);
}

export function createMouthCornerHighlights(mouthLandmarks, faceScale = 160) {
  if (!mouthLandmarks) return [];
  const radius = clamp(faceScale * 0.045, 15, 30);
  return [
    { ...mouthLandmarks.leftCorner, radius },
    { ...mouthLandmarks.rightCorner, radius },
  ];
}

export function createSmileStretchPath(faceLandmarks) {
  if (!faceLandmarks) return [];
  const { mouth, faceScale } = faceLandmarks;
  const mouthWidth = distance(mouth.leftCorner, mouth.rightCorner);
  const outward = Math.max(22, mouthWidth * 0.28);
  const lift = Math.max(10, mouthWidth * 0.11);
  const trackWidth = clamp(faceScale * 0.055, 22, 34);
  const leftEnd = {
    x: mouth.leftCorner.x - outward,
    y: mouth.leftCorner.y - lift,
  };
  const rightEnd = {
    x: mouth.rightCorner.x + outward,
    y: mouth.rightCorner.y - lift,
  };
  const leftControl = {
    x: mouth.leftCorner.x - outward * 0.52,
    y: mouth.leftCorner.y + lift * 0.12,
  };
  const rightControl = {
    x: mouth.rightCorner.x + outward * 0.52,
    y: mouth.rightCorner.y + lift * 0.12,
  };

  return [
    {
      id: 'smile-left',
      label: 'Left mouth corner lift',
      d: quadraticPath(mouth.leftCorner, leftControl, leftEnd),
      start: mouth.leftCorner,
      end: leftEnd,
      control: leftControl,
      points: sampleQuadratic(mouth.leftCorner, leftControl, leftEnd, 28),
      dots: sampleQuadratic(mouth.leftCorner, leftControl, leftEnd, 6),
      tolerance: trackWidth * 0.78,
      trackWidth,
    },
    {
      id: 'smile-right',
      label: 'Right mouth corner lift',
      d: quadraticPath(mouth.rightCorner, rightControl, rightEnd),
      start: mouth.rightCorner,
      end: rightEnd,
      control: rightControl,
      points: sampleQuadratic(mouth.rightCorner, rightControl, rightEnd, 28),
      dots: sampleQuadratic(mouth.rightCorner, rightControl, rightEnd, 6),
      tolerance: trackWidth * 0.78,
      trackWidth,
    },
  ];
}

export function generateJawlineMassagePaths(features) {
  if (!features) return [];
  return createJawlinePath(features.jaw, features.faceScale);
}

export function generateMouthCornerHighlights(features) {
  if (!features) return [];
  return createMouthCornerHighlights(features.mouth, features.faceScale);
}

export function generateSmileGuidePath(features) {
  if (!features) return '';
  const { leftCorner, rightCorner, center } = features.mouth;
  const dip = distance(leftCorner, rightCorner) * 0.18;
  const control = { x: center.x, y: center.y + dip };
  return quadraticPath(leftCorner, control, rightCorner);
}

export function createAnimatedPathStyle(progress = 0) {
  const clamped = clamp(progress, 0, 1);
  return {
    strokeDasharray: `${Math.round(clamped * 100)} 100`,
    strokeDashoffset: 0,
  };
}

export function generateFacePromptAnchors(features) {
  if (!features) return [];
  const bounds = getFeatureBounds([
    features.face.top,
    features.face.left,
    features.face.right,
    features.face.chin,
  ]);
  const gap = Math.max(22, bounds.width * 0.08);

  return [
    {
      label: 'puff cheeks',
      x: bounds.center.x,
      y: bounds.y - gap,
    },
    {
      label: 'big smile',
      x: bounds.x + bounds.width + gap,
      y: features.mouth.center.y,
    },
    {
      label: 'soft eyes',
      x: bounds.x - gap,
      y: (features.leftEye.lower.y + features.rightEye.lower.y) / 2,
    },
  ];
}

export function generateFaceOvalPath(features) {
  if (!features) return '';
  const bounds = features.bounds;
  const padX = bounds.width * 0.14;
  const padTop = bounds.height * 0.06;
  const padBottom = bounds.height * 0.01;
  const x = bounds.x - padX;
  const y = bounds.y - padTop;
  const width = bounds.width + padX * 2;
  const height = bounds.height + padTop + padBottom;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const kappa = 0.5522847498;
  const rx = width / 2;
  const ry = height / 2;
  const ox = rx * kappa;
  const oy = ry * kappa;

  return [
    `M ${round(cx)} ${round(y)}`,
    `C ${round(cx - ox)} ${round(y)} ${round(x)} ${round(cy - oy)} ${round(x)} ${round(cy)}`,
    `C ${round(x)} ${round(cy + oy)} ${round(cx - ox)} ${round(y + height)} ${round(cx)} ${round(y + height)}`,
    `C ${round(cx + ox)} ${round(y + height)} ${round(x + width)} ${round(cy + oy)} ${round(x + width)} ${round(cy)}`,
    `C ${round(x + width)} ${round(cy - oy)} ${round(cx + ox)} ${round(y)} ${round(cx)} ${round(y)}`,
    'Z',
  ].join(' ');
}

function quadraticPath(start, control, end) {
  return `M ${round(start.x)} ${round(start.y)} Q ${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}`;
}

function createUnderEyeHighlight(underEye) {
  const pad = underEye.offset * 0.65;
  const topStart = {
    x: underEye.start.x,
    y: underEye.start.y - pad,
  };
  const topControl = {
    x: underEye.middle.x,
    y: underEye.middle.y - pad * 1.08,
  };
  const topEnd = {
    x: underEye.end.x,
    y: underEye.end.y - pad,
  };
  const bottomStart = {
    x: underEye.start.x,
    y: underEye.start.y + pad,
  };
  const bottomControl = {
    x: underEye.middle.x,
    y: underEye.middle.y + pad * 0.88,
  };
  const bottomEnd = {
    x: underEye.end.x,
    y: underEye.end.y + pad,
  };

  return [
    `M ${round(topStart.x)} ${round(topStart.y)}`,
    `Q ${round(topControl.x)} ${round(topControl.y)} ${round(topEnd.x)} ${round(topEnd.y)}`,
    `L ${round(bottomEnd.x)} ${round(bottomEnd.y)}`,
    `Q ${round(bottomControl.x)} ${round(bottomControl.y)} ${round(bottomStart.x)} ${round(bottomStart.y)}`,
    'Z',
  ].join(' ');
}

function createArrowForCurve(dots) {
  const from = dots[Math.max(0, dots.length - 3)];
  const to = dots[dots.length - 2] || dots[dots.length - 1];
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 10;
  return {
    x: to.x,
    y: to.y,
    points: [
      `${round(to.x)} ${round(to.y)}`,
      `${round(to.x - Math.cos(angle - 0.55) * size)} ${round(to.y - Math.sin(angle - 0.55) * size)}`,
      `${round(to.x - Math.cos(angle + 0.55) * size)} ${round(to.y - Math.sin(angle + 0.55) * size)}`,
    ].join(' '),
  };
}

function sampleQuadratic(start, control, end, count) {
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    const inverse = 1 - t;
    return {
      x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
      y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
    };
  });
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function round(value) {
  return Number(value.toFixed(2));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
