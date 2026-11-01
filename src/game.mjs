import { evaluateExpression, expressionsAreEqual } from './math.mjs';

const emptySlots = () => [Array(5).fill(null), Array(5).fill(null)];

export function createAttempt(level, previousHintCount = 0) {
  const slots = emptySlots();
  for (const fixed of level.fixed) slots[fixed.side][fixed.index] = fixed.id;
  return {
    levelId: level.id,
    slots,
    moves: 0,
    elapsedSeconds: 0,
    hintsUsed: previousHintCount,
    history: [],
    failed: false,
    complete: false,
  };
}

export function findTilePosition(state, tileId) {
  for (let side = 0; side < 2; side += 1) {
    const index = state.slots[side].indexOf(tileId);
    if (index >= 0) return { side, index };
  }
  return null;
}

export function getSideValue(state, level, side) {
  const tilesById = new Map(level.tiles.map((tile) => [tile.id, tile]));
  const tokens = state.slots[side].filter(Boolean).map((id) => tilesById.get(id));
  return evaluateExpression(tokens, { implicitAddition: level.implicitAddition });
}

export function getScaleDifference(state, level) {
  const left = getSideValue(state, level, 0);
  const right = getSideValue(state, level, 1);
  if (!left || !right) return null;
  return left.subtract(right);
}

function snapshot(state) {
  return {
    slots: state.slots.map((side) => [...side]),
    moves: state.moves,
    complete: state.complete,
    failed: state.failed,
  };
}

function withHistory(state) {
  return [...state.history, snapshot(state)];
}

function evaluateCompletion(state, level) {
  const tiles = new Map(level.tiles.map((tile) => [tile.id, tile]));
  const sides = state.slots.map((slots) => slots.filter(Boolean).map((id) => tiles.get(id)));
  return expressionsAreEqual(sides[0], sides[1], { implicitAddition: level.implicitAddition });
}

export function placeTile(state, level, tileId, side, index) {
  if (state.failed || state.complete) return { state, error: 'This attempt has ended.' };
  if (side < 0 || side > 1 || index < 0 || index > 4) return { state, error: 'Choose an available slot.' };
  if (level.fixed.some((item) => item.id === tileId)) return { state, error: 'This operator is fixed.' };
  if (!level.tiles.some((tile) => tile.id === tileId)) return { state, error: 'Unknown tile.' };

  const source = findTilePosition(state, tileId);
  if (source?.side === side && source.index === index) return { state, error: null };
  if (state.slots[side][index] !== null) return { state, error: 'That slot is occupied.' };

  const slots = state.slots.map((row) => [...row]);
  if (source) slots[source.side][source.index] = null;
  slots[side][index] = tileId;
  const next = {
    ...state,
    slots,
    moves: state.moves + 1,
    history: withHistory(state),
  };

  if (level.stable && Math.abs(slots[0].filter(Boolean).length - slots[1].filter(Boolean).length) > 1) {
    next.failed = true;
    return { state: next, error: 'The scale became unstable.' };
  }

  next.complete = evaluateCompletion(next, level);
  return { state: next, error: null };
}

export function returnTile(state, level, tileId) {
  if (state.failed || state.complete) return { state, error: 'This attempt has ended.' };
  if (level.fixed.some((item) => item.id === tileId)) return { state, error: 'This operator is fixed.' };
  const source = findTilePosition(state, tileId);
  if (!source) return { state, error: null };
  const slots = state.slots.map((row) => [...row]);
  slots[source.side][source.index] = null;
  const next = {
    ...state,
    slots,
    moves: state.moves + 1,
    history: withHistory(state),
  };
  if (level.stable && Math.abs(slots[0].filter(Boolean).length - slots[1].filter(Boolean).length) > 1) {
    next.failed = true;
    return { state: next, error: 'The scale became unstable.' };
  }
  return {
    state: next,
    error: null,
  };
}

export function undo(state) {
  if (state.failed || state.complete || state.history.length === 0) return state;
  const history = [...state.history];
  const previous = history.pop();
  return {
    ...state,
    ...previous,
    history,
  };
}

export function restartAttempt(level, state) {
  return createAttempt(level, state.hintsUsed);
}

export function markHintUsed(state) {
  return { ...state, hintsUsed: state.hintsUsed + 1 };
}

export function isStructurallyStable(state) {
  return Math.abs(state.slots[0].filter(Boolean).length - state.slots[1].filter(Boolean).length) <= 1;
}
