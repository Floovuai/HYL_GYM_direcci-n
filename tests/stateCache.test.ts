import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ version: 0, listeners: new Set<() => void>() }));

vi.mock("../src/server/db", () => ({
  getDataVersion: () => state.version,
  onDataChange: (listener: () => void) => {
    state.listeners.add(listener);
    return () => state.listeners.delete(listener);
  }
}));

import { clearStateCache, getStateEntry } from "../src/server/lib/stateCache";

describe("stateCache", () => {
  beforeEach(() => {
    state.version = 0;
    clearStateCache();
  });

  it("reutiliza el estado mientras los datos no cambian", async () => {
    const build = vi.fn(async () => ({ total: 10 }));
    const first = await getStateEntry(build, 2026, 8);
    const second = await getStateEntry(build, 2026, 8);
    expect(build).toHaveBeenCalledTimes(1);
    expect(first.hit).toBe(false);
    expect(second.hit).toBe(true);
    expect(second.entry.etag).toBe(first.entry.etag);
    expect(JSON.parse(second.entry.json)).toEqual({ total: 10 });
  });

  it("recalcula cuando cambia la version de datos", async () => {
    let total = 1;
    const build = vi.fn(async () => ({ total }));
    const first = await getStateEntry(build, 2026, 8);
    state.version += 1;
    total = 2;
    const second = await getStateEntry(build, 2026, 8);
    expect(build).toHaveBeenCalledTimes(2);
    expect(second.hit).toBe(false);
    expect(second.entry.etag).not.toBe(first.entry.etag);
  });

  it("agrupa llamadas simultaneas en un unico calculo", async () => {
    const build = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { ok: true };
    });
    const results = await Promise.all([1, 2, 3, 4].map(() => getStateEntry(build, 2026, 9)));
    expect(build).toHaveBeenCalledTimes(1);
    expect(new Set(results.map((item) => item.entry.etag)).size).toBe(1);
  });

  it("mantiene periodos distintos por separado", async () => {
    const build = vi.fn(async (year?: number, month?: number) => ({ year, month }));
    await getStateEntry(build, 2026, 7);
    await getStateEntry(build, 2026, 8);
    await getStateEntry(build, 2026, 7);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("no deja una entrada vieja como vigente si los datos cambian durante el calculo", async () => {
    const build = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { n: 1 };
    });
    const pending = getStateEntry(build, 2026, 8);
    state.version += 1;
    await pending;
    const next = await getStateEntry(build, 2026, 8);
    expect(next.hit).toBe(false);
    expect(build).toHaveBeenCalledTimes(2);
  });
});
