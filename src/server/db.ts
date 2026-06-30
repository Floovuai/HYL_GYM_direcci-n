import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type BindParams, type Database as SqlDatabase, type SqlJsStatic } from "sql.js";
import { resolveFromRoot } from "./env";

type Row = Record<string, unknown>;

let SQL: SqlJsStatic | null = null;
let db: SqlDatabase | null = null;
let dbPath = "";

async function getSql() {
  if (SQL) return SQL;
  SQL = await initSqlJs({
    locateFile: (file) => path.resolve(process.cwd(), "node_modules", "sql.js", "dist", file)
  });
  return SQL;
}

export async function openDb() {
  if (db) return db;
  const sqlite = await getSql();
  dbPath = resolveFromRoot(process.env.DATABASE_PATH, "./data/hyl_gym.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (fs.existsSync(dbPath)) {
    db = new sqlite.Database(fs.readFileSync(dbPath));
  } else {
    db = new sqlite.Database();
  }
  db.run("PRAGMA foreign_keys = ON");
  return db;
}

export async function saveDb() {
  const database = await openDb();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const tmp = `${dbPath}.tmp`;
  fs.writeFileSync(tmp, Buffer.from(database.export()));
  fs.renameSync(tmp, dbPath);
}

export async function exec(sql: string) {
  const database = await openDb();
  database.run(sql);
}

export async function run(sql: string, params?: BindParams) {
  const database = await openDb();
  database.run(sql, params);
}

export async function all<T extends Row = Row>(sql: string, params?: BindParams): Promise<T[]> {
  const database = await openDb();
  const stmt = database.prepare(sql);
  const rows: T[] = [];
  try {
    if (params) stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
  } finally {
    stmt.free();
  }
  return rows;
}

export async function get<T extends Row = Row>(sql: string, params?: BindParams): Promise<T | undefined> {
  return (await all<T>(sql, params))[0];
}

export async function scalar<T = unknown>(sql: string, params?: BindParams): Promise<T | null> {
  const row = await get(sql, params);
  if (!row) return null;
  return Object.values(row)[0] as T;
}

export async function transaction<T>(fn: () => Promise<T> | T): Promise<T> {
  const database = await openDb();
  database.run("BEGIN IMMEDIATE TRANSACTION");
  try {
    const result = await fn();
    database.run("COMMIT");
    await saveDb();
    return result;
  } catch (error) {
    database.run("ROLLBACK");
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
