import fs from "node:fs";
import path from "node:path";
import BetterSqlite3, { type Database as SqlDatabase, type Statement } from "better-sqlite3";
import { resolveFromRoot } from "./env";

type Row = Record<string, unknown>;
type BindParams = unknown[] | Record<string, unknown>;

let db: SqlDatabase | null = null;
let dbPath = "";

// Statements preparados reutilizables: preparar SQL en cada consulta era un costo fijo repetido.
const statementCache = new Map<string, Statement>();
const STATEMENT_CACHE_LIMIT = 400;

function prepared(database: SqlDatabase, sql: string): Statement {
  let stmt = statementCache.get(sql);
  if (!stmt) {
    stmt = database.prepare(sql);
    if (statementCache.size >= STATEMENT_CACHE_LIMIT) statementCache.clear();
    statementCache.set(sql, stmt);
  }
  return stmt;
}

// Version de datos: sube con cada escritura relevante. Permite invalidar caches
// en memoria (estado de la app) sin recalcular ni consultar la base.
let dataVersion = 0;
const NON_DATA_WRITE = /^\s*(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:metric_cache|app_errors|ai_context_snapshots|ai_insights)\b/i;
const dataListeners = new Set<() => void>();

export function getDataVersion() {
  return dataVersion;
}

export function onDataChange(listener: () => void) {
  dataListeners.add(listener);
  return () => dataListeners.delete(listener);
}

export function touchData() {
  dataVersion += 1;
  for (const listener of dataListeners) {
    try {
      listener();
    } catch {
      // Un oyente defectuoso no debe romper una escritura.
    }
  }
}

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
  // Base pequena (decenas de MB): mantener paginas e indices en memoria.
  db.pragma("cache_size = -65536");
  db.pragma("temp_store = MEMORY");
  db.pragma("mmap_size = 268435456");
  db.pragma("wal_autocheckpoint = 1000");
  return db;
}

export async function saveDb() {
  const database = await openDb();
  database.pragma("wal_checkpoint(PASSIVE)");
  try {
    database.pragma("optimize");
  } catch {
    // Optimizacion oportunista: no debe impedir el cierre.
  }
}

export async function exec(sql: string) {
  const database = await openDb();
  database.exec(sql);
  if (!NON_DATA_WRITE.test(sql)) touchData();
}

export async function run(sql: string, params?: BindParams) {
  const database = await openDb();
  const stmt = prepared(database, sql);
  const info = applyParams((...args) => stmt.run(...args), params);
  if (info.changes > 0 && !NON_DATA_WRITE.test(sql)) touchData();
}

export async function all<T extends Row = Row>(sql: string, params?: BindParams): Promise<T[]> {
  const database = await openDb();
  const stmt = prepared(database, sql);
  return applyParams((...args) => stmt.all(...args) as T[], params);
}

export async function get<T extends Row = Row>(sql: string, params?: BindParams): Promise<T | undefined> {
  const database = await openDb();
  const stmt = prepared(database, sql);
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
    touchData();
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    touchData();
    throw error;
  }
}

export async function resetDbFile() {
  statementCache.clear();
  db?.close();
  db = null;
  dbPath = resolveFromRoot(process.env.DATABASE_PATH, "./data/hyl_gym.db");
  for (const target of [dbPath, `${dbPath}-shm`, `${dbPath}-wal`, `${dbPath}.tmp`]) {
    if (fs.existsSync(target)) fs.rmSync(target, { force: true });
  }
}
