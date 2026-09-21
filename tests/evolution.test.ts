import { describe, expect, it } from "vitest";
import { detectEvolutionPeriod, evolutionMetrics, evolutionTrend, parseEvolutionRows } from "../src/shared/evolution";
import { EVOLUTION_SEED } from "../src/server/data/evolutionSeed";

const HEADER = ["Sede/club", "Activo inicio", "Nuevos", "Renovados", "Reinscripciones", "Regresos de las suspensiones", "Total de entradas", "Bajas", "Vencidos", "No renovados", "Suspendidos", "Resultados totales", "Activos fin", "Evolución"];

describe("evolucion mensual de EVO", () => {
  it("detecta mes y ano desde el nombre del archivo", () => {
    expect(detectEvolutionPeriod("EVOLUCION ENERO 26.xlsx")).toEqual({ year: 2026, month: 1 });
    expect(detectEvolutionPeriod("Evolución Agosto 2026.xlsx")).toEqual({ year: 2026, month: 8 });
    expect(detectEvolutionPeriod("1758000000-EVOLUCION SEPTIEMBRE 26.xlsx")).toEqual({ year: 2026, month: 9 });
    expect(detectEvolutionPeriod("evolucion.xlsx")).toBeNull();
  });

  it("lee las filas y descarta totales y sedes vacias de nombre", () => {
    const rows = parseEvolutionRows([
      HEADER,
      ["4 - HYL MODELIA", 2568, 175, 0, 333, 33, 541, 1, 0, 515, 17, 533, 2576, "8 (0,3%)"],
      ["Total", 2568, 175, 0, 333, 33, 541, 1, 0, 515, 17, 533, 2576, ""],
      [null, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ""]
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].branchName).toBe("HYL MODELIA");
    expect(rows[0].activeEnd).toBe(2576);
  });

  it("rechaza filas donde inicio + entradas - salidas no cuadra con activos fin", () => {
    expect(() =>
      parseEvolutionRows([HEADER, ["3 - HYL BUENOS AIRES", 1258, 62, 41, 117, 15, 235, 1, 122, 131, 15, 269, 1200, ""]])
    ).toThrow(/inconsistente/i);
  });

  it("rechaza archivos sin las columnas de evolucion", () => {
    expect(() => parseEvolutionRows([["Cliente", "Valor"], ["A", 1]])).toThrow(/Faltan columnas/);
  });

  it("calcula variacion, salida bruta y tendencia", () => {
    const metrics = evolutionMetrics({ activeStart: 1000, totalEntries: 200, totalExits: 250, cancellations: 10, notRenewed: 90, activeEnd: 950 });
    expect(metrics.netEvolution).toBe(-50);
    expect(metrics.netEvolutionRate).toBeCloseTo(-0.05);
    expect(metrics.grossChurn).toBeCloseTo(0.25);
    expect(metrics.directChurn).toBeCloseTo(0.1);
    expect(metrics.trend).toBe("falls");
    expect(evolutionTrend(3, 1000)).toBe("stable");
    expect(evolutionTrend(50, 1000)).toBe("grows");
  });

  it("el historico incluido cuadra y es continuo mes a mes por sede", () => {
    const totalsByMonth = new Map<number, { start: number; end: number }>();
    const previousEnd = new Map<string, number>();
    for (const month of EVOLUTION_SEED) {
      const rows = parseEvolutionRows([HEADER, ...month.rows]);
      for (const row of rows) {
        const before = previousEnd.get(row.branchName);
        if (before !== undefined) expect(row.activeStart, `${row.branchName} ${month.month}`).toBe(before);
        previousEnd.set(row.branchName, row.activeEnd);
      }
      totalsByMonth.set(month.month, {
        start: rows.reduce((sum, row) => sum + row.activeStart, 0),
        end: rows.reduce((sum, row) => sum + row.activeEnd, 0)
      });
    }
    expect([...totalsByMonth.keys()]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(totalsByMonth.get(8)?.end).toBe(8045);
  });
});
