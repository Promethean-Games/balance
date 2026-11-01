export function scoreAttempt({ moves, elapsedSeconds }) {
  const moveBonus = Math.max(0, 300 - moves * 10);
  const speedBonus = Math.max(0, 300 - Math.floor(elapsedSeconds / 10) * 10);
  return 1000 + moveBonus + speedBonus;
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
