import fs from "node:fs";
import path from "node:path";
import BetterSqlite3, { type Database as SqlDatabase } from "better-sqlite3";
import { resolveFromRoot } from "./env";

type Row = Record<string, unknown>;
type BindParams = unknown[] | Record<string, unknown>;

let db: SqlDatabase | null = null;
let dbPath = "";

function applyParams<T>(fn: (...args: unknown[]) => T, params?: BindParams): T {
  if (!params) return fn();
  if (Array.isArray(params)) return fn(...params);
  return fn(params);
}

export async function openDb() {
  if (db) return db;
  dbPath = resolveFromRoot(process.env.DATABASE_PATH, "./data/hyl_gym.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new BetterSqlite3(dbPath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  return db;
}

export async function saveDb() {
  const database = await openDb();
  database.pragma("wal_checkpoint(PASSIVE)");
}

export async function exec(sql: string) {
  const database = await openDb();
  database.exec(sql);
}

export async function run(sql: string, params?: BindParams) {
  const database = await openDb();
  const stmt = database.prepare(sql);
  applyParams((...args) => stmt.run(...args), params);
}

export async function all<T extends Row = Row>(sql: string, params?: BindParams): Promise<T[]> {
  const database = await openDb();
  const stmt = database.prepare(sql);
  return applyParams((...args) => stmt.all(...args) as T[], params);
}

export async function get<T extends Row = Row>(sql: string, params?: BindParams): Promise<T | undefined> {
  const database = await openDb();
  const stmt = database.prepare(sql);
  return applyParams((...args) => stmt.get(...args) as T | undefined, params);
}

export async function scalar<T = unknown>(sql: string, params?: BindParams): Promise<T | null> {
  const row = await get(sql, params);
  if (!row) return null;
  return Object.values(row)[0] as T;
}

export async function transaction<T>(fn: () => Promise<T> | T): Promise<T> {
  const database = await openDb();
  database.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    const result = await fn();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export async function resetDbFile() {
  db?.close();
  db = null;
  dbPath = resolveFromRoot(process.env.DATABASE_PATH, "./data/hyl_gym.db");
  for (const target of [dbPath, `${dbPath}-shm`, `${dbPath}-wal`, `${dbPath}.tmp`]) {
    if (fs.existsSync(target)) fs.rmSync(target, { force: true });
  }
}
