import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { readSheet } from "read-excel-file/node";
import {
  advisorBranchOverrideForSale,
  cleanDisplay,
  monthNumber,
  normalizeKey,
  officialIntegratedReportTargets2026,
  ratingMultiplier,
  ratingScore
} from "../shared/business";
import { all, get, run, scalar, transaction } from "./db";

type CellValue = string | number | Date | boolean | null | undefined;
type SheetRow = CellValue[];

export interface SeedPaths {
  salesXlsx?: string;
  commissionsXlsx?: string;
  pricingXlsx?: string;
  memberEvolutionXlsx?: string | string[];
}

export interface ImportSummary {
  sourceType: string;
  sourceKey: string;
  sourceFile: string;
  rowsRead: number;
  rowsInserted: number;
  duplicatesSkipped: number;
  rowsIgnored?: number;
  ignoreReasons?: Record<string, number>;
  totalValue: number;
  months: { year: number; month: number; day?: number; cutoffDate?: string | null }[];
}

type HeaderRequirement = {
  column?: number;
  label: string;
  aliases: string[];
};

const SALES_HEADER_REQUIREMENTS: HeaderRequirement[] = [
  { column: 1, label: "Sede/club", aliases: ["Sede/club", "Sede", "Club"] },
  { column: 4, label: "Nombre", aliases: ["Nombre"] },
  { column: 5, label: "Apellido", aliases: ["Apellido"] },
  { column: 7, label: "Descripción", aliases: ["Descripción", "Descripcion", "Plan", "Producto"] },
  { column: 9, label: "Cantidad", aliases: ["Cantidad"] },
  { column: 10, label: "Valor", aliases: ["Valor", "Total", "Monto"] },
  { column: 11, label: "Fecha de venta", aliases: ["Fecha de venta", "Fecha venta", "Fecha"] },
  { column: 12, label: "Método de pago", aliases: ["Método de pago", "Metodo de pago", "Forma de pago"] },
  { column: 13, label: "Empleado comisión", aliases: ["Empleado comisión", "Empleado comision", "Asesor", "Vendedor"] }
];

const EVOLUTION_HEADER_REQUIREMENTS: HeaderRequirement[] = [
  { label: "Sede/club", aliases: ["Sede/club", "Sede", "Club"] },
  { label: "Activo inicio", aliases: ["Activo inicio"] },
  { label: "Nuevos", aliases: ["Nuevos"] },
  { label: "Renovados", aliases: ["Renovados"] },
  { label: "Reinscripciones", aliases: ["Reinscripciones"] },
  { label: "Total de entradas", aliases: ["Total de entradas"] },
  { label: "Bajas", aliases: ["Bajas"] },
  { label: "Vencidos", aliases: ["Vencidos"] },
  { label: "No renovados", aliases: ["No renovados"] },
  { label: "Resultados totales", aliases: ["Resultados totales"] },
  { label: "Activos fin", aliases: ["Activos fin"] }
];

const EXCLUDED_ADVISORS = new Set([
  "SUPORTEEVO",
  "SOPORTEEVO",
  "VICTOR HERRERA",
  "SOPORTE EVO",
  "LAURA VALENTINA ALVAREZ ALVARADO"
]);
const ONLINE_ADVISORS = new Set(["XIOMARA OCHOA", "ESTEBAN MANCERA", "MARIA CAMILA SALAZAR"]);
const ADVISOR_REMOVAL_START = new Date(Date.UTC(2026, 7, 1));
const ADVISORS_REMOVED_FROM_AUGUST = new Set([
  "XIOMARA OCHOA",
  "VALENTINA VARGAS",
  "JEFERSON RODRIGUEZ",
  "ANGELA VIVIANA GUTIERREZ GAMBOA",
  "SARA VALENTINA MESA RODRIGUEZ"
]);
const REMOVED_ADVISOR_HASHES = new Set<string>();

const DEFAULT_SETTINGS: Record<string, string> = {
  monthly_conversion_goal_per_advisor: "100",
  max_discount_rate: "0.03",
  score_high: "80",
  score_medium: "60",
  evo_base_url: process.env.EVO_BASE_URL || "https://evo-integracao-api.w12app.com.br",
  evo_dns: process.env.EVO_DNS || "",
  evo_api_key: "",
  groq_api_key: "",
  groq_model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  selected_year: "2026",
  selected_month: "6"
};

function cell(row: SheetRow, col: number): CellValue {
  return row[col - 1] ?? null;
}

function text(row: SheetRow, col: number): string {
  return cleanDisplay(cell(row, col));
}

function number(row: SheetRow, col: number): number {
  const value = cell(row, col);
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean" || value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDate(value: CellValue): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86400000);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function fileHash(filePath: string) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").slice(0, 16);
}

function rowHasAnyValue(row: SheetRow) {
  return row.some((value) => cleanDisplay(value).length > 0);
}

function normalizedHeaderAt(row: SheetRow, column: number) {
  return normalizeKey(cell(row, column));
}

function headerIncludes(row: SheetRow, aliases: string[]) {
  const headers = new Set(row.map((value) => normalizeKey(value)).filter(Boolean));
  return aliases.some((alias) => headers.has(normalizeKey(alias)));
}

function validateHeaderRow(sheet: SheetRow[], requirements: HeaderRequirement[], fileKind: string) {
  const header = sheet[0] ?? [];
  const missing = requirements.filter((requirement) => {
    if (requirement.column) {
      const current = normalizedHeaderAt(header, requirement.column);
      if (requirement.aliases.some((alias) => current === normalizeKey(alias))) return false;
    }
    return !headerIncludes(header, requirement.aliases);
  });
  if (!missing.length) return;
  const found = header.map((value) => cleanDisplay(value)).filter(Boolean).join(", ") || "sin encabezados reconocibles";
  throw new Error(
    `El archivo de ${fileKind} no tiene el formato esperado. Faltan columnas: ${missing.map((item) => item.label).join(", ")}. Encabezados detectados: ${found}.`
  );
}

function periodFromEvolutionFile(filePath: string, options?: { year?: number; month?: number }) {
  if (options?.year && options?.month) return { year: options.year, month: options.month };
  const base = normalizeKey(path.basename(filePath, path.extname(filePath)));
  const parts = base.split(/\s+/).filter(Boolean);
  const month = parts.map((part) => monthNumber(part)).find(Boolean) || 0;
  const yearToken = parts.find((part) => /^\d{2,4}$/.test(part));
  const yearNumber = Number(yearToken || 0);
  const year = yearNumber < 100 && yearNumber > 0 ? 2000 + yearNumber : yearNumber;
  if (!year || !month) {
    throw new Error(`No se pudo detectar periodo en ${path.basename(filePath)}`);
  }
  return { year, month };
}

