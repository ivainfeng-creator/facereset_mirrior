import { useEffect, useRef, useState } from 'react';
import { LANDMARK_MODES } from '../utils/faceLandmarks.js';
import {
  createMockFingertips,
  getIndexFingerControlPoint,
  initializeHandLandmarker,
  mapHandCoordinatesToCanvas,
  normalizeAllHandLandmarks,
} from '../utils/handTracking.js';

export function useHandTracking({ videoRef, stream, isDemoMode, displayRect, trajectories }) {
  const [fingertip, setFingertip] = useState(null);
  const [fingertips, setFingertips] = useState({ left: null, right: null, all: [] });
  const [handMode, setHandMode] = useState(isDemoMode ? LANDMARK_MODES.demo : LANDMARK_MODES.mock);
  const [handMessage, setHandMessage] = useState('Preparing fingertip');
  const handAssignmentRef = useRef({ left: null, right: null });
  const trajectoriesRef = useRef(trajectories);

  useEffect(() => {
    trajectoriesRef.current = trajectories;
  }, [trajectories]);

  useEffect(() => {
    let isCancelled = false;
    let animationFrame = 0;
    let landmarker = null;
    let lastVideoTime = -1;

    const tickMock = () => {
      if (isCancelled) return;
      const mock = createMockFingertips(trajectoriesRef.current, performance.now());
      setFingertips(mock);
      setFingertip(mock.left || mock.right || null);
      setHandMode(isDemoMode ? LANDMARK_MODES.demo : LANDMARK_MODES.mock);
      setHandMessage(isDemoMode ? 'Mock two-finger demo' : 'Mock two-finger controls');
      animationFrame = requestAnimationFrame(tickMock);
    };

    const tickReal = () => {
      if (isCancelled) return;
      const video = videoRef.current;
      if (video && landmarker && displayRect && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        try {
          const now = performance.now();
          const result = landmarker.detectForVideo(video, performance.now());
          const normalizedHands = normalizeAllHandLandmarks(result, LANDMARK_MODES.real);
          const mappedControls = normalizedHands
            .map((hand) =>
              mapHandCoordinatesToCanvas(getIndexFingerControlPoint(hand), displayRect, { mirrored: true }),
            )
            .filter(Boolean)
            .sort((a, b) => a.x - b.x);

          if (mappedControls.length) {
            const rawFingertips = splitFingertipsByScreenSide(
              mappedControls,
              displayRect,
              handAssignmentRef.current,
            );
            const nextFingertips = stabilizeFingertips(rawFingertips, handAssignmentRef.current, now);
            handAssignmentRef.current = {
              left: toTrackedEntry(nextFingertips.left, handAssignmentRef.current.left, now),
              right: toTrackedEntry(nextFingertips.right, handAssignmentRef.current.right, now),
            };
            setFingertips(nextFingertips);
            setFingertip(nextFingertips.left || nextFingertips.right || mappedControls[0]);
            setHandMode(LANDMARK_MODES.real);
            setHandMessage(mappedControls.length > 1 ? 'Two index fingers tracked' : 'One index finger tracked');
          } else {
            const heldFingertips = stabilizeFingertips({ left: null, right: null, all: [] }, handAssignmentRef.current, now);
            setFingertip(heldFingertips.left || heldFingertips.right || null);
            setFingertips(heldFingertips);
            handAssignmentRef.current = {
              left: toTrackedEntry(heldFingertips.left, handAssignmentRef.current.left, now),
              right: toTrackedEntry(heldFingertips.right, handAssignmentRef.current.right, now),
            };
            setHandMessage('Show both index fingertips');
          }
        } catch {
          tickMock();
          return;
        }
      }

      animationFrame = requestAnimationFrame(tickReal);
    };

    if (isDemoMode || !stream) {
      tickMock();
      return () => {
        isCancelled = true;
        cancelAnimationFrame(animationFrame);
      };
    }

    setHandMessage('Loading hand tracking');
    initializeHandLandmarker()
      .then((instance) => {
        if (isCancelled) return;
        landmarker = instance;
        tickReal();
      })
      .catch(() => {
        if (isCancelled) return;
        tickMock();
      });

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [displayRect, isDemoMode, stream, videoRef]);

  return {
    fingertip,
    fingertips,
    handMode,
    handMessage,
    hasFingertip: Boolean(fingertip),
    hasFingertips: Boolean(fingertips.left || fingertips.right),
  };
}

function splitFingertipsByScreenSide(points, displayRect, previous = {}) {
  const centerX = displayRect.x + displayRect.width / 2;
  const deadZone = displayRect.width * 0.14;

  if (points.length >= 2) {
    const left = points.filter((point) => point.x <= centerX);
    const right = points.filter((point) => point.x > centerX);

    return {
      left: left[left.length - 1] || points[0] || null,
      right: right[0] || points[points.length - 1] || null,
      all: points,
    };
  }

  const point = points[0];
  const previousSide = getNearestPreviousSide(point, previous);
  if (previousSide === 'left' && point.x < centerX + deadZone) {
    return { left: point, right: null, all: points };
  }
  if (previousSide === 'right' && point.x > centerX - deadZone) {
    return { left: null, right: point, all: points };
  }

  return {
    left: point.x <= centerX ? point : null,
    right: point.x > centerX ? point : null,
    all: points,
  };
}

function stabilizeFingertips(raw, previous = {}, timestamp) {
  const left = stabilizePoint(raw.left, previous.left, timestamp);
  const right = stabilizePoint(raw.right, previous.right, timestamp);

  return {
    left,
    right,
    all: [left, right].filter(Boolean),
  };
}

function stabilizePoint(rawPoint, previousEntry, timestamp) {
  const previousPoint = getPreviousPoint(previousEntry);
  const previousTimestamp = previousEntry?.timestamp || 0;
  const age = timestamp - previousTimestamp;

  if (!rawPoint) {
    return previousPoint && age < 260 ? { ...previousPoint, held: true } : null;
  }

  if (!previousPoint) return rawPoint;

  const distance = Math.hypot(rawPoint.x - previousPoint.x, rawPoint.y - previousPoint.y);
  const alpha = distance > 90 ? 0.9 : distance > 34 ? 0.72 : 0.58;

  return {
    ...rawPoint,
    x: previousPoint.x + (rawPoint.x - previousPoint.x) * alpha,
    y: previousPoint.y + (rawPoint.y - previousPoint.y) * alpha,
  };
}

function toTrackedEntry(point, previousEntry, timestamp) {
  if (!point) return null;
  return {
    point,
    timestamp: point.held ? previousEntry?.timestamp || timestamp : timestamp,
  };
}

function getNearestPreviousSide(point, previous) {
  const previousLeft = getPreviousPoint(previous.left);
  const previousRight = getPreviousPoint(previous.right);
  const leftDistance = previousLeft ? Math.hypot(point.x - previousLeft.x, point.y - previousLeft.y) : Infinity;
  const rightDistance = previousRight ? Math.hypot(point.x - previousRight.x, point.y - previousRight.y) : Infinity;
  if (leftDistance === Infinity && rightDistance === Infinity) return null;
  return leftDistance <= rightDistance ? 'left' : 'right';
}

function getPreviousPoint(entry) {
  if (!entry) return null;
  return entry.point || entry;
}
