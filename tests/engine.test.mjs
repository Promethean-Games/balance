import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExpression, expressionsAreEqual, parseRational } from '../src/math.mjs';
import { LEVELS, validateLevels } from '../src/levels.mjs';
import { createAttempt, placeTile, returnTile, undo, isStructurallyStable } from '../src/game.mjs';
import { scoreAttempt, starsForAttempt, updateLevelRecord } from '../src/scoring.mjs';

const expression = (...values) => values.map((value) => {
  if (/^[0-9]/.test(value)) return { kind: 'number', value };
  return { kind: value === '(' || value === ')' ? 'paren' : 'operator', value };
});

test('exact arithmetic handles precedence, grouping, fractions, decimals and percentages', () => {
  assert.equal(evaluateExpression(expression('2', '+', '3', '×', '4')).toString(), '14');
  assert.equal(evaluateExpression(expression('(', '2', '+', '3', ')', '×', '4')).toString(), '20');
  assert.ok(parseRational('1/2').equals(parseRational('0.5')));
  assert.ok(parseRational('50%').equals(parseRational('0.5')));
  assert.ok(parseRational('1/3').add(parseRational('2/3')).equals(parseRational('1')));
});

test('invalid syntax, division by zero and negative intermediate results are rejected', () => {
  for (const tokens of [
    expression('2', '+'),
    expression('+', '2'),
    expression('2', '×', '÷', '3'),
    expression('(', '2', '+', '3'),
    expression('2', '÷', '0'),
    expression('2', '-', '3', '+', '2'),
    [],
  ]) assert.equal(evaluateExpression(tokens), null);
});

test('all authored levels have a valid exact solution, unique weights and the required inventory size', () => {
  assert.deepEqual(validateLevels(), []);
  assert.equal(LEVELS.length, 10);
  for (const level of LEVELS) {
    const tiles = new Map(level.tiles.map((tile) => [tile.id, tile]));
    assert.ok(expressionsAreEqual(
      level.solution[0].map((id) => tiles.get(id)),
      level.solution[1].map((id) => tiles.get(id)),
      { implicitAddition: level.implicitAddition },
    ), `Level ${level.id} has an invalid intended solution`);
  }
});

test('placement, relocation, occupied slots, inventory returns and undo restore exact state', () => {
  const level = LEVELS[0];
  let state = createAttempt(level);
  state = placeTile(state, level, 'l1-10', 0, 0).state;
  assert.equal(state.moves, 1);
  assert.equal(placeTile(state, level, 'l1-4', 0, 0).error, 'That slot is occupied.');
  state = placeTile(state, level, 'l1-4', 1, 0).state;
  state = placeTile(state, level, 'l1-4', 1, 1).state;
  assert.equal(state.moves, 3);
  state = undo(state);
  assert.deepEqual(state.slots[1].slice(0, 2), ['l1-4', null]);
  assert.equal(state.moves, 2);
  state = returnTile(state, level, 'l1-4').state;
  assert.equal(state.moves, 3);
  assert.equal(state.slots[1][0], null);
});

test('matching positive expressions complete automatically and undo reopens the attempt', () => {
  const level = LEVELS[0];
  let state = createAttempt(level);
  for (const [id, side, slot] of [
    ['l1-10', 0, 0], ['l1-4', 1, 0], ['l1-6', 1, 1],
  ]) state = placeTile(state, level, id, side, slot).state;
  assert.equal(state.complete, true);
  assert.equal(undo(state), state);
});

test('advanced levels fail immediately when tile counts differ by more than one', () => {
  const level = LEVELS[8];
  let state = createAttempt(level);
  state = placeTile(state, level, 'l9-open', 0, 0).state;
  assert.ok(isStructurallyStable(state));
  state = placeTile(state, level, 'l9-2', 0, 1).state;
  assert.equal(state.failed, true);
  assert.equal(undo(state), state);
});

test('returning a tile cannot bypass the immediate stability check', () => {
  const level = LEVELS[8];
  let state = createAttempt(level);
  for (const [id, side, slot] of [
    ['l9-open', 0, 0],
    ['l9-2', 0, 1],
    ['l9-plus', 0, 2],
    ['l9-open2', 1, 0],
    ['l9-1', 1, 1],
  ]) state = placeTile(state, level, id, side, slot).state;
  const result = returnTile(state, level, 'l9-1');
  assert.equal(result.state.failed, true);
});

test('stars, points and personal records are tracked independently', () => {
  assert.equal(starsForAttempt({ hintsUsed: 0, moves: 4, moveThreshold: 4 }), 3);
  assert.equal(starsForAttempt({ hintsUsed: 1, moves: 1, moveThreshold: 4 }), 1);
  assert.equal(scoreAttempt({ moves: 2, elapsedSeconds: 5 }), 1580);
  const record = updateLevelRecord(
    { bestStars: 2, bestScore: 1000, bestMoves: 8, fastestTime: 50 },
    { moves: 5, elapsedSeconds: 60, hintsUsed: 0 },
    4,
  );
  assert.deepEqual(record, { bestStars: 2, bestScore: 1490, bestMoves: 5, fastestTime: 50 });
});
