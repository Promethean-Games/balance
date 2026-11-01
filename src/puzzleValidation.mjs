import { evaluateExpression } from './math.mjs';

function expressionsForSide(level, side, maxExpressions) {
  const fixedIds = new Set(level.fixed.map((tile) => tile.id));
  const fixedAt = new Map(
    level.fixed
      .filter((fixed) => fixed.side === side)
      .map((fixed) => [fixed.index, fixed.id]),
  );
  const movable = level.tiles.filter((tile) => !fixedIds.has(tile.id));
  const tilesById = new Map(level.tiles.map((tile) => [tile.id, tile]));
  const groups = new Map();
  let examined = 0;
  let capped = false;

  function record(ids) {
    if (fixedAt.size && [...fixedAt.keys()].some((position) => position >= ids.length)) return;
    examined += 1;
    if (examined > maxExpressions) {
      capped = true;
      return;
    }
    const tokens = ids.map((id) => tilesById.get(id));
    const value = evaluateExpression(tokens, { implicitAddition: level.implicitAddition });
    if (!value?.isPositive()) return;

    let mask = 0n;
    for (const id of ids) {
      if (fixedIds.has(id)) continue;
      const tileIndex = movable.findIndex((tile) => tile.id === id);
      if (tileIndex >= 0) mask |= 1n << BigInt(tileIndex);
    }
    const key = value.toString();
    const bucket = groups.get(key) ?? [];
    bucket.push({ ids: [...ids], mask });
    groups.set(key, bucket);
  }

  function fill(ids, used, length) {
    if (capped) return;
    if (ids.length === length) {
      record(ids);
      return;
    }
    const position = ids.length;
    if (fixedAt.has(position)) {
      ids.push(fixedAt.get(position));
      fill(ids, used, length);
      ids.pop();
      return;
    }
    for (const tile of movable) {
      if (used.has(tile.id)) continue;
      used.add(tile.id);
      ids.push(tile.id);
      fill(ids, used, length);
      ids.pop();
      used.delete(tile.id);
      if (capped) return;
    }
  }

  for (let length = 1; length <= 5 && !capped; length += 1) {
    fill([], new Set(), length);
  }
  return { groups, examined, capped };
}

export function enumerateSolutions(level, { limit = 500, maxExpressions = 100_000 } = {}) {
  const left = expressionsForSide(level, 0, maxExpressions);
  const right = expressionsForSide(level, 1, maxExpressions);
  const solutions = [];
  let count = 0;

  for (const [value, leftExpressions] of left.groups) {
    const rightExpressions = right.groups.get(value);
    if (!rightExpressions) continue;
    for (const leftExpression of leftExpressions) {
      for (const rightExpression of rightExpressions) {
        if ((leftExpression.mask & rightExpression.mask) !== 0n) continue;
        count += 1;
        if (solutions.length < limit) {
          solutions.push({
            value,
            left: leftExpression.ids,
            right: rightExpression.ids,
          });
        }
        if (count >= limit) {
          return {
            count,
            solutions,
            truncated: true,
            expressionsExamined: [left.examined, right.examined],
          };
        }
      }
    }
  }

  return {
    count,
    solutions,
    truncated: left.capped || right.capped,
    expressionsExamined: [left.examined, right.examined],
  };
}
