import { useEffect, useRef, useState } from 'react';
import { LANDMARK_MODES } from '../utils/faceLandmarks.js';
import {
  createMockFingertips,
  createMockFingertip,
  getIndexFingertip,
  initializeHandLandmarker,
  mapHandCoordinatesToCanvas,
  normalizeAllHandLandmarks,
  normalizeHandLandmarks,
} from '../utils/handTracking.js';

export function useHandTracking({ videoRef, stream, isDemoMode, displayRect, trajectories }) {
  const [fingertip, setFingertip] = useState(null);
  const [fingertips, setFingertips] = useState({ left: null, right: null, all: [] });
  const [handMode, setHandMode] = useState(isDemoMode ? LANDMARK_MODES.demo : LANDMARK_MODES.mock);
  const [handMessage, setHandMessage] = useState('Preparing fingertip');
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
      setHandMessage(isDemoMode ? 'Mock two-finger demo' : 'Mock two-finger wiper');
      animationFrame = requestAnimationFrame(tickMock);
    };

    const tickReal = () => {
      if (isCancelled) return;
      const video = videoRef.current;
      if (video && landmarker && displayRect && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        try {
          const result = landmarker.detectForVideo(video, performance.now());
          const normalizedHands = normalizeAllHandLandmarks(result, LANDMARK_MODES.real);
          const mappedTips = normalizedHands
            .map((hand) => mapHandCoordinatesToCanvas(getIndexFingertip(hand), displayRect, { mirrored: true }))
            .filter(Boolean)
            .sort((a, b) => a.x - b.x);
          const normalized = normalizeHandLandmarks(result, LANDMARK_MODES.real);
          const normalizedTip = getIndexFingertip(normalized);
          const mappedTip = mapHandCoordinatesToCanvas(normalizedTip, displayRect, { mirrored: true });

          if (mappedTips.length) {
            const nextFingertips = splitFingertipsByScreenSide(mappedTips, displayRect);
            setFingertips(nextFingertips);
            setFingertip(mappedTip || mappedTips[0]);
            setHandMode(LANDMARK_MODES.real);
            setHandMessage(mappedTips.length > 1 ? 'Two index fingertips tracked' : 'One index fingertip tracked');
          } else {
            setFingertip(null);
            setFingertips({ left: null, right: null, all: [] });
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

function splitFingertipsByScreenSide(points, displayRect) {
  const centerX = displayRect.x + displayRect.width / 2;
  const left = points.filter((point) => point.x <= centerX);
  const right = points.filter((point) => point.x > centerX);

  return {
    left: left[left.length - 1] || null,
    right: right[0] || null,
    all: points,
  };
}
