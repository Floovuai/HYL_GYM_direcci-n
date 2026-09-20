import path from "node:path";
import { monthName } from "../shared/business";
import {
  detectEvolutionPeriod,
  evolutionMetrics,
  parseEvolutionRows,
  type EvolutionMonthRow
} from "../shared/evolution";
import { all, get, run, scalar, transaction } from "./db";
import { ensureBranch, loadSheet } from "./importers";
import { EVOLUTION_SEED } from "./data/evolutionSeed";

const SEED_SOURCE = "seed";
const UPLOAD_SOURCE = "upload";

async function saveMonth(year: number, month: number, rows: EvolutionMonthRow[], source: string, sourceFile: string) {
  await run("DELETE FROM evolution_monthly WHERE year = ? AND month = ?", [year, month]);
  for (const row of rows) {
    const branchId = await ensureBranch(row.branchName);
    const metrics = evolutionMetrics(row);
    await run(
      `INSERT INTO evolution_monthly (
        year, month, branch_id, active_start, new_members, renewed, reinscriptions, returned_from_suspension,
        total_entries, cancellations, expired, not_renewed, suspended, total_exits, active_end,
        net_evolution, net_evolution_rate, source, source_file, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        year, month, branchId, row.activeStart, row.newMembers, row.renewed, row.reinscriptions,
        row.returnedFromSuspension, row.totalEntries, row.cancellations, row.expired, row.notRenewed,
        row.suspended, row.totalExits, row.activeEnd, metrics.netEvolution, metrics.netEvolutionRate,
        source, sourceFile
      ]
    );
  }
}

/**
 * Precarga el historico incluido en la aplicacion. Solo escribe los meses que aun no tienen datos,
 * asi que nunca pisa lo que el usuario haya cargado y es seguro repetirlo en cada arranque.
 */
export async function seedEvolutionHistory() {
  for (const month of EVOLUTION_SEED) {
    const existing = (await scalar<number>("SELECT COUNT(*) FROM evolution_monthly WHERE year = ? AND month = ?", [month.year, month.month])) ?? 0;
    if (existing > 0) continue;
    const rows = parseEvolutionRows([
      ["Sede/club", "Activo inicio", "Nuevos", "Renovados", "Reinscripciones", "Regresos de las suspensiones", "Total de entradas", "Bajas", "Vencidos", "No renovados", "Suspendidos", "Resultados totales", "Activos fin"],
      ...month.rows
    ]);
    await transaction(() => saveMonth(month.year, month.month, rows, SEED_SOURCE, month.file));
  }
}

export interface EvolutionUploadSummary {
  fileName: string;
  year: number;
  month: number;
  monthLabel: string;
  branches: number;
  activeStart: number;
  activeEnd: number;
  replaced: boolean;
}

export async function importEvolutionMonth(
  filePath: string,
  originalName: string,
  override?: { year?: number; month?: number }
): Promise<EvolutionUploadSummary> {
  const detected = detectEvolutionPeriod(originalName);
  const year = override?.year || detected?.year || 0;
  const month = override?.month || detected?.month || 0;
  if (!year || !month || month > 12) {
    throw Object.assign(
      new Error(`No se pudo detectar el mes de "${originalName}". Nombra el archivo como "EVOLUCION SEPTIEMBRE 26.xlsx" o elige el mes antes de cargar.`),
      { statusCode: 400 }
    );
  }
  let rows: EvolutionMonthRow[];
  try {
    rows = parseEvolutionRows(await loadSheet(filePath));
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), { statusCode: 400 });
  }
  const replaced = ((await scalar<number>("SELECT COUNT(*) FROM evolution_monthly WHERE year = ? AND month = ?", [year, month])) ?? 0) > 0;
  await transaction(async () => {
    await saveMonth(year, month, rows, UPLOAD_SOURCE, path.basename(originalName));
    await run(
      `INSERT INTO import_batches (source_type, source_key, source_file, rows_read, rows_inserted, duplicates_skipped, total_value, details)
       VALUES ('evolution_monthly_upload', ?, ?, ?, ?, 0, ?, ?)`,
      [
        `evolution_monthly_upload:${year}-${month}:${Date.now()}`,
        path.basename(originalName),
        rows.length,
        rows.length,
        rows.reduce((sum, row) => sum + row.activeEnd, 0),
        JSON.stringify({ year, month, replaced })
      ]
    );
  });
  return {
    fileName: path.basename(originalName),
    year,
    month,
    monthLabel: `${monthName(month)} ${year}`,
    branches: rows.length,
    activeStart: rows.reduce((sum, row) => sum + row.activeStart, 0),
    activeEnd: rows.reduce((sum, row) => sum + row.activeEnd, 0),
    replaced
  };
}

type Row = Record<string, unknown>;
const num = (value: unknown) => Number(value ?? 0) || 0;

function shape(row: Row) {
  const shaped = {
    year: num(row.year),
    month: num(row.month),
    branchId: num(row.branch_id),
    branchName: String(row.branch_name ?? "Sin sede"),
    activeStart: num(row.active_start),
    newMembers: num(row.new_members),
    renewed: num(row.renewed),
    reinscriptions: num(row.reinscriptions),
    returnedFromSuspension: num(row.returned_from_suspension),
    totalEntries: num(row.total_entries),
    cancellations: num(row.cancellations),
    expired: num(row.expired),
    notRenewed: num(row.not_renewed),
    suspended: num(row.suspended),
    totalExits: num(row.total_exits),
    activeEnd: num(row.active_end)
  };
  return { ...shaped, ...evolutionMetrics(shaped) };
}

export async function buildEvolutionOverview() {
  const rows = (
    await all<Row>(
      `SELECT em.*, b.display_name branch_name
       FROM evolution_monthly em
       JOIN branches b ON b.id = em.branch_id
       ORDER BY em.year, em.month, b.display_name`
    )
  ).map(shape);
  // Una sede sin ningun movimiento en todo el historico (por ejemplo una sede aun sin abrir) no aporta a las lecturas.
  const activeBranches = new Set<number>();
  for (const row of rows) {
    if (row.activeStart || row.activeEnd || row.totalEntries || row.totalExits) activeBranches.add(row.branchId);
  }
  const visibleRows = rows.filter((row) => activeBranches.has(row.branchId));
  const branches = [...new Map(visibleRows.map((row) => [row.branchId, { id: row.branchId, name: row.branchName }])).values()];

  const periods = [...new Map(visibleRows.map((row) => [`${row.year}-${row.month}`, { year: row.year, month: row.month }])).values()];
  const months = periods.map(({ year, month }) => {
    const monthRows = visibleRows.filter((row) => row.year === year && row.month === month);
    const sum = (key: "activeStart" | "newMembers" | "renewed" | "reinscriptions" | "returnedFromSuspension" | "totalEntries" | "cancellations" | "expired" | "notRenewed" | "suspended" | "totalExits" | "activeEnd") =>
      monthRows.reduce((total, row) => total + row[key], 0);
    const totals = {
      activeStart: sum("activeStart"),
      newMembers: sum("newMembers"),
      renewed: sum("renewed"),
      reinscriptions: sum("reinscriptions"),
      returnedFromSuspension: sum("returnedFromSuspension"),
      totalEntries: sum("totalEntries"),
      cancellations: sum("cancellations"),
      expired: sum("expired"),
      notRenewed: sum("notRenewed"),
      suspended: sum("suspended"),
      totalExits: sum("totalExits"),
      activeEnd: sum("activeEnd")
    };
    return {
      year,
      month,
      key: `${year}-${String(month).padStart(2, "0")}`,
      label: `${monthName(month).slice(0, 3)} ${String(year).slice(2)}`,
      longLabel: `${monthName(month)} ${year}`,
      branchesWithData: monthRows.filter((row) => row.activeEnd > 0).length,
      totals: { ...totals, ...evolutionMetrics(totals) }
    };
  });
  const lastUpdated = await get<Row>("SELECT MAX(updated_at) updated_at FROM evolution_monthly");
  const sources = await all<Row>("SELECT year, month, source, source_file FROM evolution_monthly GROUP BY year, month ORDER BY year, month");
  return {
    available: months.length > 0,
    months,
    branches,
    rows: visibleRows,
    sources: sources.map((row) => ({ year: num(row.year), month: num(row.month), source: String(row.source), file: String(row.source_file ?? "") })),
    updatedAt: lastUpdated?.updated_at ?? null
  };
}
