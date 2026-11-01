import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'balance.db';
const SAVE_VERSION = 1;
let databasePromise;

function validSave(data) {
  if (
    !data
    || data.version !== SAVE_VERSION
    || !Number.isInteger(data.currentLevel)
    || data.currentLevel < 1
    || data.currentLevel > 10
    || !Number.isInteger(data.unlockedLevels)
    || data.unlockedLevels < data.currentLevel
    || !data.settings
    || typeof data.settings !== 'object'
    || !data.records
    || typeof data.records !== 'object'
    || !Array.isArray(data.tutorialsSeen)
  ) return false;
  const attempt = data.currentAttempt;
  if (attempt === null) return true;
  return Boolean(
    attempt
    && attempt.levelId === data.currentLevel
    && Array.isArray(attempt.slots)
    && attempt.slots.length === 2
    && attempt.slots.every((side) => (
      Array.isArray(side) && side.length === 5 && side.every((tileId) => tileId === null || typeof tileId === 'string')
    ))
    && Number.isInteger(attempt.moves)
    && attempt.moves >= 0
    && Number.isInteger(attempt.elapsedSeconds)
    && attempt.elapsedSeconds >= 0
    && Number.isInteger(attempt.hintsUsed)
    && attempt.hintsUsed >= 0
    && Array.isArray(attempt.history)
  );
}

async function database() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS saves (
          slot_id INTEGER PRIMARY KEY CHECK (slot_id BETWEEN 1 AND 3),
          version INTEGER NOT NULL,
          payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS reports (
          report_id INTEGER PRIMARY KEY AUTOINCREMENT,
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);
      return db;
    })();
  }
  return databasePromise;
}

export async function saveSlot(slotId, data) {
  if (!Number.isInteger(slotId) || slotId < 1 || slotId > 3) throw new RangeError('Invalid save slot');
  const db = await database();
  const payload = JSON.stringify(data);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO saves (slot_id, version, payload, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(slot_id) DO UPDATE SET
         version = excluded.version, payload = excluded.payload, updated_at = excluded.updated_at`,
      slotId,
      SAVE_VERSION,
      payload,
      Date.now(),
    );
  });
}

export async function loadSlot(slotId) {
  if (!Number.isInteger(slotId) || slotId < 1 || slotId > 3) throw new RangeError('Invalid save slot');
  const db = await database();
  const row = await db.getFirstAsync(
    'SELECT version, payload FROM saves WHERE slot_id = ?',
    slotId,
  );
  if (!row || row.version !== SAVE_VERSION) return null;
  try {
    const data = JSON.parse(row.payload);
    if (!validSave(data)) throw new Error('Invalid save');
    return data;
  } catch {
    await db.runAsync('DELETE FROM saves WHERE slot_id = ?', slotId);
    return null;
  }
}

export async function resetSlot(slotId) {
  if (!Number.isInteger(slotId) || slotId < 1 || slotId > 3) throw new RangeError('Invalid save slot');
  const db = await database();
  await db.runAsync('DELETE FROM saves WHERE slot_id = ?', slotId);
}

export async function saveReport(report) {
  const db = await database();
  await db.runAsync(
    'INSERT INTO reports (payload, created_at) VALUES (?, ?)',
    JSON.stringify(report),
    Date.now(),
  );
}

export async function getReports() {
  const db = await database();
  const rows = await db.getAllAsync('SELECT payload FROM reports ORDER BY report_id ASC');
  return rows.flatMap((row) => {
    try {
      return [JSON.parse(row.payload)];
    } catch {
      return [];
    }
  });
}