function numericPartsFromFileName(filePath: string) {
  return normalizeKey(path.basename(filePath, path.extname(filePath)))
    .split(/\s+/)
    .map((part) => Number(part))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function cutoffFromEvolutionFile(filePath: string, period: { year: number; month: number }, options?: { day?: number }) {
  const daysInMonth = new Date(period.year, period.month, 0).getDate();
  const explicitDay = Number(options?.day || 0);
  if (explicitDay > 0) {
    if (explicitDay > daysInMonth) {
      throw new Error(`Dia de corte invalido para ${period.year}-${String(period.month).padStart(2, "0")}: ${explicitDay}`);
    }
    return {
      day: explicitDay,
      cutoffDate: `${period.year}-${String(period.month).padStart(2, "0")}-${String(explicitDay).padStart(2, "0")}`
    };
  }

  const parts = numericPartsFromFileName(filePath);
  const [first, second] = parts;
  const inferredDay =
    first && first <= daysInMonth && second === period.month
      ? first
      : first && first <= daysInMonth && parts.length === 1
        ? first
        : 0;
  return {
    day: inferredDay,
    cutoffDate: inferredDay
      ? `${period.year}-${String(period.month).padStart(2, "0")}-${String(inferredDay).padStart(2, "0")}`
      : null
  };
}

function evolutionNumber(row: Record<string, unknown>, header: string) {
  const value = row[header];
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/[^\d.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function evolutionHeaderMap(header: SheetRow) {
  return new Map(header.map((value, index) => [normalizeKey(value), index]));
}

function evolutionCell(row: SheetRow, header: Map<string, number>, label: string) {
  const index = header.get(normalizeKey(label));
  return index === undefined ? null : row[index];
}

function sheetHeaderMap(header: SheetRow) {
  return new Map(header.map((value, index) => [normalizeKey(value), index]));
}

function headerIndex(header: Map<string, number>, aliases: string[], fallbackColumn: number) {
  for (const alias of aliases) {
    const index = header.get(normalizeKey(alias));
    if (index !== undefined) return index;
  }
  return fallbackColumn - 1;
}

function salesHeaderMap(header: SheetRow) {
  const map = sheetHeaderMap(header);
  return {
    branch: headerIndex(map, ["Sede/club", "Sede", "Club"], 1),
    type: headerIndex(map, ["Tipo"], 2),
    id: headerIndex(map, ["ID", "Cliente ID", "ID cliente"], 3),
    firstName: headerIndex(map, ["Nombre"], 4),
    lastName: headerIndex(map, ["Apellido"], 5),
    item: headerIndex(map, ["Item", "Ítem", "tem"], 6),
    description: headerIndex(map, ["Descripción", "Descripcion", "Descripci n", "Plan", "Producto"], 7),
    startedAt: headerIndex(map, ["Inicio en", "Inicio"], 8),
    quantity: headerIndex(map, ["Cantidad"], 9),
    value: headerIndex(map, ["Valor", "Total", "Monto"], 10),
    saleId: headerIndex(map, ["ID de venta", "Id venta", "Venta ID"], 11),
    soldAt: headerIndex(map, ["Fecha de venta", "Fecha venta", "Fecha"], 11),
    paymentMethod: headerIndex(map, ["Método de pago", "Metodo de pago", "M todo de pago", "Forma de pago"], 12),
    advisor: headerIndex(map, ["Empleado comisión", "Empleado comision", "Empleado comisi n", "Asesor", "Vendedor"], 13),
    origin: headerIndex(map, ["Origen"], 14)
  };
}

function salesCell(row: SheetRow, header: ReturnType<typeof salesHeaderMap>, key: keyof ReturnType<typeof salesHeaderMap>): CellValue {
  return row[header[key]] ?? null;
}

function salesText(row: SheetRow, header: ReturnType<typeof salesHeaderMap>, key: keyof ReturnType<typeof salesHeaderMap>) {
  return cleanDisplay(salesCell(row, header, key));
}

function salesNumber(row: SheetRow, header: ReturnType<typeof salesHeaderMap>, key: keyof ReturnType<typeof salesHeaderMap>) {
  const value = salesCell(row, header, key);
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean" || value === null || value === undefined) return 0;
  const parsed = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function saleKey(input: {
  branchId: number;
  advisorId: number | null;
  planId: number | null;
  clientExternalId?: string;
  description?: string;
  soldAt: Date;
  value: number;
  quantity: number;
}) {
  return [
    input.branchId,
    input.advisorId ?? "",
    input.planId ?? "",
    cleanDisplay(input.clientExternalId),
    cleanDisplay(input.description),
    input.soldAt.toISOString(),
    Math.round(input.value || 0),
    input.quantity || 1
  ].join("|");
}

export async function loadSheet(filePath: string, sheet?: string) {
  let rows = (await readSheet(filePath, sheet ?? 1)) as unknown;
  if (shouldRetryWithRepairedDimensions(filePath, rows)) {
    const repairedPath = repairXlsxDimensions(filePath);
    try {
      rows = (await readSheet(repairedPath, sheet ?? 1)) as unknown;
    } finally {
      fs.rmSync(path.dirname(repairedPath), { recursive: true, force: true });
    }
  }
  if (
    Array.isArray(rows) &&
    rows.length === 1 &&
    rows[0] &&
    typeof rows[0] === "object" &&
    Array.isArray((rows[0] as { data?: unknown }).data)
  ) {
    return (rows[0] as { data: SheetRow[] }).data;
  }
  return rows as SheetRow[];
}

function shouldRetryWithRepairedDimensions(filePath: string, rows: unknown) {
  if (!filePath.toLowerCase().endsWith(".xlsx")) return false;
  if (!Array.isArray(rows) || rows.length > 1) return false;
  const first = rows[0];
  return Array.isArray(first) ? first.length <= 1 : true;
}

function excelColumnNumber(column: string) {
  return column.split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
}

function excelColumnName(index: number) {
  let value = Math.max(1, index);
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function repairXlsxDimensions(filePath: string) {
  const zip = unzipSync(new Uint8Array(fs.readFileSync(filePath)));
  for (const name of Object.keys(zip)) {
    if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) continue;
    const xml = strFromU8(zip[name]);
    let maxRow = 0;
    let maxCol = 0;
    for (const match of xml.matchAll(/<c[^>]*\sr="([A-Z]+)(\d+)"/g)) {
      maxCol = Math.max(maxCol, excelColumnNumber(match[1]));
      maxRow = Math.max(maxRow, Number(match[2]));
    }
    if (maxRow <= 1 && maxCol <= 1) continue;
    const dimension = `A1:${excelColumnName(maxCol)}${maxRow}`;
    const repairedXml = xml.includes("<dimension ")
      ? xml.replace(/<dimension\s+ref="[^"]*"\s*\/>/, `<dimension ref="${dimension}"/>`)
      : xml.replace("<sheetViews>", `<dimension ref="${dimension}"/><sheetViews>`);
    zip[name] = strToU8(repairedXml);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hyl-xlsx-"));
  const repairedPath = path.join(dir, path.basename(filePath));
  fs.writeFileSync(repairedPath, Buffer.from(zipSync(zip)));
  return repairedPath;
}

async function loadOptionalSheet(filePath: string, sheet: string) {
  try {
    return await loadSheet(filePath, sheet);
  } catch {
    return null;
  }
}

export function canonicalBranch(raw: unknown) {
  const key = normalizeKey(raw);
  if (!key) return { code: "SIN SEDE", name: "Sin sede", displayName: "Sin sede" };
  if (key.includes("CALLE 109") || key === "109" || key.includes(" 109")) {
    return { code: "109", name: "Calle 109", displayName: "Calle 109" };
  }
  if (key.includes("VILLA MAYOR") || key.includes("HEALTH AND LIFE VILLA MAYOR")) {
    return { code: "VILLA MAYOR", name: "Villa Mayor", displayName: "Villa Mayor" };
  }
  if (key.includes("COLORS") || key === "162" || key.includes(" 162")) {
    return { code: "162", name: "Colors 162", displayName: "Colors 162" };
  }
  if (key.includes("BUENOS AIRES")) {
    return { code: "BUENOS AIRES", name: "Buenos Aires", displayName: "Buenos Aires" };
  }
  if (key.includes("SANTA MATILDE")) {
    return { code: "SANTA MATILDE", name: "Santa Matilde", displayName: "Santa Matilde" };
  }
  if (key.includes("MODELIA")) {
    return { code: "MODELIA", name: "Modelia", displayName: "Modelia" };
  }
  if (key.includes("PRADO")) {
    return { code: "PRADO", name: "Prado Veraniego", displayName: "Prado Veraniego" };
  }
  if (key.includes("VILLAVICENCIO") || key.includes("VILLAVO")) {
    return { code: "VILLAVO", name: "Villavicencio", displayName: "Villavicencio" };
  }
  if (key.includes("ONLINE")) {
    return { code: "ONLINE", name: "Online", displayName: "Online" };
  }
  return { code: key, name: cleanDisplay(raw), displayName: cleanDisplay(raw) };
}

export function canonicalAdvisor(raw: unknown): string {
  const key = normalizeKey(raw);
  if (!key) return "";
  if (key.includes("ANGLICA") && key.includes("GUERRERO")) {
    return "ANGELICA MARIA GUERRERO ISARIZA";
  }
  if (key.includes("ANGELA") && key.includes("GUTIERREZ")) {
    return "ANGELA VIVIANA GUTIERREZ GAMBOA";
  }
  if (key === "ESTEFANIA BUSTOS" || (key.includes("ESTEFANIA") && key.includes("BUSTOS"))) {
    return "ESTEFANIA YINNETH BUSTOS QUINTERO";
  }
  if (key === "MARIA JOSE VALLEJO") {
    return "MARIA JOSE VALLEJO CAICEDO";
  }
  return key;
}

const ESTEFANIA_SALE_CORRECTIONS = new Set([
  "2026-08|CARLOS FELIPE QUIMBAYO BERNAL|TRIMESTRE RUTA 90|269000",
  "2026-08|LAURA LIZETH VIVAS BONILLA|TRIMESTRE RUTA 90|269000",
  "2026-08|YUDITH SANCHEZ NIEVES|DUO ANIVERSARIO 6 MESES|399000",
  "2026-08|JAHIDER ALEXANDER SANCHEZ NIEVES|DUO ANIVERSARIO 6 MESES|399000",
  "2026-08|AUGUSTO AVILAN PERILLA|6 MESES PREVENTA|419000",
  "2026-08|ANDRES FELIPE RUIZ GUZMAN|13 MESES PREVENTA|649000",
  "2026-09|SHARLOTHE SARMIENTO|4 MESES 12 DIAS WEB 2 SESIONES|359000",
  "2026-09|SAMUEL RIVEROS|3 MESES PREVENTA|229000"
]);

function advisorForSale(input: {
  rawAdvisor: unknown;
  rawBranch?: unknown;
  clientName?: unknown;
  clientLastName?: unknown;
  planName?: unknown;
  value?: number;
  soldAt?: Date | null;
}) {
  const soldAt = input.soldAt;
  const correctionPeriod = soldAt
    ? `${soldAt.getUTCFullYear()}-${String(soldAt.getUTCMonth() + 1).padStart(2, "0")}`
    : "";
  const correctionKey = [
    correctionPeriod,
    normalizeKey(`${cleanDisplay(input.clientName)} ${cleanDisplay(input.clientLastName)}`),
    normalizeKey(input.planName),
    Math.round(Number(input.value || 0))
  ].join("|");
  if (ESTEFANIA_SALE_CORRECTIONS.has(correctionKey)) {
    return "ESTEFANIA YINNETH BUSTOS QUINTERO";
  }
  // Regla Villa Mayor: durante la preventa (desde agosto 2026) la sede la opera
  // solo Estefania. Toda venta de Villa Mayor sin un asesor activo nombrado
  // (campo vacio, usuario generico tipo SUPORTEEVO o un asesor retirado) se
  // atribuye a ella. Las ventas con un asesor activo nombrado conservan su credito.
  if (soldAt && soldAt >= new Date(Date.UTC(2026, 7, 1))) {
    const branchCode = canonicalBranch(input.rawBranch).code;
    if (
      (branchCode === "VILLA MAYOR" || branchCode === "109") &&
      (unassignedAdvisor(input.rawAdvisor) || isAdvisorRemovedFromSale(input.rawAdvisor, soldAt))
    ) {
      return "ESTEFANIA YINNETH BUSTOS QUINTERO";
    }
  }
  if (
    soldAt &&
    soldAt.getUTCFullYear() === 2026 &&
    soldAt.getUTCMonth() === 7 &&
    soldAt.getUTCDate() === 17 &&
    canonicalAdvisor(input.rawAdvisor) === "OMAR PADILLA"
  ) {
    return "FERNANDA AMAYA";
  }
  return input.rawAdvisor;
}

function branchForAdvisor(rawBranch: unknown, rawAdvisor: unknown, soldAt?: Date | null) {
  const advisor = canonicalAdvisor(rawAdvisor);
  const isVillaMayorPeriod = Boolean(soldAt && soldAt >= new Date(Date.UTC(2026, 7, 1)));
  if (isVillaMayorPeriod && canonicalBranch(rawBranch).code === "109") return "Villa Mayor";
  if (isAdvisorRemovedFromSale(advisor, soldAt)) return rawBranch;
  const overrideBranch = advisorBranchOverrideForSale(advisor, soldAt);
  if (overrideBranch) return overrideBranch;
  if (advisor === "ESTEFANIA YINNETH BUSTOS QUINTERO") return "Villa Mayor";
  if (ONLINE_ADVISORS.has(advisor)) return "ONLINE";
  if (soldAt && soldAt >= new Date(Date.UTC(2026, 6, 1))) {
    if (advisor === "JEFERSON RODRIGUEZ") return isVillaMayorPeriod ? "Villa Mayor" : "Calle 109";
    if (advisor === "OMAR PADILLA") return "Prado Veraniego";
  }
  return rawBranch;
}

function isAdvisorRemovedFromSale(raw: unknown, soldAt?: Date | null) {
  const name = canonicalAdvisor(raw);
  return Boolean(name && soldAt && soldAt >= ADVISOR_REMOVAL_START && ADVISORS_REMOVED_FROM_AUGUST.has(name));
}

function isRemovedAdvisor(raw: unknown) {
  const name = canonicalAdvisor(raw);
  if (!name) return false;
  const hash = crypto.createHash("sha256").update(name).digest("hex");
  return REMOVED_ADVISOR_HASHES.has(hash);
}

function hasRemovedAdvisorField(row: Record<string, unknown>) {
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeKey(key).toLowerCase();
    const looksLikeAdvisorField =
      normalizedKey.includes("asesor") ||
      normalizedKey.includes("advisor") ||
      normalizedKey.includes("vendedor") ||
      normalizedKey.includes("seller") ||
      normalizedKey.includes("empleado") ||
      normalizedKey.includes("comision") ||
      normalizedKey.includes("comercial");
    if (looksLikeAdvisorField && isRemovedAdvisor(value)) return true;
  }
  return false;
}

export async function ensureBranch(raw: unknown) {
  const branch = canonicalBranch(raw);
  await run(
    `INSERT INTO branches (code, name, display_name)
     VALUES (?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET name=excluded.name, display_name=excluded.display_name, active=1`,
    [branch.code, branch.name, branch.displayName]
  );
  const id = await scalar<number>("SELECT id FROM branches WHERE code = ?", [branch.code]);
  if (!id) throw new Error(`No se pudo crear sede ${branch.code}`);
  return id;
}

async function ensureAdvisor(raw: unknown, branchId?: number | null, soldAt?: Date | null) {
  const name = canonicalAdvisor(raw);
  if (!name) return null;
  if (isRemovedAdvisor(name)) return null;
  const excluded = EXCLUDED_ADVISORS.has(name) ? 1 : 0;
  const inactive = isAdvisorRemovedFromSale(name, soldAt) ? 1 : 0;
  await run(
    `INSERT INTO advisors (name, normalized_name, branch_id, active, excluded_from_commissions, inactive_since, inactive_reason, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(normalized_name) DO UPDATE SET
       name=excluded.name,
       branch_id=COALESCE(excluded.branch_id, advisors.branch_id),
       excluded_from_commissions=excluded.excluded_from_commissions,
       active=CASE WHEN excluded.active = 0 THEN 0 ELSE advisors.active END,
       inactive_since=CASE WHEN excluded.active = 0 THEN COALESCE(advisors.inactive_since, excluded.inactive_since) ELSE advisors.inactive_since END,
       inactive_reason=CASE WHEN excluded.active = 0 THEN COALESCE(NULLIF(advisors.inactive_reason, ''), excluded.inactive_reason) ELSE advisors.inactive_reason END,
       updated_at=CURRENT_TIMESTAMP`,
    [
      name,
      name,
      branchId ?? null,
      inactive ? 0 : 1,
      excluded,
      inactive ? "2026-08-01" : null,
      inactive ? "Detectado como inactivo por regla historica" : ""
    ]
  );
  return scalar<number>("SELECT id FROM advisors WHERE normalized_name = ?", [name]);
}

async function advisorIsInactive(raw: unknown) {
  const name = canonicalAdvisor(raw);
  if (!name) return false;
  const active = await scalar<number>("SELECT active FROM advisors WHERE normalized_name = ?", [name]);
  return active !== null && Number(active) !== 1;
}

async function ensurePlan(raw: unknown, extra?: { category?: string; cash?: number; card?: number; cost?: number; source?: string }) {
  const name = normalizeKey(raw);
  if (!name) return null;
  await run(
    `INSERT INTO plans (name, category, cash_price, card_price, cost_per_month, source)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       category=COALESCE(excluded.category, plans.category),
       cash_price=COALESCE(excluded.cash_price, plans.cash_price),
       card_price=COALESCE(excluded.card_price, plans.card_price),
       cost_per_month=COALESCE(excluded.cost_per_month, plans.cost_per_month),
       source=COALESCE(excluded.source, plans.source),
       active=1`,
    [name, extra?.category ?? "Plan", extra?.cash ?? null, extra?.card ?? null, extra?.cost ?? null, extra?.source ?? null]
  );
  return scalar<number>("SELECT id FROM plans WHERE name = ?", [name]);
}

function unassignedAdvisor(raw: unknown) {
  const advisor = canonicalAdvisor(raw);
  return !advisor || EXCLUDED_ADVISORS.has(advisor);
}

function saleTurn(soldAt: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    hour: "numeric",
    hour12: false
  }).format(soldAt));
  if (hour < 12) return "manana";
  if (hour < 18) return "tarde";
  return "noche";
}

function assignmentBucketKey(input: { branchName: unknown; soldAt: Date; year: number; month: number; day: number }) {
  return [
    input.year,
    input.month,
    input.day,
    canonicalBranch(input.branchName).code,
    saleTurn(input.soldAt)
  ].join("|");
}

async function setSetting(key: string, value: unknown, secret = 0) {
  await run(
    `INSERT INTO settings (key, value, secret, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, secret=excluded.secret, updated_at=CURRENT_TIMESTAMP`,
    [key, String(value ?? ""), secret]
  );
}

export async function seedDefaults() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const exists = await scalar<string>("SELECT value FROM settings WHERE key = ?", [key]);
    if (exists === null) await setSetting(key, value, key.includes("api_key") ? 1 : 0);
  }

  const todoCount = (await scalar<number>("SELECT COUNT(*) FROM todos")) ?? 0;
  if (todoCount === 0) {
    const defaults = [
      ["Conectar API EVO real", "Alta", "Direccion", "Validar endpoint, token y forma final de respuesta."],
      ["Definir metas enero-junio 2026", "Media", "Direccion", "El Excel de comisiones trae julio-diciembre."],
      ["Revisar campañas activas julio", "Media", "Marketing", "Pasar estrategias históricas a campañas vigentes."]
    ];
    for (const [title, priority, area, notes] of defaults) {
      await run("INSERT INTO todos (title, priority, area, notes) VALUES (?, ?, ?, ?)", [title, priority, area, notes]);
    }
  }

  await purgeRemovedAdvisors();
}

