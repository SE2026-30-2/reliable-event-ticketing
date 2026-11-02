import { openDatabaseAsync } from "expo-sqlite";
let database: ReturnType<typeof openDatabaseAsync> | undefined;
function db() {
  if (!database)
    database = openDatabaseAsync("eventpass-checkin.db")
      .then(async (connection) => {
        await connection.execAsync(
          "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS checkin_data (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)",
        );
        return connection;
      })
      .catch((error) => {
        database = undefined;
        throw error;
      });
  return database;
}
export async function readValue(key: string): Promise<string | null> {
  const row = await (
    await db()
  ).getFirstAsync<{ value: string }>(
    "SELECT value FROM checkin_data WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}
export async function writeValue(key: string, value: string) {
  await (
    await db()
  ).runAsync(
    "INSERT OR REPLACE INTO checkin_data (key, value) VALUES (?, ?)",
    key,
    value,
  );
}
export async function readScanValues(): Promise<string[]> {
  const rows = await (
    await db()
  ).getAllAsync<{ value: string }>(
    "SELECT value FROM checkin_data WHERE key LIKE 'scan.%'",
  );
  return rows.map((row) => row.value);
}
let tail: Promise<unknown> = Promise.resolve();
export function withScanLock<T>(run: () => Promise<T>): Promise<T> {
  const result = tail.then(run, run);
  tail = result.catch(() => {});
  return result;
}
