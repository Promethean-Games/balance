export const DEFAULT_SCORING = Object.freeze({
  basePoints: 1000,
  maxMoveBonus: 300,
  pointsPerMove: 10,
  maxSpeedBonus: 300,
  pointsPerTenSeconds: 10,
});

export function scoreAttempt({ moves, elapsedSeconds }, config = DEFAULT_SCORING) {
  const moveBonus = Math.max(0, config.maxMoveBonus - moves * config.pointsPerMove);
  const speedBonus = Math.max(
    0,
    config.maxSpeedBonus - Math.floor(elapsedSeconds / 10) * config.pointsPerTenSeconds,
  );
  return config.basePoints + moveBonus + speedBonus;
}

export function starsForAttempt({ hintsUsed, moves, moveThreshold }) {
  if (hintsUsed > 0) return 1;
  if (moves <= moveThreshold) return 3;
  return 2;
}

export function updateLevelRecord(previous = {}, attempt, moveThreshold) {
  const stars = starsForAttempt({ ...attempt, moveThreshold });
  const score = scoreAttempt(attempt);
  return {
    bestStars: Math.max(previous.bestStars ?? 0, stars),
    bestScore: Math.max(previous.bestScore ?? 0, score),
    bestMoves: Math.min(previous.bestMoves ?? Infinity, attempt.moves),
    fastestTime: Math.min(previous.fastestTime ?? Infinity, attempt.elapsedSeconds),
  };
}