export async function importSalesWorkbook(
  filePath: string,
  options?: { sourceType?: string; sourceKey?: string; replaceMonths?: boolean }
): Promise<ImportSummary> {
  const sheet = await loadSheet(filePath);
  if (!sheet.length) throw new Error("El archivo de ventas no tiene hojas");
  validateHeaderRow(sheet, SALES_HEADER_REQUIREMENTS, "ventas");
  const header = salesHeaderMap(sheet[0] ?? []);

  const sourceType = options?.sourceType ?? "excel_upload";
  const sourceKey = options?.sourceKey ?? `${path.basename(filePath)}:${fileHash(filePath)}`;
  const months = new Map<string, { year: number; month: number }>();
  const ignoreReasons: Record<string, number> = {};
  const ignore = (reason: string) => {
    ignoreReasons[reason] = (ignoreReasons[reason] ?? 0) + 1;
  };
  const rows: Array<{
    sourceRow: number;
    branchId: number;
    advisorId: number | null;
    planId: number | null;
    soldAt: Date;
    year: number;
    month: number;
    day: number;
    value: number;
    quantity: number;
    saleKey: string;
    payload: Record<string, unknown>;
  }> = [];
  const parsedRows: Array<{
    rowNumber: number;
    row: SheetRow;
    soldAt: Date;
    year: number;
    month: number;
    day: number;
    value: number;
    quantity: number;
    rawAdvisor: string;
    advisorValue: unknown;
    branchName: unknown;
  }> = [];
  const assignmentBuckets = new Map<string, Map<string, { advisor: string; sales: number; rows: number }>>();

  for (let rowNumber = 2; rowNumber <= sheet.length; rowNumber += 1) {
    const row = sheet[rowNumber - 1];
    const soldAt = toDate(salesCell(row, header, "soldAt"));
    if (!soldAt) {
      if (rowHasAnyValue(row)) ignore("fecha_venta_faltante");
      continue;
    }
    const rawAdvisor = salesText(row, header, "advisor");
    const value = salesNumber(row, header, "value");
    const advisorValue = advisorForSale({
      rawAdvisor,
      rawBranch: salesText(row, header, "branch"),
      clientName: salesText(row, header, "firstName"),
      clientLastName: salesText(row, header, "lastName"),
      planName: salesText(row, header, "description"),
      value,
      soldAt
    });
    const branchName = branchForAdvisor(salesText(row, header, "branch"), advisorValue, soldAt);
    const year = soldAt.getFullYear();
    const month = soldAt.getMonth() + 1;
    const day = soldAt.getDate();
    parsedRows.push({
      rowNumber,
      row,
      soldAt,
      year,
      month,
      day,
      value,
      quantity: salesNumber(row, header, "quantity") || 1,
      rawAdvisor,
      advisorValue,
      branchName
    });

    const advisor = canonicalAdvisor(advisorValue);
    const inactiveAdvisor = await advisorIsInactive(advisor);
    if (value > 0 && advisor && !unassignedAdvisor(advisor) && !isAdvisorRemovedFromSale(advisor, soldAt) && !inactiveAdvisor) {
      const bucketKey = assignmentBucketKey({ branchName, soldAt, year, month, day });
      const bucket = assignmentBuckets.get(bucketKey) ?? new Map<string, { advisor: string; sales: number; rows: number }>();
      const current = bucket.get(advisor) ?? { advisor, sales: 0, rows: 0 };
      current.sales += value;
      current.rows += 1;
      bucket.set(advisor, current);
      assignmentBuckets.set(bucketKey, bucket);
    }
  }

  let advisorReassignments = 0;
  for (const parsed of parsedRows) {
    const bucketKey = assignmentBucketKey({
      branchName: parsed.branchName,
      soldAt: parsed.soldAt,
      year: parsed.year,
      month: parsed.month,
      day: parsed.day
    });
    const topAdvisor = [...(assignmentBuckets.get(bucketKey)?.values() ?? [])]
      .sort((a, b) => b.sales - a.sales || b.rows - a.rows || a.advisor.localeCompare(b.advisor))[0]?.advisor;
    const shouldReassign = parsed.value > 0 && unassignedAdvisor(parsed.advisorValue) && topAdvisor;
    const assignedAdvisor = shouldReassign ? topAdvisor : parsed.advisorValue;
    const branchId = await ensureBranch(branchForAdvisor(salesText(parsed.row, header, "branch"), assignedAdvisor, parsed.soldAt));
    const advisorId = await ensureAdvisor(assignedAdvisor, branchId, parsed.soldAt);
    const planId = await ensurePlan(salesText(parsed.row, header, "description"), { source: "Ventas" });
    const payload = {
      sede: salesText(parsed.row, header, "branch"),
      tipo: salesText(parsed.row, header, "type"),
      id: salesText(parsed.row, header, "id"),
      idVenta: salesText(parsed.row, header, "saleId"),
      nombre: salesText(parsed.row, header, "firstName"),
      apellido: salesText(parsed.row, header, "lastName"),
      item: salesText(parsed.row, header, "item"),
      descripcion: salesText(parsed.row, header, "description"),
      inicio: salesCell(parsed.row, header, "startedAt"),
      metodoPago: salesText(parsed.row, header, "paymentMethod"),
      asesor: parsed.rawAdvisor,
      asesor_asignado: shouldReassign ? topAdvisor : canonicalAdvisor(assignedAdvisor),
      turno_asignacion: saleTurn(parsed.soldAt),
      ajuste_asesor: shouldReassign ? "Reasignado por regla: mayor venta de la sede en el dia y turno" : "",
      origen: salesText(parsed.row, header, "origin")
    };
    if (shouldReassign) advisorReassignments += 1;
    months.set(`${parsed.year}-${parsed.month}`, { year: parsed.year, month: parsed.month });
    rows.push({
      sourceRow: parsed.rowNumber,
      branchId,
      advisorId,
      planId,
      soldAt: parsed.soldAt,
      year: parsed.year,
      month: parsed.month,
      day: parsed.day,
      value: parsed.value,
      quantity: parsed.quantity,
      saleKey: saleKey({
        branchId,
        advisorId,
        planId,
        clientExternalId: payload.id,
        description: payload.descripcion,
        soldAt: parsed.soldAt,
        value: parsed.value,
        quantity: parsed.quantity
      }),
      payload
    });
  }

  let inserted = 0;
  let duplicatesSkipped = 0;
  let total = 0;
  const rowsIgnored = Object.values(ignoreReasons).reduce((sum, value) => sum + value, 0);
  for (const row of rows) {
    await run(
      `INSERT OR IGNORE INTO sales (
        source_type, source_key, sale_key, source_file, source_row, branch_id, advisor_id, plan_id,
        client_external_id, client_name, client_last_name, item_type, description, started_at,
        quantity, value, sold_at, year, month, day, payment_method, origin, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sourceType,
        sourceKey,
        row.saleKey,
        path.basename(filePath),
        row.sourceRow,
        row.branchId,
        row.advisorId,
        row.planId,
        String(row.payload.id ?? ""),
        String(row.payload.nombre ?? ""),
        String(row.payload.apellido ?? ""),
        String(row.payload.item ?? ""),
        String(row.payload.descripcion ?? ""),
        toDate(row.payload.inicio as CellValue)?.toISOString() ?? null,
        row.quantity,
        row.value,
        row.soldAt.toISOString(),
        row.year,
        row.month,
        row.day,
        String(row.payload.metodoPago ?? ""),
        String(row.payload.origen ?? ""),
        JSON.stringify(row.payload)
      ]
    );
    const changed = (await scalar<number>("SELECT changes()")) ?? 0;
    if (changed) {
      inserted += 1;
      total += row.value;
    } else {
      duplicatesSkipped += 1;
    }
  }

  await run(
    `INSERT INTO import_batches (source_type, source_key, source_file, rows_read, rows_inserted, duplicates_skipped, total_value, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sourceType,
      sourceKey,
      path.basename(filePath),
      Math.max(sheet.length - 1, 0),
      inserted,
      duplicatesSkipped,
      total,
      JSON.stringify({ months: [...months.values()], importMode: "append_dedupe", advisorReassignments, rowsIgnored, ignoreReasons })
    ]
  );

  await purgeRemovedAdvisors();

  return {
    sourceType,
    sourceKey,
    sourceFile: path.basename(filePath),
    rowsRead: Math.max(sheet.length - 1, 0),
    rowsInserted: inserted,
    duplicatesSkipped,
    rowsIgnored,
    ignoreReasons,
    totalValue: total,
    months: [...months.values()]
  };
}

export async function importMemberEvolutionWorkbook(
  filePath: string,
  options?: { year?: number; month?: number; day?: number; sourceType?: string; sourceKey?: string }
): Promise<ImportSummary> {
  const sheet = await loadSheet(filePath);
  if (!sheet.length) throw new Error("El archivo de evolucion no tiene hojas");
  validateHeaderRow(sheet, EVOLUTION_HEADER_REQUIREMENTS, "evolucion de miembros");
  const period = periodFromEvolutionFile(filePath, options);
  const cutoff = cutoffFromEvolutionFile(filePath, period, options);
  const header = evolutionHeaderMap(sheet[0] ?? []);
  const sourceType = options?.sourceType ?? "member_evolution_upload";
  const sourceKey = options?.sourceKey ?? `${path.basename(filePath)}:${fileHash(filePath)}`;
  let inserted = 0;
  let totalActiveEnd = 0;
  let rowsRead = 0;

  for (let rowNumber = 2; rowNumber <= sheet.length; rowNumber += 1) {
    const row = sheet[rowNumber - 1];
    const branchName = cleanDisplay(evolutionCell(row, header, "Sede/club"));
    if (!branchName) continue;
    rowsRead += 1;
    const branchId = await ensureBranch(branchName.replace(/^\d+\s*-\s*/, ""));
    const activeStart = number([evolutionCell(row, header, "Activo inicio")], 1);
    const newMembers = number([evolutionCell(row, header, "Nuevos")], 1);
    const renewed = number([evolutionCell(row, header, "Renovados")], 1);
    const reinscriptions = number([evolutionCell(row, header, "Reinscripciones")], 1);
    const returnedFromSuspension = number([evolutionCell(row, header, "Regresos de las suspensiones")], 1);
    const totalEntries = number([evolutionCell(row, header, "Total de entradas")], 1);
    const cancellations = number([evolutionCell(row, header, "Bajas")], 1);
    const expired = number([evolutionCell(row, header, "Vencidos")], 1);
    const notRenewed = number([evolutionCell(row, header, "No renovados")], 1);
    const suspended = number([evolutionCell(row, header, "Suspendidos")], 1);
    const totalExits = number([evolutionCell(row, header, "Resultados totales")], 1);
    const activeEnd = number([evolutionCell(row, header, "Activos fin")], 1);
    const expectedActiveEnd = activeStart + totalEntries - totalExits;
    if (expectedActiveEnd !== activeEnd) {
      throw new Error(
        `Evolucion inconsistente en ${branchName}: Activo inicio (${activeStart}) + entradas (${totalEntries}) - salidas (${totalExits}) = ${expectedActiveEnd}, pero Activos fin es ${activeEnd}`
      );
    }
    const netEvolution = activeEnd - activeStart;
    const netEvolutionRate = activeStart > 0 ? netEvolution / activeStart : 0;
    await run(
      `INSERT INTO member_evolution (
        year, month, day, cutoff_date, branch_id, active_start, new_members, renewed, reinscriptions,
        returned_from_suspension, total_entries, cancellations, expired, not_renewed,
        suspended, total_exits, active_end, net_evolution, net_evolution_rate,
        source_file, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(year, month, day, branch_id) DO UPDATE SET
        cutoff_date=excluded.cutoff_date,
        active_start=excluded.active_start,
        new_members=excluded.new_members,
        renewed=excluded.renewed,
        reinscriptions=excluded.reinscriptions,
        returned_from_suspension=excluded.returned_from_suspension,
        total_entries=excluded.total_entries,
        cancellations=excluded.cancellations,
        expired=excluded.expired,
        not_renewed=excluded.not_renewed,
        suspended=excluded.suspended,
        total_exits=excluded.total_exits,
        active_end=excluded.active_end,
        net_evolution=excluded.net_evolution,
        net_evolution_rate=excluded.net_evolution_rate,
        source_file=excluded.source_file,
        updated_at=CURRENT_TIMESTAMP`,
      [
        period.year,
        period.month,
        cutoff.day,
        cutoff.cutoffDate,
        branchId,
        activeStart,
        newMembers,
        renewed,
        reinscriptions,
        returnedFromSuspension,
        totalEntries,
        cancellations,
        expired,
        notRenewed,
        suspended,
        totalExits,
        activeEnd,
        netEvolution,
        netEvolutionRate,
        path.basename(filePath)
      ]
    );
    inserted += 1;
    totalActiveEnd += activeEnd;
  }

  await run(
    `INSERT INTO import_batches (source_type, source_key, source_file, rows_read, rows_inserted, duplicates_skipped, total_value, details)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      sourceType,
      sourceKey,
      path.basename(filePath),
      rowsRead,
      inserted,
      totalActiveEnd,
      JSON.stringify({ months: [{ ...period, day: cutoff.day, cutoffDate: cutoff.cutoffDate }], importMode: "member_evolution_daily_upsert" })
    ]
  );

  return {
    sourceType,
    sourceKey,
    sourceFile: path.basename(filePath),
    rowsRead,
    rowsInserted: inserted,
    duplicatesSkipped: 0,
    totalValue: totalActiveEnd,
    months: [{ ...period, day: cutoff.day, cutoffDate: cutoff.cutoffDate }]
  };
}

function pickObjectValue(row: Record<string, unknown>, candidates: string[]): unknown {
  const indexed = new Map(Object.keys(row).map((key) => [normalizeKey(key), key]));
  for (const candidate of candidates) {
    const key = indexed.get(normalizeKey(candidate));
    if (key) return row[key];
  }
  for (const value of Object.values(row)) {
    if (!value || typeof value !== "object" || value instanceof Date || Array.isArray(value)) continue;
    const nested: unknown = pickObjectValue(value as Record<string, unknown>, candidates);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function objectNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function importSalesObjects(
  items: Record<string, unknown>[],
  options?: { sourceType?: string; sourceKey?: string; replaceMonths?: boolean; sourceFile?: string }
): Promise<ImportSummary> {
  const sourceType = options?.sourceType ?? "evo";
  const sourceKey = options?.sourceKey ?? `evo:${new Date().toISOString()}`;
  const sourceFile = options?.sourceFile ?? "api-evo";
  const months = new Map<string, { year: number; month: number }>();
  const prepared: Array<{
    sourceRow: number;
    branchId: number;
    advisorId: number | null;
    planId: number | null;
    soldAt: Date;
    year: number;
    month: number;
    day: number;
    value: number;
    quantity: number;
    saleKey: string;
    payload: Record<string, unknown>;
  }> = [];
  const dateFields = ["Fecha de venta", "fecha_venta", "sold_at", "created_at", "fecha", "dateSale", "saleDate", "registrationDate", "dtSale", "dataVenda", "data", "createdDate"];
  const advisorFields = ["Empleado comision", "Empleado comisión", "asesor", "advisor", "vendedor", "seller", "comercial", "employeeName", "salespersonName", "sellerName", "consultantName", "consultant", "employee", "funcionario", "userName"];
  const branchFields = ["Sede/club", "sede", "club", "branch", "branchName", "nameBranch", "unitName", "gymName", "unidade", "filial"];
  const planFields = ["Descripcion", "Descripción", "description", "descricao", "plan", "producto", "product", "item", "membershipName", "serviceName", "productName", "itemName", "nomePlano"];
  const valueFields = ["Valor", "value", "total", "amount", "precio", "saleValue", "totalValue", "valor", "valorVenda", "price"];
  const quantityFields = ["Cantidad", "quantity", "qty", "quantidade", "amountItems"];
  const clientIdFields = ["ID", "client_id", "cliente_id", "memberId", "idMember", "idCliente", "idPessoa"];
  const clientNameFields = ["Nombre", "client_name", "nombre", "memberName", "customerName", "nomeCliente", "nome"];
  const clientLastNameFields = ["Apellido", "client_last_name", "apellido", "lastName", "surname"];
  const itemTypeFields = ["Item", "Ítem", "tipo", "type", "itemType", "tipoItem"];
  const ignoreReasons: Record<string, number> = {};
  const ignore = (reason: string) => {
    ignoreReasons[reason] = (ignoreReasons[reason] ?? 0) + 1;
  };

  for (const [index, item] of items.entries()) {
    const soldAt = toDate(pickObjectValue(item, dateFields) as CellValue);
    if (!soldAt) {
      ignore("missing_date");
      continue;
    }
    if (isRemovedAdvisor(pickObjectValue(item, advisorFields)) || hasRemovedAdvisorField(item)) {
      ignore("removed_advisor");
      continue;
    }
    const planId = await ensurePlan(pickObjectValue(item, planFields), {
      source: "EVO"
    });
    const value = objectNumber(pickObjectValue(item, valueFields));
    if (sourceType === "evo" && value <= 0) {
      ignore("non_positive_value");
      continue;
    }
    const advisorValue = advisorForSale({
      rawAdvisor: pickObjectValue(item, advisorFields),
      rawBranch: pickObjectValue(item, branchFields),
      clientName: pickObjectValue(item, clientNameFields),
      clientLastName: pickObjectValue(item, clientLastNameFields),
      planName: pickObjectValue(item, planFields),
      value,
      soldAt
    });
    const branchId = await ensureBranch(branchForAdvisor(pickObjectValue(item, branchFields), advisorValue, soldAt));
    const advisorId = await ensureAdvisor(advisorValue, branchId, soldAt);
    const quantity = objectNumber(pickObjectValue(item, quantityFields)) || 1;
    const year = soldAt.getFullYear();
    const month = soldAt.getMonth() + 1;
    const day = soldAt.getDate();
    months.set(`${year}-${month}`, { year, month });
    prepared.push({
      sourceRow: index + 1,
      branchId,
      advisorId,
      planId,
      soldAt,
      year,
      month,
      day,
      value,
      quantity,
      saleKey: saleKey({
        branchId,
        advisorId,
        planId,
        clientExternalId: String(pickObjectValue(item, clientIdFields) ?? ""),
        description: String(pickObjectValue(item, planFields) ?? ""),
        soldAt,
        value,
        quantity
      }),
      payload: item
    });
  }

  let inserted = 0;
  let duplicatesSkipped = 0;
  let total = 0;
  const rowsIgnored = Object.values(ignoreReasons).reduce((sum, value) => sum + value, 0);
  for (const row of prepared) {
    await run(
      `INSERT OR IGNORE INTO sales (
        source_type, source_key, sale_key, source_file, source_row, branch_id, advisor_id, plan_id,
        client_external_id, client_name, client_last_name, item_type, description, started_at,
        quantity, value, sold_at, year, month, day, payment_method, origin, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sourceType,
        sourceKey,
        row.saleKey,
        sourceFile,
        row.sourceRow,
        row.branchId,
        row.advisorId,
        row.planId,
        String(pickObjectValue(row.payload, clientIdFields) ?? ""),
        String(pickObjectValue(row.payload, clientNameFields) ?? ""),
        String(pickObjectValue(row.payload, clientLastNameFields) ?? ""),
        String(pickObjectValue(row.payload, itemTypeFields) ?? ""),
        String(pickObjectValue(row.payload, planFields) ?? ""),
        null,
        row.quantity,
        row.value,
        row.soldAt.toISOString(),
        row.year,
        row.month,
        row.day,
        String(pickObjectValue(row.payload, ["Metodo de pago", "Método de pago", "payment_method"]) ?? ""),
        String(pickObjectValue(row.payload, ["Origen", "origin", "source"]) ?? "EVO"),
        JSON.stringify(row.payload)
      ]
    );
    const changed = (await scalar<number>("SELECT changes()")) ?? 0;
    if (changed) {
      inserted += 1;
      total += row.value;
    } else {
      duplicatesSkipped += 1;
    }
  }

  await run(
    `INSERT INTO import_batches (source_type, source_key, source_file, rows_read, rows_inserted, duplicates_skipped, total_value, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sourceType,
      sourceKey,
      sourceFile,
      items.length,
      inserted,
      duplicatesSkipped,
      total,
      JSON.stringify({ months: [...months.values()], importMode: "append_dedupe", rowsIgnored, ignoreReasons })
    ]
  );

  await purgeRemovedAdvisors();

  return {
    sourceType,
    sourceKey,
    sourceFile,
    rowsRead: items.length,
    rowsInserted: inserted,
    duplicatesSkipped,
    rowsIgnored,
    ignoreReasons,
    totalValue: total,
    months: [...months.values()]
  };
}

export async function importCommissionWorkbook(filePath: string) {
  const targets = await loadOptionalSheet(filePath, "Metas 2026");
  const monthlySales = await loadOptionalSheet(filePath, "Ventas Mensuales");
  const schema = await loadOptionalSheet(filePath, "Esquema Comisiones");
  const assumptions = await loadOptionalSheet(filePath, "Supuestos");
  if (!targets || !monthlySales || !schema || !assumptions) {
    throw new Error("El libro de comisiones no tiene las hojas esperadas");
  }

  await setSetting("selected_year", 2026);
  await setSetting("selected_month", 6);
  for (let rowNumber = 6; rowNumber <= assumptions.length; rowNumber += 1) {
    const row = assumptions[rowNumber - 1];
    const label = normalizeKey(cell(row, 1));
    if (label === "META CONVERSIONES ASESOR") await setSetting("monthly_conversion_goal_per_advisor", number(row, 2));
    if (label === "MAX DESCUENTO ACEPTABLE") await setSetting("max_discount_rate", number(row, 2));
    if (label === "SCORE ALTO") await setSetting("score_high", number(row, 2));
    if (label === "SCORE MEDIO") await setSetting("score_medium", number(row, 2));
  }

  for (let rowNumber = 6; rowNumber <= targets.length; rowNumber += 1) {
    const row = targets[rowNumber - 1];
    const year = number(row, 1);
    const month = monthNumber(text(row, 2));
    const branchName = text(row, 4);
    if (!year || !month || !branchName) continue;
    const branchId = await ensureBranch(branchName);
    const branchMeta1 = number(row, 12);
    const officialTargets = officialIntegratedReportTargets2026(branchName, month);
    const targetsForPeriod = officialTargets ?? (await motivationalTargets({
      branchId,
      year,
      month,
      officialAdvisorMeta1: number(row, 8),
      branchMeta1
    }));
    await run(
      `INSERT INTO monthly_targets (
        year, month, branch_id, growth_rate,
        advisor_activation, advisor_bronze, advisor_silver, advisor_meta1, advisor_meta2, advisor_meta3, advisor_meta4,
        advisor_daily_meta4, advisor_weekly_meta4,
        branch_activation, branch_bronze, branch_silver, branch_meta1, branch_meta2, branch_meta3, branch_meta4,
        branch_daily_meta4, branch_weekly_meta4, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(year, month, branch_id) DO UPDATE SET
        growth_rate=excluded.growth_rate,
        advisor_activation=excluded.advisor_activation,
        advisor_bronze=excluded.advisor_bronze,
        advisor_silver=excluded.advisor_silver,
        advisor_meta1=excluded.advisor_meta1,
        advisor_meta2=excluded.advisor_meta2,
        advisor_meta3=excluded.advisor_meta3,
        advisor_meta4=excluded.advisor_meta4,
        advisor_daily_meta4=excluded.advisor_daily_meta4,
        advisor_weekly_meta4=excluded.advisor_weekly_meta4,
        branch_activation=excluded.branch_activation,
        branch_bronze=excluded.branch_bronze,
        branch_silver=excluded.branch_silver,
        branch_meta1=excluded.branch_meta1,
        branch_meta2=excluded.branch_meta2,
        branch_meta3=excluded.branch_meta3,
        branch_meta4=excluded.branch_meta4,
        branch_daily_meta4=excluded.branch_daily_meta4,
        branch_weekly_meta4=excluded.branch_weekly_meta4,
        source=excluded.source`,
      [
        year,
        month,
        branchId,
        number(row, 20),
        targetsForPeriod.advisor.activation,
        targetsForPeriod.advisor.bronze,
        targetsForPeriod.advisor.silver,
        targetsForPeriod.advisor.meta1,
        targetsForPeriod.advisor.meta2,
        targetsForPeriod.advisor.meta3,
        targetsForPeriod.advisor.meta4,
        targetsForPeriod.advisor.dailyMeta4,
        targetsForPeriod.advisor.weeklyMeta4,
        targetsForPeriod.branch.activation,
        targetsForPeriod.branch.bronze,
        targetsForPeriod.branch.silver,
        targetsForPeriod.branch.meta1,
        targetsForPeriod.branch.meta2,
        targetsForPeriod.branch.meta3,
        targetsForPeriod.branch.meta4,
        targetsForPeriod.branch.dailyMeta4,
        targetsForPeriod.branch.weeklyMeta4,
        path.basename(filePath)
      ]
    );
  }

  for (let rowNumber = 6; rowNumber <= monthlySales.length; rowNumber += 1) {
    const row = monthlySales[rowNumber - 1];
    const year = number(row, 1);
    const month = monthNumber(text(row, 2));
    const branchName = text(row, 3);
    const advisorName = text(row, 4);
    if (!year || !month || !branchName || !advisorName) continue;
    if (isRemovedAdvisor(advisorName)) continue;
    const branchId = await ensureBranch(branchForAdvisor(branchName, advisorName));
    const advisorId = await ensureAdvisor(advisorName, branchId);
    if (!advisorId) continue;
    await run(
      `INSERT INTO advisor_evaluations (
        year, month, advisor_id, quality_rating, admin_rating, quality_score, admin_score,
        quality_multiplier, admin_multiplier, observations, include_in_score
      ) VALUES (?, ?, ?, '', '', 0, 0, 1, 1, '', 1)
      ON CONFLICT(year, month, advisor_id) DO NOTHING`,
      [year, month, advisorId]
    );
  }

  for (let rowNumber = 6; rowNumber <= 12; rowNumber += 1) {
    const row = schema[rowNumber - 1];
    const level = text(row, 1);
    if (!level) continue;
    const normalizedLevel = normalizeKey(level);
    const conditionText =
      normalizedLevel === "BRONCE"
        ? "75% de Meta 1 asesor"
        : normalizedLevel === "PLATA"
          ? "90% de Meta 1 asesor"
          : text(row, 2);
    await run(
      `INSERT INTO commission_tiers (level, condition_text, description, percentage, fixed_bonus, objective, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(level) DO UPDATE SET
        condition_text=excluded.condition_text,
        description=excluded.description,
        percentage=excluded.percentage,
        fixed_bonus=excluded.fixed_bonus,
        objective=excluded.objective,
        sort_order=excluded.sort_order`,
      [level, conditionText, text(row, 3), number(row, 4), number(row, 5), text(row, 6), rowNumber - 5]
    );
  }

  for (let rowNumber = 15; rowNumber <= schema.length; rowNumber += 1) {
    const row = schema[rowNumber - 1];
    const level = text(row, 1);
    if (!level || normalizeKey(level) === "NIVEL DIRECTOR") continue;
    await run(
      `INSERT INTO director_commission_tiers (level, condition_text, fixed_bonus, sort_order)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(level) DO UPDATE SET condition_text=excluded.condition_text, fixed_bonus=excluded.fixed_bonus, sort_order=excluded.sort_order`,
      [level, text(row, 2), number(row, 3), rowNumber]
    );
  }

  const officialDirectorTiers = [
    { level: "Meta 1", condition: "La sede alcanza Meta 1", bonus: 100000 },
    { level: "Meta 2", condition: "La sede alcanza Meta 2", bonus: 200000 },
    { level: "Meta 3", condition: "La sede alcanza Meta 3 o superior", bonus: 500000 }
  ];
  await run("DELETE FROM director_commission_tiers WHERE level IN ('META 1', 'META 2', 'META 3', 'META 4', 'Meta 4')");
  for (const [index, tier] of officialDirectorTiers.entries()) {
    await run(
      `INSERT INTO director_commission_tiers (level, condition_text, fixed_bonus, sort_order)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(level) DO UPDATE SET condition_text=excluded.condition_text, fixed_bonus=excluded.fixed_bonus, sort_order=excluded.sort_order`,
      [tier.level, tier.condition, tier.bonus, index + 1]
    );
  }
}

export async function importPricingWorkbook(filePath: string) {
  const prices = await loadOptionalSheet(filePath, "PRECIOS");
  const strategies = await loadOptionalSheet(filePath, "ESTRATEGIAS");
  const presales = await loadOptionalSheet(filePath, "PLANES PREVENTAS");
  const annualTargets = await loadOptionalSheet(filePath, "META 2026") ?? await loadOptionalSheet(filePath, "Hoja 1");

  if (annualTargets) {
    await importAnnualTargetsFromPricing(filePath, annualTargets);
  }

  if (prices) {
    for (let rowNumber = 4; rowNumber <= prices.length; rowNumber += 1) {
      const row = prices[rowNumber - 1];
      if (text(row, 2)) {
        await ensurePlan(text(row, 2), {
          cash: number(row, 5),
          card: number(row, 7),
          cost: number(row, 6),
          source: "PRECIOS"
        });
      }
      if (text(row, 9)) {
        await ensurePlan(text(row, 9), {
          category: "Acceso",
          cash: number(row, 12),
          card: number(row, 13),
          source: "PRECIOS"
        });
      }
    }
  }

  if (presales) {
    let currentGroup = "";
    for (let rowNumber = 3; rowNumber <= presales.length; rowNumber += 1) {
      const row = presales[rowNumber - 1];
      if (text(row, 3).startsWith("PREVENTA")) {
        currentGroup = text(row, 3);
        continue;
      }
      if (text(row, 3) && normalizeKey(text(row, 3)) !== "PLAN") {
        await ensurePlan(`${text(row, 3)} ${currentGroup}`, {
          category: "Preventa",
          cash: number(row, 5),
          cost: number(row, 6),
          source: "PLANES PREVENTAS"
        });
      }
    }
  }

  if (strategies) {
    const existing = await scalar<number>("SELECT COUNT(*) FROM initiatives WHERE area='Marketing' AND type='Campana'");
    if ((existing ?? 0) === 0) {
      for (let rowNumber = 2; rowNumber <= strategies.length; rowNumber += 1) {
        const row = strategies[rowNumber - 1];
        const plan = text(row, 2);
        const strategy = text(row, 10);
        if (!plan || !strategy) continue;
        await run(
          `INSERT INTO initiatives (area, type, title, status, channel, budget, expected_impact, start_date, end_date, notes)
           VALUES ('Marketing', 'Campana', ?, 'Backlog', 'Recepcion / Digital', ?, ?, ?, ?, ?)`,
          [
            `${plan} - ${strategy.slice(0, 80)}`,
            Math.max(number(row, 3) - number(row, 4), 0),
            `Descuento ${number(row, 5).toLocaleString("es-CO")}`,
            text(row, 7),
            text(row, 8),
            JSON.stringify({
              precioAntes: number(row, 3),
              precioAhora: number(row, 4),
              costoMes: number(row, 6),
              adicionales: text(row, 9),
              estrategia: strategy
            })
          ]
        );
      }
    }
  }
}

function monthFromTitle(title: string) {
  const key = normalizeKey(title);
  for (const name of ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"]) {
    if (key.includes(name)) return monthNumber(name);
  }
  return 0;
}

function metaByHeader(row: SheetRow, header: SheetRow, fromCol: number, toCol: number, label: string) {
  const expected = normalizeKey(label).replace(/\s/g, "");
  for (let col = fromCol; col <= toCol; col += 1) {
    const current = normalizeKey(header[col - 1]).replace(/\s/g, "");
    if (current === expected) return objectNumber(row[col - 1]);
  }
  return 0;
}

function roundTarget(value: number) {
  return Math.round(Number(value || 0) / 1000) * 1000;
}

function priorPeriod(year: number, month: number) {
  if (year === 2026 && month >= 7) return { year: 2026, month: 6 };
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

async function productiveAdvisorSales(branchId: number, year: number, month: number) {
  const previous = priorPeriod(year, month);
  const rows = await all<{ sales: number }>(
    `SELECT COALESCE(SUM(s.value), 0) sales
     FROM sales s
     JOIN advisors a ON a.id = s.advisor_id
     WHERE s.branch_id = ?
       AND s.year = ?
       AND s.month = ?
       AND a.active = 1
       AND a.excluded_from_commissions = 0
     GROUP BY s.advisor_id
     HAVING sales >= 10000000
     ORDER BY sales DESC`,
    [branchId, previous.year, previous.month]
  );
  return rows.map((row) => Number(row.sales || 0)).filter((value) => value > 0);
}

async function recentBranchSales(branchId: number, year: number, month: number) {
  const previous = priorPeriod(year, month);
  const beforePrevious = previous.month === 1 ? { year: previous.year - 1, month: 12 } : { year: previous.year, month: previous.month - 1 };
  const rows = await all<{ month: number; sales: number }>(
    `SELECT month, COALESCE(SUM(value), 0) sales
     FROM sales
     WHERE branch_id = ?
       AND ((year = ? AND month = ?) OR (year = ? AND month = ?))
     GROUP BY month`,
    [branchId, previous.year, previous.month, beforePrevious.year, beforePrevious.month]
  );
  return rows.map((row) => Number(row.sales || 0)).filter((value) => value > 0);
}

async function motivationalTargets(input: {
  branchId: number;
  year: number;
  month: number;
  officialAdvisorMeta1: number;
  branchMeta1: number;
}) {
  const days = new Date(input.year, input.month, 0).getDate();
  const advisorHistory = await productiveAdvisorSales(input.branchId, input.year, input.month);
  const branchHistory = await recentBranchSales(input.branchId, input.year, input.month);
  let advisorMeta1 = input.officialAdvisorMeta1 || input.branchMeta1 / 2;
  let branchMeta1 = input.branchMeta1;

  if (advisorHistory.length) {
    const average = advisorHistory.reduce((sum, value) => sum + value, 0) / advisorHistory.length;
    const best = Math.max(...advisorHistory);
    const historicalBase = average * 1.1;
    const historicalFloor = best * 0.9;
    const historicalCap = best * 1.15;
    advisorMeta1 = Math.min(Math.max(historicalBase, historicalFloor), historicalCap);
  }

  if (branchHistory.length) {
    const average = branchHistory.reduce((sum, value) => sum + value, 0) / branchHistory.length;
    const previous = branchHistory[branchHistory.length - 1];
    const historicalBase = average * 1.08;
    const historicalFloor = previous * 0.9;
    branchMeta1 = Math.max(historicalBase, historicalFloor);
  }

  advisorMeta1 = roundTarget(advisorMeta1);
  const advisorMeta2 = roundTarget(advisorMeta1 * 1.1);
  const advisorMeta3 = roundTarget(advisorMeta1 * 1.2);
  const advisorMeta4 = roundTarget(advisorMeta1 * 1.3);
  branchMeta1 = roundTarget(branchMeta1);
  const branchMeta2 = roundTarget(branchMeta1 * 1.1);
  const branchMeta3 = roundTarget(branchMeta1 * 1.2);
  const branchMeta4 = roundTarget(branchMeta1 * 1.3);

  return {
    advisor: {
      activation: roundTarget(advisorMeta1 * 0.6),
      bronze: roundTarget(advisorMeta1 * 0.75),
      silver: roundTarget(advisorMeta1 * 0.9),
      meta1: advisorMeta1,
      meta2: advisorMeta2,
      meta3: advisorMeta3,
      meta4: advisorMeta4,
      dailyMeta4: advisorMeta4 / days,
      weeklyMeta4: advisorMeta4 / 4.345
    },
    branch: {
      activation: roundTarget(branchMeta1 * 0.6),
      bronze: roundTarget(branchMeta1 * 0.75),
      silver: roundTarget(branchMeta1 * 0.9),
      meta1: branchMeta1,
      meta2: branchMeta2,
      meta3: branchMeta3,
      meta4: branchMeta4,
      dailyMeta4: branchMeta4 / days,
      weeklyMeta4: branchMeta4 / 4.345
    }
  };
}
async function importAnnualTargetsFromPricing(filePath: string, rows: SheetRow[]) {
  for (let index = 0; index < rows.length; index += 1) {
    const title = text(rows[index], 2);
    if (!normalizeKey(title).startsWith("META SEDES")) continue;
    const month = monthFromTitle(title);
    const year = 2026;
    const headerIndex = [index + 1, index + 2, index + 3].find((candidate) => {
      const row = rows[candidate] ?? [];
      return normalizeKey(row[1]) === "PUESTO" && normalizeKey(row[2]) === "SEDE";
    });
    const header = headerIndex === undefined ? rows[index + 1] ?? [] : rows[headerIndex] ?? [];
    if (!month) continue;

    for (let rowIndex = (headerIndex ?? index + 1) + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const position = objectNumber(row[1]);
      const branchName = cleanDisplay(row[2]);
      if (!position || !branchName || normalizeKey(branchName).includes("TOTAL")) break;
      const branchId = await ensureBranch(branchName);
      const branchMeta1 = metaByHeader(row, header, 5, 8, "META 1");
      const branchMeta2 = metaByHeader(row, header, 5, 8, "META 2");
      const branchMeta3 = metaByHeader(row, header, 5, 8, "META 3");
      const branchMeta4 = metaByHeader(row, header, 5, 8, "META 4");
      const advisorMeta1 = metaByHeader(row, header, 12, 15, "META 1");
      const advisorMeta2 = metaByHeader(row, header, 12, 15, "META 2");
      const advisorMeta3 = metaByHeader(row, header, 12, 15, "META 3");
      const advisorMeta4 = metaByHeader(row, header, 12, 15, "META 4");
      const days = new Date(year, month, 0).getDate();
      const advisorTarget = {
        activation: advisorMeta1 * 0.6,
        bronze: advisorMeta1 * 0.75,
        silver: advisorMeta1 * 0.9,
        meta1: advisorMeta1,
        meta2: advisorMeta2,
        meta3: advisorMeta3,
        meta4: advisorMeta4,
        dailyMeta4: advisorMeta4 / days,
        weeklyMeta4: advisorMeta4 / 4.345
      };
      await run(
        `INSERT INTO monthly_targets (
          year, month, branch_id, growth_rate,
          advisor_activation, advisor_bronze, advisor_silver, advisor_meta1, advisor_meta2, advisor_meta3, advisor_meta4,
          advisor_daily_meta4, advisor_weekly_meta4,
          branch_activation, branch_bronze, branch_silver, branch_meta1, branch_meta2, branch_meta3, branch_meta4,
          branch_daily_meta4, branch_weekly_meta4, source
        ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(year, month, branch_id) DO UPDATE SET
          advisor_activation=excluded.advisor_activation,
          advisor_bronze=excluded.advisor_bronze,
          advisor_silver=excluded.advisor_silver,
          advisor_meta1=excluded.advisor_meta1,
          advisor_meta2=excluded.advisor_meta2,
          advisor_meta3=excluded.advisor_meta3,
          advisor_meta4=excluded.advisor_meta4,
          advisor_daily_meta4=excluded.advisor_daily_meta4,
          advisor_weekly_meta4=excluded.advisor_weekly_meta4,
          branch_activation=excluded.branch_activation,
          branch_bronze=excluded.branch_bronze,
          branch_silver=excluded.branch_silver,
          branch_meta1=excluded.branch_meta1,
          branch_meta2=excluded.branch_meta2,
          branch_meta3=excluded.branch_meta3,
          branch_meta4=excluded.branch_meta4,
          branch_daily_meta4=excluded.branch_daily_meta4,
          branch_weekly_meta4=excluded.branch_weekly_meta4,
          source=excluded.source`,
        [
          year,
          month,
          branchId,
          advisorTarget.activation,
          advisorTarget.bronze,
          advisorTarget.silver,
          advisorTarget.meta1,
          advisorTarget.meta2,
          advisorTarget.meta3,
          advisorTarget.meta4,
          advisorTarget.dailyMeta4,
          advisorTarget.weeklyMeta4,
          branchMeta1 * 0.6,
          branchMeta1 * 0.75,
          branchMeta1 * 0.9,
          branchMeta1,
          branchMeta2,
          branchMeta3,
          branchMeta4,
          branchMeta4 / days,
          branchMeta4 / 4.345,
          path.basename(filePath)
        ]
      );
    }
  }
}

export async function seedFromWorkbooks(paths: SeedPaths) {
  await transaction(async () => {
    await seedDefaults();
    if (paths.commissionsXlsx && fs.existsSync(paths.commissionsXlsx)) {
      await importCommissionWorkbook(paths.commissionsXlsx);
    }
    if (paths.pricingXlsx && fs.existsSync(paths.pricingXlsx)) {
      await importPricingWorkbook(paths.pricingXlsx);
    }
    const evolutionFiles = Array.isArray(paths.memberEvolutionXlsx)
      ? paths.memberEvolutionXlsx
      : paths.memberEvolutionXlsx
        ? [paths.memberEvolutionXlsx]
        : [];
    for (const filePath of evolutionFiles) {
      if (filePath && fs.existsSync(filePath)) {
        await importMemberEvolutionWorkbook(filePath, {
          sourceType: "seed",
          sourceKey: `seed_member_evolution:${path.basename(filePath)}`
        });
      }
    }
    if (paths.salesXlsx && fs.existsSync(paths.salesXlsx)) {
      await importSalesWorkbook(paths.salesXlsx, {
        sourceType: "seed",
        sourceKey: "seed_ventas_junio_2026",
        replaceMonths: false
      });
    }
    await purgeRemovedAdvisors();
  });
}

export async function purgeRemovedAdvisors() {
  if (!REMOVED_ADVISOR_HASHES.size) return { salesDeleted: 0, evaluationsDeleted: 0, advisorsDeleted: 0 };
  const advisors = (await all<{ id: number; normalized_name: string }>("SELECT id, normalized_name FROM advisors"))
    .filter((advisor) => isRemovedAdvisor(advisor.normalized_name));
  const advisorIds = advisors.map((advisor) => Number(advisor.id)).filter(Boolean);
  const rawRows = await all<{ id: number; raw_json: string }>("SELECT id, raw_json FROM sales WHERE raw_json IS NOT NULL");
  const rawSaleIds = rawRows
    .filter((row) => {
      try {
        const payload = JSON.parse(String(row.raw_json || "{}"));
        return payload && typeof payload === "object" && hasRemovedAdvisorField(payload as Record<string, unknown>);
      } catch {
        return false;
      }
    })
    .map((row) => Number(row.id))
    .filter(Boolean);
  const salesIds = [...new Set(rawSaleIds)];

  let salesDeleted = 0;
  let evaluationsDeleted = 0;
  let advisorsDeleted = 0;

  if (advisorIds.length) {
    const idPlaceholders = advisorIds.map(() => "?").join(", ");
    if (salesIds.length) {
      const salePlaceholders = salesIds.map(() => "?").join(", ");
      await run(
        `UPDATE sales SET advisor_id = NULL WHERE advisor_id IN (${idPlaceholders}) OR id IN (${salePlaceholders})`,
        [...advisorIds, ...salesIds]
      );
    } else {
      await run(`UPDATE sales SET advisor_id = NULL WHERE advisor_id IN (${idPlaceholders})`, advisorIds);
    }
    salesDeleted = 0;
    await run(`DELETE FROM advisor_evaluations WHERE advisor_id IN (${idPlaceholders})`, advisorIds);
    evaluationsDeleted = (await scalar<number>("SELECT changes()")) ?? 0;
    await run(`DELETE FROM advisors WHERE id IN (${idPlaceholders})`, advisorIds);
    advisorsDeleted = (await scalar<number>("SELECT changes()")) ?? 0;
  } else if (salesIds.length) {
    const salePlaceholders = salesIds.map(() => "?").join(", ");
    await run(`UPDATE sales SET advisor_id = NULL WHERE id IN (${salePlaceholders})`, salesIds);
    salesDeleted = 0;
  }

  return { salesDeleted, evaluationsDeleted, advisorsDeleted };
}

export async function updateEvaluation(input: {
  year: number;
  month: number;
  advisorId: number;
  qualityRating: string;
  adminRating: string;
  observations?: string;
}) {
  const qualityScore = ratingScore(input.qualityRating);
  const adminScore = ratingScore(input.adminRating);
  const qualityMultiplier = ratingMultiplier(input.qualityRating);
  const adminMultiplier = ratingMultiplier(input.adminRating);
  await run(
    `INSERT INTO advisor_evaluations (
      year, month, advisor_id, quality_rating, admin_rating, quality_score, admin_score,
      quality_multiplier, admin_multiplier, observations, include_in_score, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(year, month, advisor_id) DO UPDATE SET
      quality_rating=excluded.quality_rating,
      admin_rating=excluded.admin_rating,
      quality_score=excluded.quality_score,
      admin_score=excluded.admin_score,
      quality_multiplier=excluded.quality_multiplier,
      admin_multiplier=excluded.admin_multiplier,
      observations=excluded.observations,
      updated_at=CURRENT_TIMESTAMP`,
    [
      input.year,
      input.month,
      input.advisorId,
      input.qualityRating,
      input.adminRating,
      qualityScore,
      adminScore,
      qualityMultiplier,
      adminMultiplier,
      input.observations ?? ""
    ]
  );
}

export async function dbSnapshotCounts() {
  const tables = ["branches", "advisors", "plans", "sales", "monthly_targets", "member_evolution", "advisor_evaluations", "initiatives", "todos"];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    counts[table] = (await scalar<number>(`SELECT COUNT(*) FROM ${table}`)) ?? 0;
  }
  const sales = await get<{ total: number; first_date: string; last_date: string }>(
    "SELECT SUM(value) as total, MIN(sold_at) as first_date, MAX(sold_at) as last_date FROM sales"
  );
  return { counts, sales };
}

export async function readRecentImports() {
  return all("SELECT * FROM import_batches ORDER BY imported_at DESC LIMIT 10");
}
