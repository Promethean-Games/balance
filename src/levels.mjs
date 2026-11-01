import { parseRational, expressionsAreEqual } from './math.mjs';

const number = (id, value) => ({ id, kind: 'number', value, label: value });
const operator = (id, value) => ({ id, kind: 'operator', value, label: value });
const paren = (id, value) => ({ id, kind: 'paren', value, label: value });

function makeLevel(id, title, objective, tiles, solution, options = {}) {
  return {
    id,
    title,
    objective,
    tiles,
    solution: solution.map((side) => [...side]),
    fixed: options.fixed ?? [],
    stable: options.stable ?? false,
    implicitAddition: options.implicitAddition ?? false,
    moveThreshold: options.moveThreshold ?? 8 + id,
    hint: options.hint ?? 'Match the intended expressions using the available tiles.',
    ...options,
  };
}

export const LEVELS = [
  makeLevel(1, 'First Balance', 'Make the numbers match.', [
    number('l1-10', '10'), number('l1-4', '4'), number('l1-6', '6'),
    number('l1-3', '3'), number('l1-7', '7'), number('l1-9', '9'),
  ], [['l1-10'], ['l1-4', 'l1-6']], {
    implicitAddition: true, moveThreshold: 3, hint: 'Try one weight against two.',
  }),
  makeLevel(2, 'Combinations', 'Different combinations can balance.', [
    number('l2-2', '2'), number('l2-9', '9'), number('l2-5', '5'), number('l2-6', '6'),
    number('l2-1', '1'), number('l2-3', '3'), number('l2-8', '8'), number('l2-10', '10'),
  ], [['l2-2', 'l2-9'], ['l2-5', 'l2-6']], { implicitAddition: true, moveThreshold: 4 }),
  makeLevel(3, 'Efficiency', 'Solve it with fewer moves.', [
    number('l3-4', '4'), number('l3-11', '11'), number('l3-3', '3'), number('l3-5', '5'),
    number('l3-7', '7'), number('l3-1', '1'), number('l3-2', '2'), number('l3-8', '8'),
    number('l3-9', '9'), number('l3-13', '13'),
  ], [['l3-4', 'l3-11'], ['l3-3', 'l3-5', 'l3-7']], {
    implicitAddition: true, moveThreshold: 5,
  }),
  makeLevel(4, 'Plus & Minus', 'Use the fixed addition sign.', [
    number('l4-7', '7'), number('l4-2', '2'), number('l4-9', '9'),
    number('l4-1', '1'), number('l4-5', '5'), number('l4-11', '11'),
    operator('l4-plus', '+'),
  ], [['l4-7', 'l4-plus', 'l4-2'], ['l4-9']], {
    fixed: [{ id: 'l4-plus', side: 0, index: 1 }],
    moveThreshold: 3,
  }),
  makeLevel(5, 'Multiply', 'A fixed multiplication sign changes the total.', [
    number('l5-3', '3'), number('l5-4', '4'), number('l5-12', '12'),
    number('l5-2', '2'), number('l5-5', '5'), number('l5-7', '7'),
    operator('l5-times', '×'),
  ], [['l5-3', 'l5-times', 'l5-4'], ['l5-12']], {
    fixed: [{ id: 'l5-times', side: 0, index: 1 }],
    moveThreshold: 3,
  }),
  makeLevel(6, 'Divide', 'Division is exact, even when the answer is not a whole number.', [
    number('l6-8', '8'), number('l6-2', '2'), number('l6-4', '4'),
    number('l6-3', '3'), number('l6-5', '5'), number('l6-7', '7'),
    operator('l6-divide', '÷'),
  ], [['l6-8', 'l6-divide', 'l6-2'], ['l6-4']], {
    fixed: [{ id: 'l6-divide', side: 0, index: 1 }],
    moveThreshold: 3,
  }),
  makeLevel(7, 'Move the Math', 'Build both expressions with movable operators.', [
    number('l7-5', '5'), operator('l7-plus', '+'), number('l7-3', '3'),
    number('l7-2', '2'), operator('l7-times', '×'), number('l7-4', '4'),
    number('l7-1', '1'), number('l7-7', '7'), number('l7-8', '8'),
    number('l7-10', '10'), operator('l7-divide', '÷'), operator('l7-minus', '-'),
  ], [['l7-5', 'l7-plus', 'l7-3'], ['l7-2', 'l7-times', 'l7-4']], {
    moveThreshold: 6,
  }),
  makeLevel(8, 'Fractions & Decimals', 'Equivalent values can look different.', [
    number('l8-quarter', '1/4'), operator('l8-plus', '+'), number('l8-three-quarter', '0.75'),
    number('l8-one', '1'), number('l8-half', '0.5'), number('l8-two', '2'),
    number('l8-three', '3'), operator('l8-times', '×'),
  ], [['l8-quarter', 'l8-plus', 'l8-three-quarter'], ['l8-one']], {
    moveThreshold: 4,
  }),
  makeLevel(9, 'Stay Steady', 'Balance the math and keep both sides stable.', [
    paren('l9-open', '('), number('l9-2', '2'), operator('l9-plus', '+'),
    number('l9-3', '3'), paren('l9-close', ')'),
    paren('l9-open2', '('), number('l9-1', '1'), operator('l9-plus2', '+'),
    number('l9-4', '4'), paren('l9-close2', ')'),
    number('l9-5', '5'), number('l9-7', '7'), operator('l9-times', '×'),
    operator('l9-divide', '÷'), operator('l9-minus', '-'),
    number('l9-6', '6'), number('l9-8', '8'), number('l9-9', '9'),
    number('l9-10', '10'), number('l9-11', '11'),
  ], [
    ['l9-open', 'l9-2', 'l9-plus', 'l9-3', 'l9-close'],
    ['l9-open2', 'l9-1', 'l9-plus2', 'l9-4', 'l9-close2'],
  ], {
    stable: true,
    moveThreshold: 6,
  }),
  makeLevel(10, 'Perfectly Paired', 'Use parentheses to guide both expressions.', [
    paren('l10-lo', '('), number('l10-3', '3'), operator('l10-plus', '+'),
    number('l10-4', '4'), paren('l10-lc', ')'),
    paren('l10-ro', '('), number('l10-14', '14'), operator('l10-divide', '÷'),
    number('l10-2', '2'), paren('l10-rc', ')'),
    number('l10-7', '7'), number('l10-1', '1'), number('l10-5', '5'),
    number('l10-6', '6'), number('l10-8', '8'), number('l10-9', '9'),
    operator('l10-times', '×'), operator('l10-minus', '-'),
    operator('l10-extra-plus', '+'), paren('l10-extra-open', '('),
  ], [
    ['l10-lo', 'l10-3', 'l10-plus', 'l10-4', 'l10-lc'],
    ['l10-ro', 'l10-14', 'l10-divide', 'l10-2', 'l10-rc'],
  ], { stable: true, moveThreshold: 10 }),
];

