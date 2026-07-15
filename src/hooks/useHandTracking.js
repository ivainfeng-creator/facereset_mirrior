import { useEffect, useRef, useState } from 'react';
import { LANDMARK_MODES } from '../utils/faceLandmarks.js';
import {
  createMockFingertip,
  getIndexFingertip,
  initializeHandLandmarker,
  mapHandCoordinatesToCanvas,
  normalizeHandLandmarks,
} from '../utils/handTracking.js';

export function useHandTracking({ videoRef, stream, isDemoMode, displayRect, trajectories }) {
  const [fingertip, setFingertip] = useState(null);
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
      const mock = createMockFingertip(trajectoriesRef.current, performance.now());
      setFingertip(mock.point);
      setHandMode(isDemoMode ? LANDMARK_MODES.demo : LANDMARK_MODES.mock);
      setHandMessage(isDemoMode ? 'Mock fingertip demo' : 'Mock fingertip');
      animationFrame = requestAnimationFrame(tickMock);
    };

    const tickReal = () => {
      if (isCancelled) return;
      const video = videoRef.current;
      if (video && landmarker && displayRect && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        try {
          const result = landmarker.detectForVideo(video, performance.now());
          const normalized = normalizeHandLandmarks(result, LANDMARK_MODES.real);
          const normalizedTip = getIndexFingertip(normalized);
          const mappedTip = mapHandCoordinatesToCanvas(normalizedTip, displayRect, { mirrored: true });

          if (mappedTip) {
            setFingertip(mappedTip);
            setHandMode(LANDMARK_MODES.real);
            setHandMessage('Index fingertip tracked');
          } else {
            setFingertip(null);
            setHandMessage('Show your index fingertip');
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
    handMode,
    handMessage,
    hasFingertip: Boolean(fingertip),
  };
}
