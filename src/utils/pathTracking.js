export function distancePointToPath(point, path) {
  return getClosestPathSegment(point, path).distance;
}

export function getClosestPathSegment(point, path) {
  const points = path?.points || [];
  if (!point || points.length < 2) {
    return {
      distance: Infinity,
      progress: 0,
      closestPoint: null,
      segmentIndex: 0,
    };
  }

  let best = {
    distance: Infinity,
    progress: 0,
    closestPoint: points[0],
    segmentIndex: 0,
  };
  const totalLength = getPathLength(points);
  let walked = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const projection = projectPointToSegment(point, start, end);
    const segmentLength = distance(start, end);
    const projectedLength = segmentLength * projection.t;
    const candidateDistance = distance(point, projection.point);

    if (candidateDistance < best.distance) {
      best = {
        distance: candidateDistance,
        progress: totalLength ? (walked + projectedLength) / totalLength : 0,
        closestPoint: projection.point,
        segmentIndex: index,
      };
    }

    walked += segmentLength;
  }

  return best;
}

export function calculatePathProgress(point, path) {
  return getClosestPathSegment(point, path).progress;
}

export function calculateDirectionScore(previousPoint, currentPoint, path) {
  if (!previousPoint || !currentPoint || !path) return 0.72;
  const previousProgress = calculatePathProgress(previousPoint, path);
  const currentProgress = calculatePathProgress(currentPoint, path);
  const delta = currentProgress - previousProgress;
  if (delta > 0.012) return 1;
  if (delta > -0.005) return 0.65;
  return 0.18;
}

export function calculateSpeedScore(previousPoint, currentPoint, timestamp, previousTimestamp) {
  if (!previousPoint || !currentPoint || !timestamp || !previousTimestamp) return 0.82;
  const elapsedSeconds = Math.max(0.016, (timestamp - previousTimestamp) / 1000);
  const pxPerSecond = distance(previousPoint, currentPoint) / elapsedSeconds;

  if (pxPerSecond < 24) return 0.68;
  if (pxPerSecond <= 220) return 1;
  if (pxPerSecond <= 420) return 0.72;
  return 0.32;
}

export function isPointInsidePathTolerance(point, path, tolerance = path?.tolerance || 32) {
  return distancePointToPath(point, path) <= tolerance;
}

export function scoreFingertipAgainstPaths({ point, previousPoint, timestamp, previousTimestamp, paths, previousMaxProgress = 0 }) {
  if (!point || !paths?.length) {
    return {
      activePath: null,
      closest: null,
      score: 0,
      accuracy: 0,
      direction: 0,
      speed: 0,
      completion: previousMaxProgress,
      feedback: 'Show your index fingertip',
      isOnTrack: false,
    };
  }

  const candidates = paths.map((path) => ({
    path,
    closest: getClosestPathSegment(point, path),
  }));
  candidates.sort((a, b) => a.closest.distance - b.closest.distance);
  const active = candidates[0];
  const tolerance = active.path.tolerance || 32;
  const accuracy = clamp(1 - active.closest.distance / tolerance, 0, 1);
  const direction = calculateDirectionScore(previousPoint, point, active.path);
  const speed = calculateSpeedScore(previousPoint, point, timestamp, previousTimestamp);
  const completion = Math.max(previousMaxProgress, active.closest.progress);
  const isOnTrack = active.closest.distance <= tolerance;
  const score = Math.round((accuracy * 0.38 + direction * 0.22 + speed * 0.18 + completion * 0.22) * 100);

  return {
    activePath: active.path,
    closest: active.closest,
    score,
    accuracy,
    direction,
    speed,
    completion,
    feedback: getFeedback({ isOnTrack, accuracy, direction, speed, completion }),
    isOnTrack,
  };
}

function getFeedback({ isOnTrack, accuracy, direction, speed, completion }) {
  if (!isOnTrack || accuracy < 0.38) return 'Move closer to the guide';
  if (speed < 0.55) return 'Try moving a little slower';
  if (direction < 0.45) return 'Follow the glowing path';
  if (completion > 0.82) return 'Great, keep going';
  return 'Slow glide, nice and gentle';
}

function getPathLength(points) {
  return points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0);
}

function projectPointToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return {
    t,
    point: {
      x: start.x + dx * t,
      y: start.y + dy * t,
    },
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
