import { cleanDisplay, monthNumber, normalizeKey } from "./business";

export type EvolutionCell = string | number | Date | boolean | null | undefined;

/**
 * Como se interpreta la tabla mensual de EVO por sede:
 *   Activo inicio + Total de entradas - Total de salidas = Activos fin
 *   Total de entradas = Nuevos + Renovados + Reinscripciones + Regresos de suspension
 *   Total de salidas  = Bajas + Vencidos + No renovados + Suspendidos
 *   Evolucion = Activos fin - Activo inicio (y su % sobre Activo inicio)
 * Activo inicio de un mes es el Activos fin del mes anterior.
 */
export interface EvolutionMonthRow {
  branchName: string;
  activeStart: number;
  newMembers: number;
  renewed: number;
  reinscriptions: number;
  returnedFromSuspension: number;
  totalEntries: number;
  cancellations: number;
  expired: number;
  notRenewed: number;
  suspended: number;
  totalExits: number;
  activeEnd: number;
}

const COLUMNS: Array<{ key: keyof Omit<EvolutionMonthRow, "branchName">; label: string; aliases: string[]; required: boolean }> = [
  { key: "activeStart", label: "Activo inicio", aliases: ["Activo inicio"], required: true },
  { key: "newMembers", label: "Nuevos", aliases: ["Nuevos"], required: true },
  { key: "renewed", label: "Renovados", aliases: ["Renovados"], required: true },
  { key: "reinscriptions", label: "Reinscripciones", aliases: ["Reinscripciones"], required: true },
  { key: "returnedFromSuspension", label: "Regresos de las suspensiones", aliases: ["Regresos de las suspensiones", "Regresos de suspension"], required: false },
  { key: "totalEntries", label: "Total de entradas", aliases: ["Total de entradas"], required: true },
  { key: "cancellations", label: "Bajas", aliases: ["Bajas"], required: true },
  { key: "expired", label: "Vencidos", aliases: ["Vencidos"], required: true },
  { key: "notRenewed", label: "No renovados", aliases: ["No renovados"], required: true },
  { key: "suspended", label: "Suspendidos", aliases: ["Suspendidos"], required: false },
  { key: "totalExits", label: "Resultados totales", aliases: ["Resultados totales", "Total de salidas"], required: true },
  { key: "activeEnd", label: "Activos fin", aliases: ["Activos fin"], required: true }
];

function toNumber(value: EvolutionCell) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/[^\d.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function cleanEvolutionBranchName(raw: unknown) {
  return cleanDisplay(raw).replace(/^\d+\s*-\s*/, "");
}

/** Lee la hoja de EVO (primera fila = encabezados) y valida que las cifras cuadren. */
export function parseEvolutionRows(sheet: EvolutionCell[][]): EvolutionMonthRow[] {
  if (!sheet.length) throw new Error("El archivo de evolucion no tiene datos");
  const header = new Map(sheet[0].map((value, index) => [normalizeKey(value), index]));
  const branchColumn = ["SEDE CLUB", "SEDE", "CLUB"].map((key) => header.get(key)).find((index) => index !== undefined);
  const columns = COLUMNS.map((column) => ({
    ...column,
    index: column.aliases.map((alias) => header.get(normalizeKey(alias))).find((index) => index !== undefined)
  }));
  const missing = [
    ...(branchColumn === undefined ? ["Sede/club"] : []),
    ...columns.filter((column) => column.required && column.index === undefined).map((column) => column.label)
  ];
  if (missing.length) {
    const found = sheet[0].map((value) => cleanDisplay(value)).filter(Boolean).join(", ") || "sin encabezados reconocibles";
    throw new Error(`El archivo no tiene el formato de evolucion de EVO. Faltan columnas: ${missing.join(", ")}. Encabezados detectados: ${found}.`);
  }

  const rows: EvolutionMonthRow[] = [];
  for (const line of sheet.slice(1)) {
    const branchName = cleanEvolutionBranchName(line[branchColumn as number]);
    if (!branchName || normalizeKey(branchName).startsWith("TOTAL")) continue;
    const row: EvolutionMonthRow = {
      branchName,
      activeStart: 0,
      newMembers: 0,
      renewed: 0,
      reinscriptions: 0,
      returnedFromSuspension: 0,
      totalEntries: 0,
      cancellations: 0,
      expired: 0,
      notRenewed: 0,
      suspended: 0,
      totalExits: 0,
      activeEnd: 0
    };
    for (const column of columns) {
      if (column.index !== undefined) row[column.key] = toNumber(line[column.index]);
    }
    const expected = row.activeStart + row.totalEntries - row.totalExits;
    if (expected !== row.activeEnd) {
      throw new Error(
        `Evolucion inconsistente en ${branchName}: Activo inicio (${row.activeStart}) + entradas (${row.totalEntries}) - salidas (${row.totalExits}) = ${expected}, pero Activos fin es ${row.activeEnd}.`
      );
    }
    rows.push(row);
  }
  if (!rows.length) throw new Error("El archivo de evolucion no tiene filas de sedes");
  return rows;
}

/** Detecta mes y ano desde un nombre como "EVOLUCION ENERO 26.xlsx" o "Agosto 2026". */
export function detectEvolutionPeriod(fileName: string): { year: number; month: number } | null {
  const parts = normalizeKey(fileName.replace(/\.[^.]+$/, "")).split(" ").filter(Boolean);
  const month = parts.map((part) => monthNumber(part)).find(Boolean) ?? 0;
  const yearToken = parts.find((part) => /^(\d{2}|\d{4})$/.test(part));
  if (!month || !yearToken) return null;
  const value = Number(yearToken);
  return { year: value < 100 ? 2000 + value : value, month };
}

export interface EvolutionMetricsInput {
  activeStart: number;
  totalEntries: number;
  totalExits: number;
  cancellations: number;
  notRenewed: number;
  activeEnd: number;
}

export function evolutionMetrics(row: EvolutionMetricsInput) {
  const netEvolution = row.activeEnd - row.activeStart;
  const base = row.activeStart;
  return {
    netEvolution,
    netEvolutionRate: base > 0 ? netEvolution / base : 0,
    directChurn: base > 0 ? (row.cancellations + row.notRenewed) / base : 0,
    grossChurn: base > 0 ? row.totalExits / base : 0,
    entryRate: base > 0 ? row.totalEntries / base : 0,
    trend: evolutionTrend(netEvolution, base)
  };
}

/** Umbral de 0,5% del activo inicial para no llamar "crecimiento" al ruido. */
export function evolutionTrend(netEvolution: number, activeStart: number): "grows" | "falls" | "stable" {
  if (activeStart <= 0) return netEvolution > 0 ? "grows" : netEvolution < 0 ? "falls" : "stable";
  const rate = netEvolution / activeStart;
  return rate >= 0.005 ? "grows" : rate <= -0.005 ? "falls" : "stable";
}
