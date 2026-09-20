// Cache en memoria del estado de la app (/api/state).
// El estado se recalcula solo cuando cambian los datos (db.getDataVersion),
// cambia el dia o vence un limite de seguridad. Las llamadas simultaneas
// comparten un unico calculo y el JSON serializado queda listo con su ETag.
import { createHash } from "node:crypto";
import { getDataVersion, onDataChange } from "../db";

export type StateEntry = {
  json: string;
  etag: string;
  version: number;
  day: string;
  builtAt: number;
  buildMs: number;
};

type Builder = (year?: number, month?: number) => Promise<unknown>;

const MAX_AGE_MS = Math.max(15_000, Number(process.env.STATE_CACHE_MAX_AGE_MS || 120_000));
const MAX_KEYS = 6;
const WARM_DELAY_MS = 1_500;

const entries = new Map<string, StateEntry>();
const inflight = new Map<string, Promise<StateEntry>>();
let builder: Builder | null = null;
let warmTimer: NodeJS.Timeout | null = null;

function keyOf(year?: number, month?: number) {
  return `${year ?? ""}-${month ?? ""}`;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function isFresh(entry: StateEntry) {
  return entry.version === getDataVersion() && entry.day === todayKey() && Date.now() - entry.builtAt < MAX_AGE_MS;
}

export async function getStateEntry(
  build: Builder,
  year?: number,
  month?: number
): Promise<{ entry: StateEntry; hit: boolean }> {
  builder = build;
  const key = keyOf(year, month);
  const cached = entries.get(key);
  if (cached && isFresh(cached)) return { entry: cached, hit: true };

  const running = inflight.get(key);
  if (running) return { entry: await running, hit: true };

  const promise = (async () => {
    // La version se toma antes de calcular: si los datos cambian durante el
    // calculo, la entrada queda vieja de inmediato y se recalcula en la
    // siguiente lectura.
    const version = getDataVersion();
    const day = todayKey();
    const startedAt = Date.now();
    const state = await build(year, month);
    const json = JSON.stringify(state);
    const entry: StateEntry = {
      json,
      etag: `"${createHash("sha1").update(json).digest("base64url")}"`,
      version,
      day,
      builtAt: Date.now(),
      buildMs: Date.now() - startedAt
    };
    entries.delete(key);
    entries.set(key, entry);
    while (entries.size > MAX_KEYS) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
    return entry;
  })().finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return { entry: await promise, hit: false };
}

// Tras un cambio de datos, recalcula en segundo plano los periodos consultados
// para que la siguiente lectura ya encuentre el estado listo.
onDataChange(() => {
  if (!builder || entries.size === 0) return;
  if (warmTimer) clearTimeout(warmTimer);
  warmTimer = setTimeout(() => {
    warmTimer = null;
    const build = builder;
    if (!build) return;
    const keys = [...entries.keys()].slice(-2);
    (async () => {
      for (const key of keys) {
        const [year, month] = key.split("-");
        await getStateEntry(build, year ? Number(year) : undefined, month ? Number(month) : undefined);
      }
    })().catch((error) => console.warn("No se pudo precalcular el estado", error instanceof Error ? error.message : error));
  }, WARM_DELAY_MS);
  warmTimer.unref?.();
});

export function clearStateCache() {
  entries.clear();
}