export function getLevel(id) {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}

export function validateLevels() {
  const errors = [];
  for (const level of LEVELS) {
    const ids = new Set(level.tiles.map((tile) => tile.id));
    if (ids.size !== level.tiles.length) errors.push(`Level ${level.id}: duplicate tile id`);
    const solutionTiles = level.solution.flat();
    if (solutionTiles.some((id) => !ids.has(id))) errors.push(`Level ${level.id}: missing solution tile`);
    const movableCount = solutionTiles.filter((id) => !level.fixed.some((item) => item.id === id)).length;
    if (level.tiles.filter((tile) => !level.fixed.some((item) => item.id === tile.id)).length !== movableCount * 2) {
      errors.push(`Level ${level.id}: inventory must contain twice its required movable tiles`);
    }
    for (const side of level.solution) {
      if (side.length > 5) errors.push(`Level ${level.id}: expression exceeds five slots`);
    }
    const tilesById = new Map(level.tiles.map((tile) => [tile.id, tile]));
    if (!expressionsAreEqual(
      level.solution[0].map((id) => tilesById.get(id)),
      level.solution[1].map((id) => tilesById.get(id)),
      { implicitAddition: level.implicitAddition },
    )) errors.push(`Level ${level.id}: intended solution must evaluate to equal positive values`);
    if (level.stable && Math.abs(level.solution[0].length - level.solution[1].length) > 1) {
      errors.push(`Level ${level.id}: intended solution is structurally unstable`);
    }
    const numbers = level.tiles.filter((tile) => tile.kind === 'number');
    if (level.id >= 3) {
      const values = numbers.map((tile) => {
        try {
          return parseRational(tile.value).toString();
        } catch {
          return `invalid:${tile.value}`;
        }
      });
      if (new Set(values).size !== values.length) errors.push(`Level ${level.id}: numerical weights must be unique`);
    }
  }
  return errors;
}
