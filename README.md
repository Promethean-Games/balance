# Balance

A portrait-first mathematical puzzle game for Android and iOS. The first ten levels are bundled and playable offline; progress and reports are stored on-device.

## Run and test

```sh
npm install
npm test
npm run lint
npx expo start
```

Open the project in Expo Go or use a development build. To build locally:

```sh
npx expo run:android
npx expo run:ios # requires macOS and Xcode
```

An Android JavaScript bundle can be checked with `npx expo export --platform android`. The project has not been built or exercised on a physical iOS device in this environment.

## Play

Drag a tile from the inventory onto an open slot, or tap a tile and then tap a slot. Drag a placed tile out of the scale to return it to inventory. Tap **Undo** to restore the previous arrangement. Both totals update while you play; matching positive totals finish the level automatically.

The pause menu includes restart, settings, and three confirm-before-reveal hints. Hint use limits that attempt to one star. A fresh replay resets hint eligibility; restarting an attempt preserves it. Levels 9–10 also fail immediately when the two sides differ by more than one occupied tile.

Stars are awarded as follows: one for completion; two for completing without hints; three for doing that within the level's move threshold. Points are `1000 + max(0, 300 - 10 × moves) + max(0, 300 - 10 × floor(seconds / 10))`. Best stars, best score, fewest moves, and fastest time are recorded separately.

## Architecture

- `src/math.mjs` — exact rational arithmetic and a PEMDAS expression evaluator. It supports integer, decimal, fraction, and percentage values and rejects malformed, zero-dividing, or negative-result expressions.
- `src/levels.mjs` — ten authored levels and checks for valid intended answers, inventory size, five-slot limits, uniqueness, and stability.
- `src/puzzleValidation.mjs` — bounded expression enumeration for finding alternative inventory solutions. The default search records up to 500 solutions and examines at most 100,000 candidate expressions per side; a capped result is explicitly marked `truncated`.
- `src/game.mjs` and `src/scoring.mjs` — placement, relocation, move history, stability, completion, stars, scores, and records.
- `src/storage.js` — versioned SQLite saves for three independent slots and locally stored puzzle reports. Writes are transactional; malformed or unsupported saves are ignored and cleared.
- `App.js` — mobile screens, drag-and-drop, tutorials, hints, settings, completion/failure dialogs, and report export via the device share sheet.

## Notes and limitations

- All game rules, level definitions, mathematical validation, and local saves run without a backend or required network connection.
- Puzzle inventories are handcrafted. `enumerateSolutions` is a bounded validator for designer review, not a procedural level generator; results marked `truncated` are a lower bound, not a complete count.
- Sound and music preferences are saved, but this MVP does not bundle sound assets or play audio. Haptic feedback uses the device vibration API.
- Automated engine tests and Android bundling are available; physical-device drag behavior, airplane-mode persistence, and native iOS builds still require device QA.
