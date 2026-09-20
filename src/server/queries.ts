import fs from "node:fs";
import { format, parseISO } from "date-fns";
import {
  calculateAdvisorCommission,
  calculateAdvisorScore,
  calculateBranchScore,
  calculateDirectorCommission,
  commissionSchemeForPeriod,
  DEFAULT_SCORE_SETTINGS,
  monthName,
  normalizeKey
} from "../shared/business";
import type { AdvisorTarget, BranchTarget, EvaluationInput } from "../shared/types";
import { all, get, run, scalar } from "./db";
import { colombianHolidaysForYear, commercialDatesForYear, importantDatesForYear } from "./importantDates";

type AnyRow = Record<string, any>;
type SeasonalityDailyPayload = {
  note?: string;
  records?: Array<{
    year: number;
    month: number;
    day: number;
    date?: string;
    sales: number;
    sourceFile?: string;
  }>;
};
type BranchTrackingRow = {
  name: string;
  meta1: number;
  meta2: number;
  meta3: number;
  meta4: number;
  executed: number;
  projected: number;
  diff: number;
  progress: number;
  expectedProgress: number;
  diffPp: number;
  status: string;
  dailyMeta: number;
  missingMeta1: number;
  missingMeta2: number;
  missingMeta3: number;
  missingMeta4: number;
  requiredDaily: number;
  daily: Record<string, number>;
};
type BranchTrackingPayload = {
  year: number;
  month: number;
  cutoffDay: number;
  cutoffDate: string;
  sourceFile: string;
  records: BranchTrackingRow[];
};

let seasonalityDailyCache: SeasonalityDailyPayload | null | undefined;
let branchTrackingCache: BranchTrackingPayload | null | undefined;
const ADVISORS_REMOVED_FROM_AUGUST = [
  "XIOMARA OCHOA",
  "VALENTINA VARGAS",
  "JEFERSON RODRIGUEZ",
  "ANGELA VIVIANA GUTIERREZ GAMBOA",
  "SARA VALENTINA MESA RODRIGUEZ"
];

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hideRemovedAdvisorsForPeriod(year: number, month: number) {
  return year > 2026 || (year === 2026 && month >= 8);
}

function removedAdvisorFilterSql(year: number, month: number, alias = "a") {
  return hideRemovedAdvisorsForPeriod(year, month)
    ? ` AND ${alias}.normalized_name NOT IN (${ADVISORS_REMOVED_FROM_AUGUST.map(() => "?").join(", ")})`
    : "";
}

function removedAdvisorFilterParams(year: number, month: number) {
  return hideRemovedAdvisorsForPeriod(year, month) ? ADVISORS_REMOVED_FROM_AUGUST : [];
}

function branchVisibilitySql(year: number, month: number, alias = "b") {
  if (year === 2026 && month >= 8 && month <= 12) return ` AND ${alias}.code <> '109'`;
  return "";
}

function branchTrackingKey(value: unknown) {
  const key = normalizeKey(value);
  if (key === "162" || key.includes("COLORS")) return "COLORS 162";
  if (key === "PRADO" || key.includes("PRADO")) return "PRADO VERANIEGO";
  if (key === "VILLAVO" || key.includes("VILLAVICENCIO")) return "VILLAVICENCIO";
  return key;
}

function branchTrackingPayload(year: number, month: number) {
  if (!(year === 2026 && month === 8)) return null;
  if (branchTrackingCache !== undefined) return branchTrackingCache;
  try {
    const file = new URL("./data/branchTrackingAug2026.json", import.meta.url);
    branchTrackingCache = JSON.parse(fs.readFileSync(file, "utf8")) as BranchTrackingPayload;
  } catch {
    branchTrackingCache = null;
  }
  return branchTrackingCache;
}

function seasonalityDailyPayload() {
  if (seasonalityDailyCache !== undefined) return seasonalityDailyCache;
  try {
    const file = new URL("./data/seasonalityDaily.json", import.meta.url);
    seasonalityDailyCache = JSON.parse(fs.readFileSync(file, "utf8")) as SeasonalityDailyPayload;
  } catch {
    seasonalityDailyCache = null;
  }
  return seasonalityDailyCache;
}

function seasonalityDailyRows(year: number, month: number) {
  const payload = seasonalityDailyPayload();
  return (payload?.records ?? [])
    .filter((row) => Number(row.year) === year && Number(row.month) === month)
    .map((row) => ({
      day: Number(row.day),
      label: String(row.day).padStart(2, "0"),
      sales: num(row.sales),
      rows: 0,
      month,
      year,
      source: "estacionalidad",
      sourceFile: row.sourceFile ?? "",
      sourceNote: payload?.note ?? ""
    }))
    .sort((a, b) => a.day - b.day);
}

function seasonalityDailyMap() {
  const payload = seasonalityDailyPayload();
  const map = new Map<string, number>();
  for (const row of payload?.records ?? []) {
    if (!row.date) continue;
    map.set(row.date, (map.get(row.date) ?? 0) + num(row.sales));
  }
  return map;
}

function dailyBudgetByDay(daysInMonth: number, totalTarget: number, referenceRows: AnyRow[]) {
  const safeDays = Math.max(1, daysInMonth);
  const safeTarget = num(totalTarget);
  const referenceSalesByDay = new Map<number, number>();
  for (const row of referenceRows) {
    const day = Number(row.day);
    if (day >= 1 && day <= safeDays) {
      referenceSalesByDay.set(day, Math.max(0, num(row.sales)));
    }
  }
  const referenceTotal = [...referenceSalesByDay.values()].reduce((sum, sales) => sum + sales, 0);
  const useReference = safeTarget > 0 && referenceTotal > 0;
  let cumulative = 0;
  const budgets = new Map<number, {
    budgetSales: number;
    budgetAccumulated: number;
    budgetWeight: number;
    budgetSource: string;
  }>();

  for (let day = 1; day <= safeDays; day += 1) {
    const budgetWeight = useReference ? (referenceSalesByDay.get(day) ?? 0) / referenceTotal : 1 / safeDays;
    const budgetSales = safeTarget * budgetWeight;
    cumulative += budgetSales;
    budgets.set(day, {
      budgetSales,
      budgetAccumulated: cumulative,
      budgetWeight,
      budgetSource: useReference ? "historico_mismo_mes" : "lineal"
    });
  }

  return budgets;
}

function percentChange(current: number, previous: number) {
  if (!previous) return current ? null : 0;
  return (current - previous) / previous;
}

function nextGoalForSales(target: AdvisorTarget | BranchTarget | null, sales: number) {
  if (!target) return { label: "Sin meta", amount: 0 };
  const goals = [
    { label: "Meta 1", amount: num(target.meta1) },
    { label: "Meta 2", amount: num(target.meta2) },
    { label: "Meta 3", amount: num(target.meta3) },
    { label: "Meta 4", amount: num(target.meta4) }
  ].filter((goal) => goal.amount > 0 && Number.isFinite(goal.amount));
  return goals.find((goal) => sales < goal.amount) ?? goals[goals.length - 1] ?? { label: "Sin meta", amount: 0 };
}

function liveTrackingRow(input: {
  name: string;
  target: BranchTarget | null;
  executed: number;
  cutoffDay: number;
  daysInMonth: number;
}) {
  const meta1 = num(input.target?.meta1);
  const meta2 = num(input.target?.meta2);
  const meta3 = num(input.target?.meta3);
  const meta4 = num(input.target?.meta4);
  const safeDays = Math.max(1, input.daysInMonth);
  const safeCutoff = Math.max(1, Math.min(input.cutoffDay || 1, safeDays));
  const expectedProgress = safeCutoff / safeDays;
  const projected = meta1 * expectedProgress;
  const executed = num(input.executed);
  const diff = executed - projected;
  const missingMeta1 = Math.max(meta1 - executed, 0);
  const missingMeta2 = Math.max(meta2 - executed, 0);
  const missingMeta3 = Math.max(meta3 - executed, 0);
  const missingMeta4 = Math.max(meta4 - executed, 0);
  const remainingDays = Math.max(safeDays - safeCutoff, 0);

  return {
    name: input.name,
    meta1,
    meta2,
    meta3,
    meta4,
    executed,
    projected,
    diff,
    progress: meta1 > 0 ? executed / meta1 : 0,
    expectedProgress,
    diffPp: meta1 > 0 ? executed / meta1 - expectedProgress : 0,
    status: diff >= 0 ? "Sobre proyección" : "Bajo proyección",
    dailyMeta: meta1 > 0 ? meta1 / safeDays : 0,
    missingMeta1,
    missingMeta2,
    missingMeta3,
    missingMeta4,
    requiredDaily: remainingDays > 0 ? missingMeta1 / remainingDays : missingMeta1,
    daily: {}
  };
}

async function settings() {
  const rows = await all<{ key: string; value: string }>("SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

async function buildConfigurationState(year: number, month: number, quality: AnyRow) {
  const branches = await all<AnyRow>(
    `SELECT
       b.id,
       b.code,
       b.name,
       b.display_name,
       b.active,
       b.created_at,
       b.updated_at,
       COALESCE(ac.advisors_count, 0) advisors_count,
       COALESCE(sa.sales_rows, 0) sales_rows,
       COALESCE(sa.sales, 0) sales
     FROM branches b
     LEFT JOIN (SELECT branch_id, COUNT(*) advisors_count FROM advisors GROUP BY branch_id) ac ON ac.branch_id = b.id
     LEFT JOIN (SELECT branch_id, COUNT(*) sales_rows, SUM(value) sales FROM sales GROUP BY branch_id) sa ON sa.branch_id = b.id
     ORDER BY b.active DESC, b.display_name`
  );
  const branchTargets2026 = await all<AnyRow>(
    `SELECT
       branch_id,
       month,
       branch_meta1,
       branch_meta2,
       branch_meta3,
       branch_meta4
     FROM monthly_targets
     WHERE year = 2026
     ORDER BY branch_id, month`
  );
  const targets2026ByBranch = new Map<number, AnyRow[]>();
  for (const row of branchTargets2026) {
    const branchId = num(row.branch_id);
    const bucket = targets2026ByBranch.get(branchId) ?? [];
    bucket.push(row);
    targets2026ByBranch.set(branchId, bucket);
  }
  const inactiveAlerts = await all<AnyRow>(
    `SELECT
       a.id advisor_id,
       COUNT(s.id) rows_count,
       COALESCE(SUM(s.value), 0) sales,
       MAX(s.sold_at) last_sale_at
     FROM advisors a
     JOIN sales s ON s.advisor_id = a.id
     WHERE a.active = 0
       AND s.value > 0
       AND date(s.sold_at) >= date(COALESCE(a.inactive_since, '1900-01-01'))
     GROUP BY a.id`
  );
  const inactiveAlertByAdvisor = new Map(inactiveAlerts.map((row) => [Number(row.advisor_id), row]));
  const advisors = await all<AnyRow>(
    `SELECT
       a.id,
       a.name,
       a.normalized_name,
       a.branch_id,
       b.display_name branch_name,
       a.active,
       a.excluded_from_commissions,
       a.inactive_since,
       a.inactive_reason,
       a.created_at,
       a.updated_at,
       COUNT(s.id) sales_rows,
       COALESCE(SUM(s.value), 0) sales,
       MAX(s.sold_at) last_sale_at
     FROM advisors a
     LEFT JOIN branches b ON b.id = a.branch_id
     LEFT JOIN sales s ON s.advisor_id = a.id
     GROUP BY a.id
     ORDER BY a.active DESC, COALESCE(b.display_name, 'Sin sede'), a.name`
  );
  const unresolvedErrors = await all<AnyRow>(
    `SELECT id, code, area, user_message, technical_message, method, path, status_code, details, created_at, resolved_at
     FROM app_errors
     WHERE resolved_at IS NULL
     ORDER BY created_at DESC
     LIMIT 40`
  ).catch(() => []);
  const inactiveWithSales = inactiveAlerts.reduce((sum, row) => sum + num(row.rows_count), 0);
  const dataIssues =
    num(quality?.issueCount) +
    inactiveWithSales +
    unresolvedErrors.filter((row) => num(row.status_code) >= 500).length;
  return {
    branches: branches.map((row) => {
      const targetRows = targets2026ByBranch.get(num(row.id)) ?? [];
      const targetsByMonth = new Map(targetRows.map((targetRow) => [num(targetRow.month), targetRow]));
      const targets2026 = Array.from({ length: 12 }, (_, index) => {
        const monthNumber = index + 1;
        const target = targetsByMonth.get(monthNumber);
        return {
          month: monthNumber,
          label: monthName(monthNumber).slice(0, 3),
          meta1: num(target?.branch_meta1),
          meta2: num(target?.branch_meta2),
          meta3: num(target?.branch_meta3),
          meta4: num(target?.branch_meta4),
          loaded: Boolean(target)
        };
      });
      return {
        id: num(row.id),
        code: row.code,
        name: row.name,
        displayName: row.display_name,
        active: num(row.active),
        advisorsCount: num(row.advisors_count),
        salesRows: num(row.sales_rows),
        sales: num(row.sales),
        targets2026,
        annualTarget2026: targets2026.reduce((sum, target) => sum + num(target.meta1), 0),
        loadedTargetMonths2026: targets2026.filter((target) => target.loaded).length,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }),
    advisors: advisors.map((row) => {
      const alert = inactiveAlertByAdvisor.get(num(row.id));
      return {
        id: num(row.id),
        name: row.name,
        normalizedName: row.normalized_name,
        branchId: row.branch_id === null ? null : num(row.branch_id),
        branchName: row.branch_name ?? "Sin sede",
        active: num(row.active),
        excludedFromCommissions: num(row.excluded_from_commissions),
        inactiveSince: row.inactive_since,
        inactiveReason: row.inactive_reason ?? "",
        salesRows: num(row.sales_rows),
        sales: num(row.sales),
        lastSaleAt: row.last_sale_at,
        inactiveAlert: alert
          ? {
              rows: num(alert.rows_count),
              sales: num(alert.sales),
              lastSaleAt: alert.last_sale_at
            }
          : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }),
    health: {
      status: dataIssues === 0 ? "ok" : "review",
      ok: dataIssues === 0,
      dataIssues,
      inactiveSalesRows: inactiveWithSales,
      unresolvedErrors: unresolvedErrors.length,
      criticalErrors: unresolvedErrors.filter((row) => num(row.status_code) >= 500).length,
      qualityIssues: num(quality?.issueCount)
    },
    debug: {
      errors: unresolvedErrors.map((row) => ({
        id: num(row.id),
        code: row.code,
        area: row.area,
        userMessage: row.user_message,
        technicalMessage: row.technical_message,
        method: row.method,
        path: row.path,
        statusCode: num(row.status_code),
        details: (() => {
          try {
            return JSON.parse(String(row.details || "{}"));
          } catch {
            return {};
          }
        })(),
        createdAt: row.created_at,
        resolvedAt: row.resolved_at
      }))
    }
  };
}

function currentPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "numeric"
  }).formatToParts(new Date());
  return {
    year: Number(parts.find((part) => part.type === "year")?.value) || new Date().getFullYear(),
    month: Number(parts.find((part) => part.type === "month")?.value) || new Date().getMonth() + 1
  };
}

function publicSettings(map: Record<string, string>) {
  const output = { ...map };
  for (const key of Object.keys(output)) {
    if (key.includes("api_key")) {
      output[`${key}_configured`] = output[key] ? "true" : "false";
      output[key] = "";
    }
  }
  if (process.env.GROQ_API_KEY) output.groq_api_key_configured = "true";
  if (process.env.GROQ_MODEL) output.groq_model = process.env.GROQ_MODEL;
  return output;
}

function scoreSettings(map: Record<string, string>) {
  return {
    monthlyConversionGoalPerAdvisor:
      Number(map.monthly_conversion_goal_per_advisor) || DEFAULT_SCORE_SETTINGS.monthlyConversionGoalPerAdvisor,
    maxDiscountRate: Number(map.max_discount_rate) || DEFAULT_SCORE_SETTINGS.maxDiscountRate,
    scoreHigh: Number(map.score_high) || DEFAULT_SCORE_SETTINGS.scoreHigh,
    scoreMedium: Number(map.score_medium) || DEFAULT_SCORE_SETTINGS.scoreMedium
  };
}

function scoreStatusFromNumber(score: number | null) {
  if (score === null) return "Pendiente";
  if (score >= DEFAULT_SCORE_SETTINGS.scoreHigh) return "Alto";
  if (score >= DEFAULT_SCORE_SETTINGS.scoreMedium) return "Medio";
  return "Bajo";
}

function comparativeScore(sales: number, maxSales: number, rows: number, maxRows: number) {
  if (sales <= 0 || maxSales <= 0) {
    return {
      score: null,
      status: "Pendiente",
      salesScore: 0,
      volumeScore: 0
    };
  }
  const salesScore = Math.min(sales / maxSales, 1) * 100;
  const volumeScore = maxRows > 0 ? Math.min(rows / maxRows, 1) * 100 : 0;
  const score = Math.round(salesScore * 0.7 + volumeScore * 0.3);
  return {
    score,
    status: scoreStatusFromNumber(score),
    salesScore,
    volumeScore
  };
}

function advisorTarget(row?: AnyRow): AdvisorTarget | null {
  if (!row) return null;
  return {
    activation: num(row.advisor_activation),
    bronze: num(row.advisor_bronze),
    silver: num(row.advisor_silver),
    meta1: num(row.advisor_meta1),
    meta2: num(row.advisor_meta2),
    meta3: num(row.advisor_meta3),
    meta4: num(row.advisor_meta4),
    dailyMeta4: num(row.advisor_daily_meta4),
    weeklyMeta4: num(row.advisor_weekly_meta4)
  };
}

function branchTarget(row?: AnyRow): BranchTarget | null {
  if (!row) return null;
  return {
    activation: num(row.branch_activation),
    bronze: num(row.branch_bronze),
    silver: num(row.branch_silver),
    meta1: num(row.branch_meta1),
    meta2: num(row.branch_meta2),
    meta3: num(row.branch_meta3),
    meta4: num(row.branch_meta4),
    dailyMeta4: num(row.branch_daily_meta4),
    weeklyMeta4: num(row.branch_weekly_meta4)
  };
}

function evaluation(row?: AnyRow): EvaluationInput {
  return {
    qualityRating: row?.quality_rating ?? "",
    adminRating: row?.admin_rating ?? "",
    qualityScore: num(row?.quality_score),
    adminScore: num(row?.admin_score),
    qualityMultiplier: row?.quality_multiplier === undefined ? 1 : num(row.quality_multiplier),
    adminMultiplier: row?.admin_multiplier === undefined ? 1 : num(row.admin_multiplier)
  };
}

async function targetRows(year: number, month: number) {
  const rows = await all<AnyRow>(
    `SELECT mt.*, b.code, b.display_name
     FROM monthly_targets mt
     JOIN branches b ON b.id = mt.branch_id
     WHERE mt.year = ? AND mt.month = ?`,
    [year, month]
  );
  return new Map(rows.map((row) => [Number(row.branch_id), row]));
}

async function annualTargetRows(year: number) {
  const rows = await all<AnyRow>(
    `SELECT
      branch_id,
      COALESCE(SUM(advisor_meta1), 0) advisor_meta1,
      COALESCE(SUM(advisor_meta2), 0) advisor_meta2,
      COALESCE(SUM(advisor_meta3), 0) advisor_meta3,
      COALESCE(SUM(advisor_meta4), 0) advisor_meta4,
      COALESCE(SUM(branch_meta1), 0) branch_meta1,
      COALESCE(SUM(branch_meta2), 0) branch_meta2,
      COALESCE(SUM(branch_meta3), 0) branch_meta3,
      COALESCE(SUM(branch_meta4), 0) branch_meta4
     FROM monthly_targets
     WHERE year = ?
     GROUP BY branch_id`,
    [year]
  );
  return new Map(rows.map((row) => [Number(row.branch_id), row]));
}

function memberEvolutionMetrics(row: AnyRow) {
  const activeStart = num(row.active_start);
  const activeEnd = num(row.active_end);
  const cancellations = num(row.cancellations);
  const notRenewed = num(row.not_renewed);
  const totalExits = num(row.total_exits);
  const directChurn = activeStart > 0 ? (cancellations + notRenewed) / activeStart : 0;
  const grossChurn = activeStart > 0 ? totalExits / activeStart : 0;
  const netEvolutionRate = activeStart > 0 ? (activeEnd - activeStart) / activeStart : 0;
  return {
    year: num(row.year),
    month: num(row.month),
    day: num(row.day),
    cutoffDate: row.cutoff_date ?? null,
    branchId: num(row.branch_id),
    branchName: row.branch_name ?? row.name ?? "Sin sede",
    activeStart,
    newMembers: num(row.new_members),
    renewed: num(row.renewed),
    reinscriptions: num(row.reinscriptions),
    returnedFromSuspension: num(row.returned_from_suspension),
    totalEntries: num(row.total_entries),
    cancellations,
    expired: num(row.expired),
    notRenewed,
    suspended: num(row.suspended),
    totalExits,
    activeEnd,
    netEvolution: num(row.net_evolution) || activeEnd - activeStart,
    netEvolutionRate,
    directChurn,
    grossChurn,
    retentionRate: Math.max(0, 1 - directChurn),
    sourceFile: row.source_file ?? ""
  };
}

async function buildMemberEvolutionState(year: number, month: number) {
  const currentRows = await all<AnyRow>(
    `WITH latest AS (
       SELECT COALESCE(MAX(day), 0) day
       FROM member_evolution
       WHERE year = ? AND month = ?
     )
     SELECT me.*, b.display_name branch_name
     FROM member_evolution me
     JOIN branches b ON b.id = me.branch_id
     JOIN latest ON latest.day = me.day
     WHERE me.year = ? AND me.month = ?
     ORDER BY me.active_start DESC, b.display_name`,
    [year, month, year, month]
  );
  const historyRows = await all<AnyRow>(
    `WITH latest AS (
       SELECT year, month, branch_id, MAX(day) day
       FROM member_evolution
       WHERE year = ? AND month <= ?
       GROUP BY year, month, branch_id
     )
     SELECT me.*, b.display_name branch_name
     FROM member_evolution me
     JOIN branches b ON b.id = me.branch_id
     JOIN latest
       ON latest.year = me.year
      AND latest.month = me.month
      AND latest.branch_id = me.branch_id
      AND latest.day = me.day
     ORDER BY me.year, me.month, me.day, b.display_name`,
    [year, month]
  );
  const monthlyRows = await all<AnyRow>(
    `WITH latest AS (
       SELECT year, month, branch_id, MAX(day) day
       FROM member_evolution
       WHERE year = ? AND month <= ?
       GROUP BY year, month, branch_id
     ),
     latest_rows AS (
       SELECT me.*
       FROM member_evolution me
       JOIN latest
         ON latest.year = me.year
        AND latest.month = me.month
        AND latest.branch_id = me.branch_id
        AND latest.day = me.day
     )
     SELECT
       year,
       month,
       MAX(day) day,
       MAX(cutoff_date) cutoff_date,
       SUM(active_start) active_start,
       SUM(new_members) new_members,
       SUM(renewed) renewed,
       SUM(reinscriptions) reinscriptions,
       SUM(returned_from_suspension) returned_from_suspension,
       SUM(total_entries) total_entries,
       SUM(cancellations) cancellations,
       SUM(expired) expired,
       SUM(not_renewed) not_renewed,
       SUM(suspended) suspended,
       SUM(total_exits) total_exits,
       SUM(active_end) active_end,
       SUM(net_evolution) net_evolution,
       '' branch_name,
       0 branch_id
     FROM latest_rows
     GROUP BY year, month
     ORDER BY year, month`,
    [year, month]
  );
  const dailyRows = await all<AnyRow>(
    `WITH has_daily AS (
       SELECT COUNT(*) count
       FROM member_evolution
       WHERE year = ? AND month = ? AND day > 0
     )
     SELECT
       year,
       month,
       day,
       MAX(cutoff_date) cutoff_date,
       SUM(active_start) active_start,
       SUM(new_members) new_members,
       SUM(renewed) renewed,
       SUM(reinscriptions) reinscriptions,
       SUM(returned_from_suspension) returned_from_suspension,
       SUM(total_entries) total_entries,
       SUM(cancellations) cancellations,
       SUM(expired) expired,
       SUM(not_renewed) not_renewed,
       SUM(suspended) suspended,
       SUM(total_exits) total_exits,
       SUM(active_end) active_end,
       SUM(net_evolution) net_evolution,
       '' branch_name,
       0 branch_id
     FROM member_evolution
     WHERE year = ? AND month = ?
       AND (day > 0 OR (SELECT count FROM has_daily) = 0)
     GROUP BY year, month, day
     ORDER BY year, month, day`,
    [year, month, year, month]
  );
  const current = currentRows.map(memberEvolutionMetrics);
  const currentCutoffDay = current.reduce((max, row) => Math.max(max, Number(row.day || 0)), 0);
  const previousRows = await all<AnyRow>(
    `SELECT me.*, b.display_name branch_name
     FROM member_evolution me
     JOIN branches b ON b.id = me.branch_id
     WHERE me.year < ?
        OR (me.year = ? AND me.month < ?)
        OR (me.year = ? AND me.month = ? AND me.day < ?)
     ORDER BY me.branch_id, me.year, me.month, me.day`,
    [year, year, month, year, month, currentCutoffDay]
  );
  const previousByBranch = new Map<number, ReturnType<typeof memberEvolutionMetrics>>();
  for (const row of previousRows) {
    previousByBranch.set(num(row.branch_id), memberEvolutionMetrics(row));
  }
  const currentWithPrevious = current.map((row) => {
    const previous = previousByBranch.get(Number(row.branchId));
    return {
      ...row,
      previousCutoff: previous
        ? {
            day: previous.day,
            cutoffDate: previous.cutoffDate,
            grossChurn: previous.grossChurn,
            directChurn: previous.directChurn,
            activeEnd: previous.activeEnd
          }
        : null,
      grossChurnDelta: previous ? row.grossChurn - previous.grossChurn : null,
      directChurnDelta: previous ? row.directChurn - previous.directChurn : null,
      activeEndDelta: previous ? row.activeEnd - previous.activeEnd : null
    };
  });
  const history = historyRows.map(memberEvolutionMetrics);
  const monthlyTrend = monthlyRows.map((row) => ({
    ...memberEvolutionMetrics(row),
    label: `${monthName(num(row.month)).slice(0, 3)} ${row.year}`
  }));
  const dailyTrend = dailyRows.map((row) => ({
    ...memberEvolutionMetrics(row),
    label: num(row.day) ? `${num(row.day)} ${monthName(num(row.month)).slice(0, 3)}` : `${monthName(num(row.month)).slice(0, 3)} ${row.year}`
  }));
  const latestCutoff = currentRows.reduce(
    (latest, row) => {
      const day = num(row.day);
      if (day >= latest.day) {
        return {
          day,
          cutoffDate: row.cutoff_date ?? null,
          sourceFile: row.source_file ?? ""
        };
      }
      return latest;
    },
    { day: 0, cutoffDate: null as string | null, sourceFile: "" }
  );
  const summaryBase = currentRows.length
    ? {
        year,
        month,
        day: latestCutoff.day,
        cutoff_date: latestCutoff.cutoffDate,
        branch_id: 0,
        branch_name: "Total",
        active_start: currentRows.reduce((sum, row) => sum + num(row.active_start), 0),
        new_members: currentRows.reduce((sum, row) => sum + num(row.new_members), 0),
        renewed: currentRows.reduce((sum, row) => sum + num(row.renewed), 0),
        reinscriptions: currentRows.reduce((sum, row) => sum + num(row.reinscriptions), 0),
        returned_from_suspension: currentRows.reduce((sum, row) => sum + num(row.returned_from_suspension), 0),
        total_entries: currentRows.reduce((sum, row) => sum + num(row.total_entries), 0),
        cancellations: currentRows.reduce((sum, row) => sum + num(row.cancellations), 0),
        expired: currentRows.reduce((sum, row) => sum + num(row.expired), 0),
        not_renewed: currentRows.reduce((sum, row) => sum + num(row.not_renewed), 0),
        suspended: currentRows.reduce((sum, row) => sum + num(row.suspended), 0),
        total_exits: currentRows.reduce((sum, row) => sum + num(row.total_exits), 0),
        active_end: currentRows.reduce((sum, row) => sum + num(row.active_end), 0),
        net_evolution: currentRows.reduce((sum, row) => sum + num(row.net_evolution), 0)
      }
    : null;
  const byBranch = currentWithPrevious.slice().sort((a, b) => b.grossChurn - a.grossChurn || b.activeStart - a.activeStart);
  return {
    available: current.length > 0,
    summary: summaryBase ? memberEvolutionMetrics(summaryBase) : null,
    byBranch,
    monthlyTrend,
    dailyTrend,
    history,
    latestCutoff,
    topRiskBranches: byBranch.slice(0, 5),
    sourceFiles: [...new Set(currentRows.map((row) => row.source_file).filter(Boolean))]
  };
}

export async function buildAppState(year?: number, month?: number) {
  const settingMap = await settings();
  const period = currentPeriod();
  const selectedYear = year || period.year;
  const selectedMonth = month || period.month;
  const scoreConfig = scoreSettings(settingMap);
  const commissionScheme = commissionSchemeForPeriod(selectedYear, selectedMonth);
  const targets = await targetRows(selectedYear, selectedMonth);
  const annualTargets = await annualTargetRows(selectedYear);

  const years = await all<{ year: number }>(
    `SELECT DISTINCT year FROM sales
     UNION
     SELECT DISTINCT year FROM monthly_targets
     ORDER BY year DESC`
  );

  const salesSummary = await get<AnyRow>(
    `SELECT
      COALESCE(SUM(value), 0) total_sales,
      COUNT(*) sales_rows,
      COUNT(DISTINCT branch_id) active_branches,
      COUNT(DISTINCT advisor_id) active_advisors,
      AVG(NULLIF(value, 0)) avg_ticket
     FROM sales
     WHERE year = ? AND month = ?`,
    [selectedYear, selectedMonth]
  );

  const branchSales = await all<AnyRow>(
    `SELECT
      b.id, b.code, b.display_name name,
      COALESCE(SUM(s.value), 0) sales,
      COUNT(s.id) rows_count,
      COUNT(DISTINCT s.advisor_id) advisors_with_sales
     FROM branches b
     LEFT JOIN sales s ON s.branch_id = b.id AND s.year = ? AND s.month = ?
     WHERE b.active = 1${branchVisibilitySql(selectedYear, selectedMonth, "b")}
     GROUP BY b.id
     ORDER BY sales DESC, b.display_name`,
    [selectedYear, selectedMonth]
  );

  const advisorSales = await all<AnyRow>(
    `SELECT
      a.id,
      a.name,
      a.branch_id branch_id,
      ab.display_name branch_name,
      a.active,
      COALESCE(SUM(s.value), 0) sales,
      COUNT(s.id) rows_count,
      COALESCE(SUM(CASE WHEN s.value > 0 THEN 1 ELSE 0 END), 0) conversions
     FROM advisors a
     LEFT JOIN branches ab ON ab.id = a.branch_id
     LEFT JOIN sales s ON s.advisor_id = a.id AND s.year = ? AND s.month = ?
     WHERE a.excluded_from_commissions = 0
       AND (
         a.active = 1
         OR EXISTS (
           SELECT 1 FROM sales sx
           WHERE sx.advisor_id = a.id AND sx.year = ? AND sx.month = ? AND sx.value > 0
         )
       )
     GROUP BY a.id
     ORDER BY sales DESC, a.name`,
    [selectedYear, selectedMonth, selectedYear, selectedMonth]
  );

  const yearlyAdvisorSales = await all<AnyRow>(
    `SELECT advisor_id, COALESCE(SUM(value), 0) yearly_sales
     FROM sales
     WHERE year = ?
     GROUP BY advisor_id`,
    [selectedYear]
  );
  const yearlyByAdvisorBranch = new Map(
    yearlyAdvisorSales.map((row) => [Number(row.advisor_id), num(row.yearly_sales)])
  );

  const evaluations = await all<AnyRow>(
    `SELECT * FROM advisor_evaluations WHERE year = ? AND month = ?`,
    [selectedYear, selectedMonth]
  );
  const evaluationByAdvisor = new Map(evaluations.map((row) => [Number(row.advisor_id), row]));
  const daysInSelectedMonthForAdvisors = new Date(selectedYear, selectedMonth, 0).getDate();
  const previousYear = selectedYear - 1;
  const previousYearDailySalesRaw = await all<AnyRow>(
    `SELECT day, COALESCE(SUM(value), 0) sales, COUNT(*) rows
     FROM sales
     WHERE year = ? AND month = ?
     GROUP BY day
     ORDER BY day`,
    [previousYear, selectedMonth]
  );
  const sameMonthReferenceRows = previousYearDailySalesRaw.length
    ? previousYearDailySalesRaw
    : seasonalityDailyRows(previousYear, selectedMonth);
  const comparisonDay = num(await scalar(
    `SELECT MAX(day) FROM sales WHERE year = ? AND month = ? AND value > 0`,
    [selectedYear, selectedMonth]
  ));
  const advisorCutoffDay = Math.max(
    1,
    Math.min(comparisonDay || Math.min(new Date().getDate(), daysInSelectedMonthForAdvisors), daysInSelectedMonthForAdvisors)
  );
  const advisorRemainingDays = Math.max(daysInSelectedMonthForAdvisors - advisorCutoffDay, 0);

  const advisors = advisorSales.map((row) => {
    const target = advisorTarget(targets.get(Number(row.branch_id)));
    const sales = num(row.sales);
    const activeGoal = nextGoalForSales(target, sales);
    const remainingToActiveGoal = Math.max(activeGoal.amount - sales, 0);
    const requiredDailyGoal = advisorRemainingDays > 0 ? remainingToActiveGoal / advisorRemainingDays : remainingToActiveGoal;
    const advisorBudgetByDay = dailyBudgetByDay(daysInSelectedMonthForAdvisors, activeGoal.amount, sameMonthReferenceRows);
    const advisorBudgetToday = advisorBudgetByDay.get(advisorCutoffDay);
    const expectedSalesToDate = advisorBudgetToday?.budgetAccumulated ?? (
      activeGoal.amount > 0 ? (activeGoal.amount / daysInSelectedMonthForAdvisors) * advisorCutoffDay : 0
    );
    const dailyGoal = advisorBudgetToday?.budgetSales ?? (
      activeGoal.amount > 0 ? activeGoal.amount / daysInSelectedMonthForAdvisors : 0
    );
    const evalInput = evaluation(evaluationByAdvisor.get(Number(row.id)));
    const commission = calculateAdvisorCommission({
      sales,
      target,
      conversions: num(row.conversions),
      discounts: 0,
      evaluation: evalInput
    }, {
      year: selectedYear,
      month: selectedMonth
    });
    const score = calculateAdvisorScore(
      {
        sales,
        target,
        conversions: num(row.conversions),
        discounts: 0,
        evaluation: evalInput
      },
      scoreConfig
    );
    return {
      id: Number(row.id),
      metricId: `${Number(row.id)}:${Number(row.branch_id ?? 0)}`,
      name: row.name,
      branchId: row.branch_id ? Number(row.branch_id) : null,
      branchName: row.branch_name ?? "Sin sede",
      active: Number(row.active ?? 1),
      sales,
      yearlySales: yearlyByAdvisorBranch.get(Number(row.id)) ?? 0,
      rows: num(row.rows_count),
      conversions: num(row.conversions),
      target,
      commission,
      score,
      dailyGoal,
      requiredDailyGoal,
      monthlyGoal: activeGoal.amount,
      monthlyGoalLabel: activeGoal.label,
      remainingToMonthlyGoal: remainingToActiveGoal,
      expectedSalesToDate,
      paceDelta: sales - expectedSalesToDate,
      paceCutoffDay: advisorCutoffDay,
      budgetSource: advisorBudgetToday?.budgetSource ?? "lineal",
      budgetWeight: advisorBudgetToday?.budgetWeight ?? 0,
      remainingDays: advisorRemainingDays,
      annualGoal: annualTargets.get(Number(row.branch_id))?.advisor_meta4 ?? 0,
      annualMeta1: annualTargets.get(Number(row.branch_id))?.advisor_meta1 ?? 0,
      annualMeta2: annualTargets.get(Number(row.branch_id))?.advisor_meta2 ?? 0,
      annualMeta3: annualTargets.get(Number(row.branch_id))?.advisor_meta3 ?? 0,
      annualMeta4: annualTargets.get(Number(row.branch_id))?.advisor_meta4 ?? 0,
      progressMeta1: commission.progressMeta1,
      progressMeta4: score.progressMeta4,
      evaluation: evalInput
    };
  });

  const previous = previousPeriod(selectedYear, selectedMonth);
  const previousCutoffDay = comparisonDay || new Date(selectedYear, selectedMonth, 0).getDate();
  const previousTargets = await targetRows(previous.year, previous.month);
  const previousSalesSummary = await get<AnyRow>(
    `SELECT
      COALESCE(SUM(value), 0) total_sales,
      COUNT(*) sales_rows,
      AVG(NULLIF(value, 0)) avg_ticket
     FROM sales
     WHERE year = ? AND month = ? AND day <= ?`,
    [previous.year, previous.month, previousCutoffDay]
  );
  const previousBranchSalesRows = await all<AnyRow>(
    `SELECT branch_id, COALESCE(SUM(value), 0) sales
     FROM sales
     WHERE year = ? AND month = ? AND day <= ?
     GROUP BY branch_id`,
    [previous.year, previous.month, previousCutoffDay]
  );
  const previousSalesByBranch = new Map(previousBranchSalesRows.map((row) => [Number(row.branch_id), num(row.sales)]));
  const previousAdvisorSales = await all<AnyRow>(
    `SELECT
      a.id,
      a.branch_id branch_id,
      COALESCE(SUM(s.value), 0) sales,
      COALESCE(SUM(CASE WHEN s.value > 0 THEN 1 ELSE 0 END), 0) conversions
     FROM advisors a
     LEFT JOIN sales s ON s.advisor_id = a.id AND s.year = ? AND s.month = ? AND s.day <= ?
     WHERE a.active = 1 AND a.excluded_from_commissions = 0${removedAdvisorFilterSql(previous.year, previous.month)}
     GROUP BY a.id`,
    [previous.year, previous.month, previousCutoffDay, ...removedAdvisorFilterParams(previous.year, previous.month)]
  );
  const previousEvaluations = await all<AnyRow>(
    `SELECT * FROM advisor_evaluations WHERE year = ? AND month = ?`,
    [previous.year, previous.month]
  );
  const previousEvaluationByAdvisor = new Map(previousEvaluations.map((row) => [Number(row.advisor_id), row]));
  const previousAdvisorCommissions = previousAdvisorSales.reduce((sum, row) => {
    const target = advisorTarget(previousTargets.get(Number(row.branch_id)));
    const evalInput = evaluation(previousEvaluationByAdvisor.get(Number(row.id)));
    const commission = calculateAdvisorCommission({
      sales: num(row.sales),
      target,
      conversions: num(row.conversions),
      discounts: 0,
      evaluation: evalInput
    }, {
      year: previous.year,
      month: previous.month
    });
    return sum + commission.finalCommission;
  }, 0);
  const previousDirectorCommissions = previousBranchSalesRows.reduce((sum, row) => {
    const target = branchTarget(previousTargets.get(Number(row.branch_id)));
    return sum + calculateDirectorCommission(num(row.sales), target).bonus;
  }, 0);
  const previousTotalTarget = [...previousTargets.values()].reduce((sum, row) => sum + num(row.branch_meta1), 0);
  const previousTotalSales = num(previousSalesSummary?.total_sales);
  const previousDaysInMonth = new Date(previous.year, previous.month, 0).getDate();
  const previousCompanyTarget = {
    activation: 0,
    bronze: 0,
    silver: 0,
    meta1: [...previousTargets.values()].reduce((sum, row) => sum + num(row.branch_meta1), 0),
    meta2: [...previousTargets.values()].reduce((sum, row) => sum + num(row.branch_meta2), 0),
    meta3: [...previousTargets.values()].reduce((sum, row) => sum + num(row.branch_meta3), 0),
    meta4: [...previousTargets.values()].reduce((sum, row) => sum + num(row.branch_meta4), 0),
    dailyMeta4: 0,
    weeklyMeta4: 0
  };
  const previousCompanyTracking = liveTrackingRow({
    name: "COMPAÑÍA",
    target: previousCompanyTarget,
    executed: previousTotalSales,
    cutoffDay: previousCutoffDay,
    daysInMonth: previousDaysInMonth
  });
  const previousKpis = {
    totalSales: previousTotalSales,
    avgTicket: num(previousSalesSummary?.avg_ticket),
    totalTarget: previousTotalTarget,
    targetProgress: previousTotalTarget > 0 ? previousTotalSales / previousTotalTarget : 0,
    totalAdvisorCommissions: previousAdvisorCommissions,
    totalDirectorCommissions: previousDirectorCommissions,
    projectedToDate: previousCompanyTracking.projected,
    trackingDiff: previousCompanyTracking.diff,
    comparisonDay: previousCutoffDay
  };

  const advisorsByBranch = new Map<number, typeof advisors>();
  for (const advisor of advisors) {
    if (!advisor.branchId) continue;
    const bucket = advisorsByBranch.get(advisor.branchId) ?? [];
    bucket.push(advisor);
    advisorsByBranch.set(advisor.branchId, bucket);
  }

  const branches = branchSales
    .map((row) => {
      const branchId = Number(row.id);
      const branchSalesValue = num(row.sales);
      const branchAdvisors = advisorsByBranch.get(branchId) ?? [];
      const validScores = branchAdvisors.map((advisor) => advisor.score.score).filter((score): score is number => score !== null);
      const avgAdvisorScore = validScores.length
        ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
        : 0;
      const target = branchTarget(targets.get(branchId));
      const score = calculateBranchScore(
        {
          sales: branchSalesValue,
          target,
          conversions: num(row.rows_count),
          discounts: 0,
          advisorAverageScore: avgAdvisorScore,
          advisorsWithSales: num(row.advisors_with_sales),
          expectedAdvisors: Math.max(branchAdvisors.length, 1),
          monthlyConversionGoalPerAdvisor: scoreConfig.monthlyConversionGoalPerAdvisor,
          maxDiscountRate: scoreConfig.maxDiscountRate
        },
        scoreConfig
      );
      const directorCommission = calculateDirectorCommission(branchSalesValue, target);
      return {
        id: branchId,
        code: row.code,
        name: row.name,
        sales: branchSalesValue,
        transactionSales: num(row.sales),
        transactionDiff: branchSalesValue - num(row.sales),
        rows: num(row.rows_count),
        advisorsWithSales: num(row.advisors_with_sales),
        expectedAdvisors: branchAdvisors.length,
        target,
        score,
        directorCommission,
        previousMonthSales: previousSalesByBranch.get(branchId) ?? 0,
        previousMonthDelta: percentChange(branchSalesValue, previousSalesByBranch.get(branchId) ?? 0),
        previousMonthCutoffDay: previousCutoffDay
      };
    })
    .filter((branch) => {
      const isPlaceholderBranch = String(branch.name ?? "").trim().toUpperCase() === "SIN SEDE";
      return !isPlaceholderBranch || branch.sales > 0 || Boolean(branch.target);
    });
  const totalTarget = branches.reduce((sum, branch) => sum + (branch.target?.meta1 ?? 0), 0);
  const daysInSelectedMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  const plans = await all<AnyRow>(
    `SELECT
      p.id, p.name, p.category, p.cash_price, p.card_price, p.cost_per_month,
      p.source, p.active, p.external_id, p.membership_type, p.duration_type, p.duration,
      p.online_sales_url, p.description, p.external_sale_available, p.updated_at,
      COALESCE(SUM(s.value), 0) sales,
      COALESCE(AVG(NULLIF(s.value, 0)), 0) avg_ticket,
      COUNT(s.id) rows,
      COUNT(DISTINCT s.branch_id) branch_count
     FROM plans p
     LEFT JOIN sales s ON s.plan_id = p.id AND s.year = ? AND s.month = ?
     GROUP BY p.id
     ORDER BY p.active DESC, sales DESC, rows DESC, p.name`,
    [selectedYear, selectedMonth]
  );

  const branchPlanRows = await all<AnyRow>(
    `SELECT
       s.branch_id, p.id plan_id, p.name plan_name, p.category,
       COALESCE(SUM(s.value), 0) sales,
       COUNT(s.id) rows,
       COALESCE(AVG(NULLIF(s.value, 0)), 0) avg_ticket
     FROM sales s
     LEFT JOIN plans p ON p.id = s.plan_id
     WHERE s.year = ? AND s.month = ? AND s.branch_id IS NOT NULL AND p.id IS NOT NULL
     GROUP BY s.branch_id, p.id
     ORDER BY s.branch_id, sales DESC, rows DESC`,
    [selectedYear, selectedMonth]
  );
  const branchPlanMix = new Map<number, AnyRow[]>();
  for (const row of branchPlanRows) {
    const branchId = Number(row.branch_id);
    const bucket = branchPlanMix.get(branchId) ?? [];
    bucket.push({
      planId: Number(row.plan_id),
      name: row.plan_name,
      category: row.category,
      sales: num(row.sales),
      rows: num(row.rows),
      avgTicket: num(row.avg_ticket)
    });
    branchPlanMix.set(branchId, bucket);
  }

  const dailySalesRaw = await all<AnyRow>(
    `SELECT day, COALESCE(SUM(value), 0) sales, COUNT(*) rows
     FROM sales
     WHERE year = ? AND month = ?
     GROUP BY day
     ORDER BY day`,
    [selectedYear, selectedMonth]
  );
  const previousMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
  const previousMonthYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
  const previousDailySalesRaw = await all<AnyRow>(
    `SELECT day, COALESCE(SUM(value), 0) sales, COUNT(*) rows
     FROM sales
     WHERE year = ? AND month = ?
     GROUP BY day
     ORDER BY day`,
    [previousMonthYear, previousMonth]
  );
  const budgetByDay = dailyBudgetByDay(daysInSelectedMonth, totalTarget, sameMonthReferenceRows);
  const previousSalesByDay = new Map(
    previousDailySalesRaw.map((row) => [
      Number(row.day),
      {
        sales: num(row.sales),
        rows: num(row.rows)
      }
    ])
  );
  let actualAccumulated = 0;
  const dailySales = dailySalesRaw.map((row) => {
    const day = Number(row.day);
    const sales = num(row.sales);
    const budget = budgetByDay.get(day);
    actualAccumulated += sales;
    const budgetSales = budget?.budgetSales ?? 0;
    const budgetAccumulated = budget?.budgetAccumulated ?? 0;
    return {
      day,
      label: String(row.day).padStart(2, "0"),
      sales,
      rows: num(row.rows),
      previousMonthSales: previousSalesByDay.get(day)?.sales ?? 0,
      previousMonthRows: previousSalesByDay.get(day)?.rows ?? 0,
      previousMonth,
      previousMonthYear,
      budgetSales,
      budgetAccumulated,
      actualAccumulated,
      budgetDelta: budgetSales > 0 ? sales - budgetSales : null,
      budgetDeltaRate: budgetSales > 0 ? (sales - budgetSales) / budgetSales : null,
      accumulatedBudgetDelta: budgetAccumulated > 0 ? actualAccumulated - budgetAccumulated : null,
      accumulatedBudgetDeltaRate: budgetAccumulated > 0 ? (actualAccumulated - budgetAccumulated) / budgetAccumulated : null,
      budgetWeight: budget?.budgetWeight ?? 0,
      budgetSource: budget?.budgetSource ?? "lineal"
    };
  });
  const previousDailySales = previousDailySalesRaw.map((row) => ({
    day: Number(row.day),
    label: String(row.day).padStart(2, "0"),
    sales: num(row.sales),
    rows: num(row.rows),
    month: previousMonth,
    year: previousMonthYear
  }));
  const previousYearDailySales = previousYearDailySalesRaw.length
    ? previousYearDailySalesRaw.map((row) => ({
        day: Number(row.day),
        label: String(row.day).padStart(2, "0"),
        sales: num(row.sales),
        rows: num(row.rows),
        month: selectedMonth,
        year: previousYear,
        source: "sales"
      }))
    : seasonalityDailyRows(previousYear, selectedMonth);

  const monthlySales = await all<AnyRow>(
    `SELECT year, month, COALESCE(SUM(value), 0) sales, COUNT(*) rows
     FROM sales
     GROUP BY year, month
     ORDER BY year, month`
  );

  const paymentMethods = await all<AnyRow>(
    `SELECT payment_method name, COALESCE(SUM(value), 0) sales, COUNT(*) rows
     FROM sales
     WHERE year = ? AND month = ?
     GROUP BY payment_method
     ORDER BY sales DESC`,
    [selectedYear, selectedMonth]
  );
  const paymentMethodHistory = await all<AnyRow>(
    `SELECT
       year,
       month,
       COALESCE(NULLIF(TRIM(payment_method), ''), 'Sin medio') name,
       COALESCE(SUM(value), 0) sales,
       COUNT(*) rows
     FROM sales
     GROUP BY year, month, COALESCE(NULLIF(TRIM(payment_method), ''), 'Sin medio')
     ORDER BY year, month, sales DESC`
  );
  const memberEvolution = await buildMemberEvolutionState(selectedYear, selectedMonth);
  const growth = await buildIntelligentGrowth(selectedYear, selectedMonth);
  const trends = await buildSalesTrends(selectedYear, selectedMonth);
  const holidays = Object.fromEntries(colombianHolidaysForYear(selectedYear).map((item) => [item.date, item.name]));

  const marketing = await all<AnyRow>(
    `SELECT * FROM initiatives
     WHERE area = 'Marketing'
     ORDER BY created_at DESC
     LIMIT 120`
  );

  const initiatives = await all<AnyRow>(
    `SELECT * FROM initiatives
     WHERE area <> 'Marketing'
     ORDER BY created_at DESC
     LIMIT 120`
  );

  const todos = await all<AnyRow>("SELECT * FROM todos ORDER BY CASE priority WHEN 'Alta' THEN 1 WHEN 'Media' THEN 2 ELSE 3 END, due_date IS NULL, due_date");

  const competitorRows = await all<AnyRow>(
    `SELECT c.*, b.display_name branch_name
     FROM competitors c
     LEFT JOIN branches b ON b.id = c.branch_id
     WHERE c.active = 1
     ORDER BY c.zone, c.name`
  );
  const competitorSnapshotRows = await all<AnyRow>(
    "SELECT * FROM competitor_snapshots ORDER BY year DESC, month DESC, id DESC"
  );
  const snapshotsByCompetitor = new Map<number, AnyRow[]>();
  for (const row of competitorSnapshotRows) {
    const key = Number(row.competitor_id);
    if (!snapshotsByCompetitor.has(key)) snapshotsByCompetitor.set(key, []);
    snapshotsByCompetitor.get(key)!.push(row);
  }
  const nowDate = new Date();
  const competitors = competitorRows.map((competitor) => {
    const history = (snapshotsByCompetitor.get(Number(competitor.id)) ?? []).slice(0, 8).map((row): AnyRow => ({
      ...row,
      monthly_price: row.monthly_price === null ? null : num(row.monthly_price),
      enrollment_fee: row.enrollment_fee === null ? null : num(row.enrollment_fee),
      periodLabel: `${monthName(Number(row.month)).slice(0, 3)} ${row.year}`
    }));
    const latest = history[0] ?? null;
    const previous = history[1] ?? null;
    const monthsSinceUpdate = latest
      ? (nowDate.getFullYear() - Number(latest.year)) * 12 + (nowDate.getMonth() + 1 - Number(latest.month))
      : null;
    return {
      ...competitor,
      history,
      latest,
      priceDelta:
        latest && previous && latest.monthly_price !== null && previous.monthly_price !== null
          ? num(latest.monthly_price) - num(previous.monthly_price)
          : null,
      monthsSinceUpdate,
      stale: monthsSinceUpdate === null || monthsSinceUpdate > 3
    };
  });
  const imports = await all<AnyRow>("SELECT * FROM import_batches ORDER BY imported_at DESC LIMIT 8");
  const positiveCoverage = await get<AnyRow>(
    `SELECT
      MAX(sold_at) last_positive_sale,
      MAX(day) last_positive_day,
      COUNT(*) positive_rows,
      COALESCE(SUM(value), 0) positive_sales
     FROM sales
     WHERE year = ? AND month = ? AND value > 0`,
    [selectedYear, selectedMonth]
  );
  const zeroCoverage = await get<AnyRow>(
    `SELECT MAX(sold_at) last_zero_sale, MAX(day) last_zero_day, COUNT(*) zero_rows
     FROM sales
     WHERE year = ? AND month = ? AND value = 0`,
    [selectedYear, selectedMonth]
  );
  const latestImport = imports[0] ?? null;
  const lastPositiveDay = num(positiveCoverage?.last_positive_day);
  const pendingFromDay = lastPositiveDay > 0 && lastPositiveDay < daysInSelectedMonth ? lastPositiveDay + 1 : null;

  const totalSales = num(salesSummary?.total_sales);
  const memberEvolutionByBranch = new Map(memberEvolution.byBranch.map((row) => [Number(row.branchId), row]));
  const trackingCutoffDay = Math.max(1, Math.min(lastPositiveDay || Math.min(new Date().getDate(), daysInSelectedMonth), daysInSelectedMonth));
  const trackingCutoffDate = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(trackingCutoffDay).padStart(2, "0")}`;
  const liveBranchTrackingById = new Map(
    branches.map((branch) => [
      branch.id,
      liveTrackingRow({
        name: branch.name,
        target: branch.target,
        executed: branch.sales,
        cutoffDay: trackingCutoffDay,
        daysInMonth: daysInSelectedMonth
      })
    ])
  );
  const companyTarget = {
    activation: 0,
    bronze: 0,
    silver: 0,
    meta1: branches.reduce((sum, branch) => sum + num(branch.target?.meta1), 0),
    meta2: branches.reduce((sum, branch) => sum + num(branch.target?.meta2), 0),
    meta3: branches.reduce((sum, branch) => sum + num(branch.target?.meta3), 0),
    meta4: branches.reduce((sum, branch) => sum + num(branch.target?.meta4), 0),
    dailyMeta4: 0,
    weeklyMeta4: 0
  };
  const companyTracking = liveTrackingRow({
    name: "COMPAÑÍA",
    target: companyTarget,
    executed: totalSales,
    cutoffDay: trackingCutoffDay,
    daysInMonth: daysInSelectedMonth
  });
  const branchesWithPlanMix = branches.map((branch) => ({
    ...branch,
    planMix: (branchPlanMix.get(branch.id) ?? []).slice(0, 12),
    memberEvolution: memberEvolutionByBranch.get(branch.id) ?? null,
    tracking: (() => {
      const row = liveBranchTrackingById.get(branch.id);
      if (!row) return null;
      return {
        ...row,
        transactionSales: num(branch.sales),
        transactionDiff: row.executed - num(branch.sales),
        sourceFile: "Ventas transaccionales",
        cutoffDay: trackingCutoffDay,
        cutoffDate: trackingCutoffDate
      };
    })()
  }));
  const quality = await buildQualityReport(selectedYear, selectedMonth);
  const configuration = await buildConfigurationState(selectedYear, selectedMonth, quality);
  const recommendations = buildCommercialRecommendations({
    advisors,
    branches: branchesWithPlanMix,
    plans,
    kpis: {
      totalSales,
      totalTarget,
      targetProgress: totalTarget > 0 ? totalSales / totalTarget : 0
    }
  });
  const projection = await buildProjectionModel({
    year: selectedYear,
    month: selectedMonth,
    currentSales: totalSales,
    currentTarget: totalTarget,
    elapsedDays: Math.max(lastPositiveDay || Math.min(new Date().getDate(), daysInSelectedMonth), 1),
    daysInMonth: daysInSelectedMonth,
    remainingDays: Math.max(daysInSelectedMonth - Math.max(lastPositiveDay || Math.min(new Date().getDate(), daysInSelectedMonth), 1), 0),
    lastSaleDay: lastPositiveDay
  });
  const maxPlanSales = Math.max(...plans.map((plan) => num(plan.sales)), 0);
  const maxPlanRows = Math.max(...plans.map((plan) => num(plan.rows)), 0);

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      selectedYear,
      selectedMonth,
      selectedMonthName: monthName(selectedMonth),
      years: years.map((row) => Number(row.year)).filter(Boolean),
      dataCoverage: {
        lastPositiveSale: positiveCoverage?.last_positive_sale ?? null,
        lastPositiveDay: lastPositiveDay || null,
        positiveRows: num(positiveCoverage?.positive_rows),
        positiveSales: num(positiveCoverage?.positive_sales),
        lastZeroSale: zeroCoverage?.last_zero_sale ?? null,
        lastZeroDay: num(zeroCoverage?.last_zero_day) || null,
        zeroRows: num(zeroCoverage?.zero_rows),
        latestImport: latestImport
          ? {
              sourceType: latestImport.source_type,
              sourceFile: latestImport.source_file,
              rowsRead: num(latestImport.rows_read),
              rowsInserted: num(latestImport.rows_inserted),
              duplicatesSkipped: num(latestImport.duplicates_skipped),
              totalValue: num(latestImport.total_value),
              details: (() => {
                try {
                  return JSON.parse(String(latestImport.details || "{}"));
                } catch {
                  return {};
                }
              })(),
              importedAt: latestImport.imported_at
            }
          : null,
        pendingFromDay
      }
    },
    kpis: {
      totalSales,
      salesRows: num(salesSummary?.sales_rows),
      avgTicket: num(salesSummary?.avg_ticket),
      activeBranches: num(salesSummary?.active_branches),
      activeAdvisors: advisors.length,
      totalTarget,
      targetProgress: totalTarget > 0 ? totalSales / totalTarget : 0,
      totalAdvisorCommissions: advisors.reduce((sum, advisor) => sum + advisor.commission.finalCommission, 0),
      totalDirectorCommissions: branches.reduce((sum, branch) => sum + branch.directorCommission.bonus, 0),
      previous: previousKpis,
      deltas: {
        totalSales: percentChange(totalSales, previousKpis.totalSales),
        avgTicket: percentChange(num(salesSummary?.avg_ticket), previousKpis.avgTicket),
        targetProgress: percentChange(totalTarget > 0 ? totalSales / totalTarget : 0, previousKpis.targetProgress),
        projectedToDate: percentChange(companyTracking.projected, previousKpis.projectedToDate),
        trackingDiff: percentChange(companyTracking.diff, previousKpis.trackingDiff),
        totalAdvisorCommissions: percentChange(
          advisors.reduce((sum, advisor) => sum + advisor.commission.finalCommission, 0),
          previousKpis.totalAdvisorCommissions
        ),
        totalDirectorCommissions: percentChange(
          branches.reduce((sum, branch) => sum + branch.directorCommission.bonus, 0),
          previousKpis.totalDirectorCommissions
        )
      },
      averageAdvisorScore: advisors.filter((advisor) => advisor.score.score !== null).reduce((sum, advisor, _, arr) => sum + (advisor.score.score ?? 0) / arr.length, 0) || 0,
      averageBranchScore: branches.filter((branch) => branch.score.score !== null).reduce((sum, branch, _, arr) => sum + (branch.score.score ?? 0) / arr.length, 0) || 0,
      memberChurnDirect: memberEvolution.summary?.directChurn ?? 0,
      memberChurnGross: memberEvolution.summary?.grossChurn ?? 0,
      activeMembersStart: memberEvolution.summary?.activeStart ?? 0,
      activeMembersEnd: memberEvolution.summary?.activeEnd ?? 0,
      memberNetEvolution: memberEvolution.summary?.netEvolution ?? 0
    },
    commissionPolicy: {
      scheme: commissionScheme,
      label: commissionScheme === "historico_enero_junio_2026"
        ? "Bonificacion historica enero-junio 2026"
        : "Bonificacion 2026 por porcentaje de meta alcanzada",
      usesEvaluation: false
    },
    branches: branchesWithPlanMix,
    branchTracking: {
      year: selectedYear,
      month: selectedMonth,
      cutoffDay: trackingCutoffDay,
      cutoffDate: trackingCutoffDate,
      sourceFile: "Ventas transaccionales",
      company: {
        ...companyTracking,
        transactionSales: totalSales,
        transactionDiff: companyTracking.executed - totalSales
      }
    },
    advisors,
    plans: plans.map((plan) => {
      const sales = num(plan.sales);
      const rows = num(plan.rows);
      return {
        ...plan,
        sales,
        rows,
        score: comparativeScore(sales, maxPlanSales, rows, maxPlanRows),
        cash_price: plan.cash_price === null ? null : num(plan.cash_price),
        card_price: plan.card_price === null ? null : num(plan.card_price),
        cost_per_month: plan.cost_per_month === null ? null : num(plan.cost_per_month),
        avg_ticket: num(plan.avg_ticket),
        active: Number(plan.active ?? 1),
        duration: plan.duration === null ? null : num(plan.duration),
        branch_count: num(plan.branch_count),
        external_sale_available: num(plan.external_sale_available)
      };
    }),
    dailySales,
    previousDailySales,
    previousYearDailySales,
    monthlySales: monthlySales.map((row) => ({
      ...row,
      label: `${monthName(Number(row.month)).slice(0, 3)} ${row.year}`,
      sales: num(row.sales),
      rows: num(row.rows)
    })),
    paymentMethods: paymentMethods.map((row) => ({ ...row, sales: num(row.sales), rows: num(row.rows) })),
    paymentMethodHistory: paymentMethodHistory.map((row) => ({
      ...row,
      year: num(row.year),
      month: num(row.month),
      sales: num(row.sales),
      rows: num(row.rows)
    })),
    marketing,
    initiatives,
    todos,
    competitors,
    imports,
    quality,
    configuration,
    dataHealth: configuration.health,
    recommendations,
    projection,
    growth,
    trends,
    holidays,
    memberEvolution,
    settings: publicSettings(settingMap),
    boardReports: {
      byBranch: branches,
      byAdvisor: advisors.slice().sort((a, b) => b.sales - a.sales),
      byPlan: plans.slice(0, 25),
      byDay: dailySales
    }
  };
}

export async function buildQualityReport(year?: number, month?: number) {
  const where = year && month ? "WHERE year = ? AND month = ?" : "";
  const params = year && month ? [year, month] : undefined;
  const salesAliasWhere = year && month ? "WHERE s.year = ? AND s.month = ?" : "";
  const totals = await get<AnyRow>(
    `SELECT
      COUNT(*) total_rows,
      COUNT(DISTINCT sale_key) unique_sale_keys,
      SUM(CASE WHEN sale_key IS NULL OR sale_key = '' THEN 1 ELSE 0 END) missing_sale_keys
     FROM sales ${where}`,
    params
  );
  const duplicateGroups = await all<AnyRow>(
    `SELECT
       sale_key,
       COUNT(*) duplicates,
       MIN(sold_at) first_sold_at,
       MAX(sold_at) last_sold_at,
       SUM(value) duplicated_value
     FROM sales
     ${where}
     GROUP BY sale_key
     HAVING COUNT(*) > 1
     ORDER BY duplicates DESC, duplicated_value DESC
     LIMIT 50`,
    params
  );
  const naturalDuplicateGroups = await all<AnyRow>(
    `SELECT
       branch_id, advisor_id, plan_id, client_external_id, description, sold_at, value,
       COUNT(*) duplicates
     FROM sales
     ${where}
     GROUP BY branch_id, advisor_id, plan_id, client_external_id, description, sold_at, value
     HAVING COUNT(*) > 1
     ORDER BY duplicates DESC
     LIMIT 50`,
    params
  );
  const orphanSales = await get<AnyRow>(
    `SELECT
      SUM(CASE WHEN branch_id IS NULL THEN 1 ELSE 0 END) missing_branch,
      SUM(CASE WHEN advisor_id IS NULL THEN 1 ELSE 0 END) missing_advisor,
      SUM(CASE WHEN plan_id IS NULL THEN 1 ELSE 0 END) missing_plan,
      SUM(CASE WHEN value <= 0 THEN 1 ELSE 0 END) zero_value,
      SUM(CASE WHEN branch_id IS NULL AND value > 0 THEN 1 ELSE 0 END) missing_branch_positive,
      SUM(CASE WHEN advisor_id IS NULL AND value > 0 THEN 1 ELSE 0 END) missing_advisor_positive,
      SUM(CASE WHEN plan_id IS NULL AND value > 0 THEN 1 ELSE 0 END) missing_plan_positive
     FROM sales ${where}`,
    params
  );
  const supportAdvisorSales = await get<AnyRow>(
    `SELECT
       COUNT(*) rows_count,
       COALESCE(SUM(s.value), 0) sales
     FROM sales s
     LEFT JOIN advisors a ON a.id = s.advisor_id
     ${salesAliasWhere}
       ${salesAliasWhere ? "AND" : "WHERE"} s.value > 0
       AND (
         a.normalized_name IN ('SUPORTEEVO', 'SOPORTEEVO', 'SOPORTE EVO')
         OR UPPER(COALESCE(s.raw_json, '')) LIKE '%SUPORTEEVO%'
       )`,
    params
  );
  const unassignedAdvisorRows = await all<AnyRow>(
    `SELECT
       s.id,
       s.sold_at,
       s.value,
       s.description,
       s.client_external_id,
       s.client_name,
       s.client_last_name,
       s.source_type,
       s.source_file,
       b.display_name branch_name,
       p.name plan_name
     FROM sales s
     LEFT JOIN branches b ON b.id = s.branch_id
     LEFT JOIN plans p ON p.id = s.plan_id
     ${salesAliasWhere}
       ${salesAliasWhere ? "AND" : "WHERE"} s.value > 0
       AND s.advisor_id IS NULL
     ORDER BY s.value DESC, s.sold_at DESC
     LIMIT 30`,
    params
  );
  const unassignedAdvisorByBranch = await all<AnyRow>(
    `SELECT
       COALESCE(b.display_name, 'Sin sede') branch_name,
       COUNT(*) rows_count,
       COALESCE(SUM(s.value), 0) sales
     FROM sales s
     LEFT JOIN branches b ON b.id = s.branch_id
     ${salesAliasWhere}
       ${salesAliasWhere ? "AND" : "WHERE"} s.value > 0
       AND s.advisor_id IS NULL
     GROUP BY COALESCE(b.display_name, 'Sin sede')
     ORDER BY sales DESC
     LIMIT 12`,
    params
  );
  const unassignedAdvisorByPlan = await all<AnyRow>(
    `SELECT
       COALESCE(p.name, 'Sin plan') plan_name,
       COUNT(*) rows_count,
       COALESCE(SUM(s.value), 0) sales
     FROM sales s
     LEFT JOIN plans p ON p.id = s.plan_id
     ${salesAliasWhere}
       ${salesAliasWhere ? "AND" : "WHERE"} s.value > 0
       AND s.advisor_id IS NULL
     GROUP BY COALESCE(p.name, 'Sin plan')
     ORDER BY sales DESC
     LIMIT 12`,
    params
  );
  const issueCount =
    duplicateGroups.length +
    naturalDuplicateGroups.length +
    num(totals?.missing_sale_keys) +
    num(orphanSales?.missing_branch_positive) +
    num(orphanSales?.missing_advisor_positive) +
    num(orphanSales?.missing_plan_positive) +
    num(supportAdvisorSales?.rows_count);

  return {
    totalRows: num(totals?.total_rows),
    uniqueSaleKeys: num(totals?.unique_sale_keys),
    missingSaleKeys: num(totals?.missing_sale_keys),
    duplicateGroups: duplicateGroups.map((row) => ({
      saleKey: row.sale_key,
      duplicates: num(row.duplicates),
      firstSoldAt: row.first_sold_at,
      lastSoldAt: row.last_sold_at,
      duplicatedValue: num(row.duplicated_value)
    })),
    naturalDuplicateGroups: naturalDuplicateGroups.map((row) => ({
      ...row,
      duplicates: num(row.duplicates),
      value: num(row.value)
    })),
    orphanSales: {
      missingBranch: num(orphanSales?.missing_branch),
      missingAdvisor: num(orphanSales?.missing_advisor),
      missingPlan: num(orphanSales?.missing_plan),
      zeroValue: num(orphanSales?.zero_value),
      missingBranchPositive: num(orphanSales?.missing_branch_positive),
      missingAdvisorPositive: num(orphanSales?.missing_advisor_positive),
      missingPlanPositive: num(orphanSales?.missing_plan_positive),
      supportAdvisorPositiveRows: num(supportAdvisorSales?.rows_count),
      supportAdvisorPositiveSales: num(supportAdvisorSales?.sales),
      unassignedAdvisorRows: unassignedAdvisorRows.map((row) => ({
        id: num(row.id),
        soldAt: row.sold_at,
        value: num(row.value),
        description: row.description ?? "",
        clientExternalId: row.client_external_id ?? "",
        clientName: `${row.client_name ?? ""} ${row.client_last_name ?? ""}`.trim(),
        sourceType: row.source_type ?? "",
        sourceFile: row.source_file ?? "",
        branchName: row.branch_name ?? "Sin sede",
        planName: row.plan_name ?? "Sin plan"
      })),
      unassignedAdvisorByBranch: unassignedAdvisorByBranch.map((row) => ({
        branchName: row.branch_name,
        rows: num(row.rows_count),
        sales: num(row.sales)
      })),
      unassignedAdvisorByPlan: unassignedAdvisorByPlan.map((row) => ({
        planName: row.plan_name,
        rows: num(row.rows_count),
        sales: num(row.sales)
      }))
    },
    issueCount,
    status: issueCount === 0 ? "OK" : "Revisar"
  };
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function projectionConfidence(input: { elapsedDays: number; historySamples: number; dispersion: number; staleDays: number }) {
  let score = 40;
  if (input.elapsedDays >= 7) score += 20;
  if (input.elapsedDays >= 12) score += 10;
  if (input.historySamples >= 3) score += 20;
  if (input.historySamples >= 5) score += 5;
  if (input.dispersion <= 0.2) score += 10;
  if (input.dispersion > 0.35) score -= 15;
  if (input.staleDays > 1) score -= 15;
  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: bounded,
    label: bounded >= 75 ? "Alta" : bounded >= 55 ? "Media" : "Baja"
  };
}

async function buildProjectionModel(input: {
  year: number;
  month: number;
  currentSales: number;
  currentTarget: number;
  elapsedDays: number;
  daysInMonth: number;
  remainingDays: number;
  lastSaleDay: number;
}) {
  const historyRows = await all<AnyRow>(
    `SELECT
       month,
       COALESCE(SUM(value), 0) sales,
       COALESCE(SUM(CASE WHEN day <= ? THEN value ELSE 0 END), 0) partial_sales
     FROM sales
     WHERE year = ? AND month < ? AND value > 0
     GROUP BY month
     HAVING sales > 0 AND partial_sales > 0
     ORDER BY month`,
    [input.elapsedDays, input.year, input.month]
  );
  const rawRatios = historyRows.map((row) => num(row.partial_sales) / Math.max(num(row.sales), 1)).filter((ratio) => ratio > 0 && ratio < 1);
  const ratioMedian = percentile(rawRatios, 0.5);
  const filteredRatios = rawRatios.length >= 3
    ? rawRatios.filter((ratio) => ratio >= ratioMedian * 0.55 && ratio <= ratioMedian * 1.55)
    : rawRatios;
  const ratios = filteredRatios.length ? filteredRatios : rawRatios;
  const p25 = percentile(ratios, 0.25);
  const p50 = percentile(ratios, 0.5);
  const p75 = percentile(ratios, 0.75);
  const avg = ratios.length ? ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length : 0;
  const dispersion = avg > 0 && ratios.length
    ? Math.sqrt(ratios.reduce((sum, ratio) => sum + Math.pow(ratio - avg, 2), 0) / ratios.length) / avg
    : 1;
  const linearProjectedClose = input.currentSales > 0 ? (input.currentSales / input.elapsedDays) * input.daysInMonth : 0;
  const historicalProjectedClose = p50 > 0 ? input.currentSales / p50 : 0;
  const recommendedProjectedClose = historicalProjectedClose || linearProjectedClose;
  const conservativeProjectedClose = p75 > 0 ? input.currentSales / p75 : linearProjectedClose * 0.9;
  const optimisticProjectedClose = p25 > 0 ? input.currentSales / p25 : linearProjectedClose * 1.1;
  const today = new Date();
  const isSelectedCurrentMonth = today.getFullYear() === input.year && today.getMonth() + 1 === input.month;
  const expectedLoadedDay = isSelectedCurrentMonth ? Math.min(today.getDate() - 1, input.daysInMonth) : input.daysInMonth;
  const staleDays = Math.max(expectedLoadedDay - input.lastSaleDay, 0);
  const confidence = projectionConfidence({
    elapsedDays: input.elapsedDays,
    historySamples: ratios.length,
    dispersion,
    staleDays
  });

  return {
    sales: input.currentSales,
    target: input.currentTarget,
    elapsedDays: input.elapsedDays,
    daysInMonth: input.daysInMonth,
    remainingDays: input.remainingDays,
    dailyAverage: input.currentSales / input.elapsedDays,
    projectedClose: recommendedProjectedClose,
    linearProjectedClose,
    historicalProjectedClose,
    conservativeProjectedClose: Math.min(conservativeProjectedClose || recommendedProjectedClose, optimisticProjectedClose || recommendedProjectedClose),
    optimisticProjectedClose: Math.max(conservativeProjectedClose || recommendedProjectedClose, optimisticProjectedClose || recommendedProjectedClose),
    currentGap: Math.max(input.currentTarget - input.currentSales, 0),
    projectedGap: input.currentTarget ? input.currentTarget - recommendedProjectedClose : 0,
    requiredDaily: input.remainingDays > 0 ? Math.max(input.currentTarget - input.currentSales, 0) / input.remainingDays : 0,
    progress: input.currentTarget > 0 ? input.currentSales / input.currentTarget : 0,
    projectedProgress: input.currentTarget > 0 ? recommendedProjectedClose / input.currentTarget : 0,
    confidence,
    history: {
      samples: ratios.length,
      rawSamples: rawRatios.length,
      medianShare: p50,
      conservativeShare: p75,
      optimisticShare: p25,
      dispersion,
      staleDays,
      method: ratios.length >= 2 ? "historico_ajustado" : "ritmo_lineal"
    }
  };
}

export async function buildManagerReport(year: number, month: number) {
  const state = await buildAppState(year, month);
  const annualSummary = await get<AnyRow>(
    `SELECT
      COALESCE(SUM(value), 0) total_sales,
      COUNT(*) sales_rows,
      COUNT(DISTINCT branch_id) active_branches,
      COUNT(DISTINCT advisor_id) active_advisors,
      AVG(NULLIF(value, 0)) avg_ticket
     FROM sales
     WHERE year = ?`,
    [year]
  );

  const monthlyRows = await all<AnyRow>(
    `SELECT month, COALESCE(SUM(value), 0) sales, COUNT(*) rows, AVG(NULLIF(value, 0)) avg_ticket
     FROM sales
     WHERE year = ?
     GROUP BY month
     ORDER BY month`,
    [year]
  );
  const monthlyTargets = await all<AnyRow>(
    `SELECT month, COALESCE(SUM(branch_meta1), 0) target
     FROM monthly_targets
     WHERE year = ?
     GROUP BY month`,
    [year]
  );
  const targetByMonth = new Map(monthlyTargets.map((row) => [Number(row.month), num(row.target)]));
  const salesByMonth = new Map(monthlyRows.map((row) => [Number(row.month), row]));
  const monthlyTrend = Array.from({ length: 12 }, (_, index) => {
    const monthNumberValue = index + 1;
    const row = salesByMonth.get(monthNumberValue);
    const sales = num(row?.sales);
    const target = targetByMonth.get(monthNumberValue) ?? 0;
    return {
      month: monthNumberValue,
      label: monthName(monthNumberValue),
      sales,
      rows: num(row?.rows),
      avgTicket: num(row?.avg_ticket),
      target,
      progress: target > 0 ? sales / target : 0
    };
  });

  const branchTargets = await all<AnyRow>(
    `SELECT branch_id, COALESCE(SUM(branch_meta1), 0) annual_meta1, COALESCE(SUM(branch_meta4), 0) annual_meta4
     FROM monthly_targets
     WHERE year = ?
     GROUP BY branch_id`,
    [year]
  );
  const branchTargetById = new Map(branchTargets.map((row) => [
    Number(row.branch_id),
    { annualMeta1: num(row.annual_meta1), annualMeta4: num(row.annual_meta4) }
  ]));

  const branchRows = await all<AnyRow>(
    `SELECT b.id, b.display_name name, COALESCE(SUM(s.value), 0) sales, COUNT(s.id) rows
     FROM branches b
     LEFT JOIN sales s ON s.branch_id = b.id AND s.year = ?
     WHERE b.active = 1${branchVisibilitySql(year, month, "b")}
     GROUP BY b.id
     ORDER BY sales DESC, b.display_name`,
    [year]
  );
  const currentBranchById = new Map(state.branches.map((branch: AnyRow) => [Number(branch.id), branch]));
  const branchMonthlyRows = await all<AnyRow>(
    `SELECT b.id branch_id, s.month, COALESCE(SUM(s.value), 0) sales
     FROM branches b
     LEFT JOIN sales s ON s.branch_id = b.id AND s.year = ? AND s.month <= ?
     WHERE b.active = 1${branchVisibilitySql(year, month, "b")}
     GROUP BY b.id, s.month`,
    [year, month]
  );
  const branchMonthly: Record<string, Record<string, number>> = {};
  for (const row of branchMonthlyRows) {
    const branchId = String(row.branch_id);
    const monthKey = String(row.month);
    if (!branchMonthly[branchId]) branchMonthly[branchId] = {};
    branchMonthly[branchId][monthKey] = num(row.sales);
  }
  const annualByBranch = branchRows.map((row) => {
    const id = Number(row.id);
    const sales = num(row.sales);
    const target = branchTargetById.get(id) ?? { annualMeta1: 0, annualMeta4: 0 };
    const current = currentBranchById.get(id);
    return {
      id,
      name: row.name,
      sales,
      rows: num(row.rows),
      annualTarget: target.annualMeta1,
      annualProgress: target.annualMeta1 > 0 ? sales / target.annualMeta1 : 0,
      monthlySales: current?.sales ?? 0,
      score: current?.score ?? { score: null, status: "Pendiente" }
    };
  });

  const advisorRows = await all<AnyRow>(
    `SELECT a.id, a.name, b.display_name branch_name, COALESCE(SUM(s.value), 0) sales, COUNT(s.id) rows
     FROM advisors a
     LEFT JOIN branches b ON b.id = a.branch_id
     LEFT JOIN sales s ON s.advisor_id = a.id AND s.year = ?
     WHERE a.active = 1 AND a.excluded_from_commissions = 0${removedAdvisorFilterSql(year, month)}
     GROUP BY a.id
     ORDER BY sales DESC, a.name`,
    [year, ...removedAdvisorFilterParams(year, month)]
  );
  const currentAdvisorById = new Map(state.advisors.map((advisor: AnyRow) => [Number(advisor.id), advisor]));
  const annualByAdvisor = advisorRows.map((row) => {
    const id = Number(row.id);
    const current = currentAdvisorById.get(id);
    return {
      id,
      name: row.name,
      branchName: row.branch_name ?? current?.branchName ?? "Sin sede",
      sales: num(row.sales),
      rows: num(row.rows),
      monthlySales: current?.sales ?? 0,
      score: current?.score ?? { score: null, status: "Pendiente" },
      commission: current?.commission ?? null
    };
  });

  const planRows = await all<AnyRow>(
    `SELECT p.id, p.name, p.category, COALESCE(SUM(s.value), 0) sales, COUNT(s.id) rows, COUNT(DISTINCT s.branch_id) branch_count
     FROM plans p
     LEFT JOIN sales s ON s.plan_id = p.id AND s.year = ?
     GROUP BY p.id
     ORDER BY sales DESC, rows DESC, p.name
     LIMIT 80`,
    [year]
  );
  const maxAnnualPlanSales = Math.max(...planRows.map((plan) => num(plan.sales)), 0);
  const maxAnnualPlanRows = Math.max(...planRows.map((plan) => num(plan.rows)), 0);
  const annualByPlan = planRows.map((row) => {
    const sales = num(row.sales);
    const rows = num(row.rows);
    const current = state.plans.find((plan: AnyRow) => Number(plan.id) === Number(row.id));
    return {
      id: Number(row.id),
      name: row.name,
      category: row.category,
      sales,
      rows,
      branchCount: num(row.branch_count),
      monthlySales: current?.sales ?? 0,
      score: comparativeScore(sales, maxAnnualPlanSales, rows, maxAnnualPlanRows)
    };
  });

  const unassignedSales = await scalar<number>(
    `SELECT COALESCE(SUM(value), 0)
     FROM sales
     WHERE year = ? AND month <= ? AND advisor_id IS NULL AND value > 0`,
    [year, month]
  );
  const supportEvoSales = await scalar<number>(
    `SELECT COALESCE(SUM(s.value), 0)
     FROM sales s
     JOIN advisors a ON a.id = s.advisor_id
     WHERE s.year = ?
       AND s.month <= ?
       AND s.value > 0
       AND UPPER(a.normalized_name) LIKE '%SUPORTEEVO%'`,
    [year, month]
  );

  const topDays = state.dailySales
    .slice()
    .sort((a: AnyRow, b: AnyRow) => num(b.sales) - num(a.sales))
    .slice(0, 6);
  const weakDays = state.dailySales
    .filter((row: AnyRow) => num(row.sales) > 0)
    .slice()
    .sort((a: AnyRow, b: AnyRow) => num(a.sales) - num(b.sales))
    .slice(0, 6);
  const daysInSelectedMonth = new Date(year, month, 0).getDate();
  const lastSaleDay = Math.max(...state.dailySales.filter((row: AnyRow) => num(row.sales) > 0).map((row: AnyRow) => num(row.day)), 0);
  const elapsedDays = Math.max(lastSaleDay || Math.min(new Date().getDate(), daysInSelectedMonth), 1);
  const currentMonthSales = num(state.kpis.totalSales);
  const currentMonthTarget = num(state.kpis.totalTarget);
  const remainingDays = Math.max(daysInSelectedMonth - elapsedDays, 0);
  const monthProjection = await buildProjectionModel({
    year,
    month,
    currentSales: currentMonthSales,
    currentTarget: currentMonthTarget,
    elapsedDays,
    daysInMonth: daysInSelectedMonth,
    remainingDays,
    lastSaleDay
  });
  const recommendedProjectionFactor = currentMonthSales > 0 ? num(monthProjection.projectedClose) / currentMonthSales : daysInSelectedMonth / elapsedDays;

  const branchGoalRows = state.branches
    .filter((branch: AnyRow) => branch.target)
    .map((branch: AnyRow) => {
      const sales = num(branch.sales);
      const target = num(branch.target?.meta1);
      const linearProjected = sales > 0 ? (sales / elapsedDays) * daysInSelectedMonth : 0;
      const projected = sales > 0 ? sales * recommendedProjectionFactor : 0;
      return {
        id: Number(branch.id),
        name: branch.name,
        sales,
        target,
        gap: Math.max(target - sales, 0),
        progress: target > 0 ? sales / target : 0,
        projectedClose: projected,
        linearProjectedClose: linearProjected,
        projectedGap: target ? target - projected : 0,
        requiredDaily: remainingDays > 0 ? Math.max(target - sales, 0) / remainingDays : 0,
        score: branch.score,
        directorCommission: branch.directorCommission
      };
    })
    .sort((a: AnyRow, b: AnyRow) => num(a.progress) - num(b.progress));

  const advisorLevelMap = new Map<string, { level: string; advisors: number; sales: number; commissions: number }>();
  for (const advisor of state.advisors) {
    const level = advisor.commission?.level ?? "Sin comision";
    const bucket = advisorLevelMap.get(level) ?? { level, advisors: 0, sales: 0, commissions: 0 };
    bucket.advisors += 1;
    bucket.sales += num(advisor.sales);
    bucket.commissions += num(advisor.commission?.finalCommission);
    advisorLevelMap.set(level, bucket);
  }
  const levelOrder = ["Sin venta", "Sin comision", "Activacion", "Bronce", "Plata", "Meta 1", "Meta 2", "Meta 3", "Meta 4"];
  const advisorLevelDistribution = Array.from(advisorLevelMap.values()).sort(
    (a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level)
  );

  const planFamilyMap = new Map<string, { family: string; sales: number; rows: number; plans: number }>();
  for (const plan of state.plans as AnyRow[]) {
    const sales = num(plan.sales);
    const rows = num(plan.rows);
    if (sales <= 0 && rows <= 0) continue;
    const family = planFamily(plan.name);
    const bucket = planFamilyMap.get(family) ?? { family, sales: 0, rows: 0, plans: 0 };
    bucket.sales += sales;
    bucket.rows += rows;
    bucket.plans += 1;
    planFamilyMap.set(family, bucket);
  }
  const planFamilyMix = Array.from(planFamilyMap.values()).sort((a, b) => b.sales - a.sales);
  const planFamilyTotal = planFamilyMix.reduce((sum, row) => sum + row.sales, 0);
  for (const row of planFamilyMix) {
    (row as AnyRow).share = planFamilyTotal > 0 ? row.sales / planFamilyTotal : 0;
  }

  const branchPlanCurrentRows = await all<AnyRow>(
    `SELECT b.id branch_id, b.display_name branch_name, p.id plan_id, p.name plan_name,
      COALESCE(SUM(s.value), 0) sales, COUNT(s.id) rows, COALESCE(AVG(NULLIF(s.value, 0)), 0) avg_ticket
     FROM sales s
     JOIN branches b ON b.id = s.branch_id
     LEFT JOIN plans p ON p.id = s.plan_id
     WHERE s.year = ? AND s.month = ? AND s.value > 0
     GROUP BY b.id, p.id
     ORDER BY b.display_name, sales DESC, rows DESC`,
    [year, month]
  );
  const branchPlanBuckets = new Map<number, AnyRow[]>();
  for (const row of branchPlanCurrentRows) {
    const branchId = Number(row.branch_id);
    const bucket = branchPlanBuckets.get(branchId) ?? [];
    bucket.push({
      branchId,
      branchName: row.branch_name,
      planId: Number(row.plan_id),
      planName: row.plan_name ?? "Sin plan",
      sales: num(row.sales),
      rows: num(row.rows),
      avgTicket: num(row.avg_ticket)
    });
    branchPlanBuckets.set(branchId, bucket);
  }
  const topPlansByBranch = Array.from(branchPlanBuckets.values()).map((bucket) => {
    const topRevenue = bucket.slice().sort((a, b) => num(b.sales) - num(a.sales))[0];
    const topRows = bucket.slice().sort((a, b) => num(b.rows) - num(a.rows))[0];
    return {
      branchId: topRevenue.branchId,
      branchName: topRevenue.branchName,
      topRevenuePlan: topRevenue.planName,
      topRevenueSales: topRevenue.sales,
      topRevenueRows: topRevenue.rows,
      topVolumePlan: topRows.planName,
      topVolumeRows: topRows.rows,
      topVolumeSales: topRows.sales
    };
  });

  const weekdayLabels = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];
  const weekdayMap = new Map<number, { weekday: string; sales: number; rows: number; activeDays: number }>();
  for (const row of state.dailySales) {
    const day = num(row.day);
    if (!day) continue;
    const weekdayIndex = new Date(year, month - 1, day).getDay();
    const bucket = weekdayMap.get(weekdayIndex) ?? { weekday: weekdayLabels[weekdayIndex], sales: 0, rows: 0, activeDays: 0 };
    bucket.sales += num(row.sales);
    bucket.rows += num(row.rows);
    if (num(row.sales) > 0) bucket.activeDays += 1;
    weekdayMap.set(weekdayIndex, bucket);
  }
  const weekdayPerformance = Array.from(weekdayMap.values()).map((row) => ({
    ...row,
    avgSales: row.activeDays > 0 ? row.sales / row.activeDays : 0,
    avgRows: row.activeDays > 0 ? row.rows / row.activeDays : 0
  }));

  const commissionSummary = {
    advisorCommissions: num(state.kpis.totalAdvisorCommissions),
    directorCommissions: num(state.kpis.totalDirectorCommissions),
    totalCommissions: num(state.kpis.totalAdvisorCommissions) + num(state.kpis.totalDirectorCommissions),
    commissionRate: currentMonthSales > 0
      ? (num(state.kpis.totalAdvisorCommissions) + num(state.kpis.totalDirectorCommissions)) / currentMonthSales
      : 0
  };

  return {
    state,
    annual: {
      totalSales: num(annualSummary?.total_sales),
      salesRows: num(annualSummary?.sales_rows),
      activeBranches: num(annualSummary?.active_branches),
      activeAdvisors: num(annualSummary?.active_advisors),
      avgTicket: num(annualSummary?.avg_ticket)
    },
    dailyTrend: state.dailySales,
    monthlyTrend,
    branchMonthly,
    annualByBranch,
    annualByAdvisor,
    annualByPlan,
    unassignedSales: num(unassignedSales),
    supportEvoSales: num(supportEvoSales),
    topDays,
    weakDays,
    monthlyInsights: {
      monthProjection,
      branchGoalRows,
      advisorLevelDistribution,
      planFamilyMix,
      topPlansByBranch,
      weekdayPerformance,
      commissionSummary,
      paymentMethods: state.paymentMethods,
      memberEvolution: state.memberEvolution,
      churnSummary: state.memberEvolution?.summary ?? null,
      churnByBranch: state.memberEvolution?.byBranch ?? []
    }
  };
}

function previousPeriod(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function planFamily(name: string) {
  const value = normalizeKey(name);
  if (value.includes("DUO")) return "Duo";
  if (value.includes("CORPORATIVO")) return "Corporativo";
  if (value.includes("HORA VALLE")) return "Hora valle";
  if (value.includes("WEB")) return "Web";
  if (value.includes("2 SESIONES")) return "Con sesiones";
  if (value.includes("MES")) return "Mensual/base";
  if (["TRIMESTRE", "BIMESTRE", "SEMESTRE", "ANUAL", "13 MESES", "14 MESES", "4 MESES", "5 MESES", "7 MESES"].some((token) => value.includes(token))) {
    return "Duracion larga";
  }
  return "Otros";
}

async function periodSourceVersion(year: number, month: number) {
  const row = await get<AnyRow>(
    `SELECT
      COUNT(*) rows_count,
      COALESCE(SUM(value), 0) sales,
      COALESCE(MAX(id), 0) max_id,
      COALESCE(MAX(created_at), '') last_created_at
     FROM sales
     WHERE year = ? AND month = ?`,
    [year, month]
  );
  return JSON.stringify({
    rows: num(row?.rows_count),
    sales: Math.round(num(row?.sales)),
    maxId: num(row?.max_id),
    lastCreatedAt: row?.last_created_at ?? ""
  });
}

async function readMetricCache<T>(cacheKey: string, sourceVersion: string) {
  const cached = await get<{ payload: string; source_version: string }>(
    "SELECT payload, source_version FROM metric_cache WHERE cache_key = ?",
    [cacheKey]
  );
  if (!cached || cached.source_version !== sourceVersion) return null;
  try {
    return JSON.parse(cached.payload) as T;
  } catch {
    return null;
  }
}

async function writeMetricCache(cacheKey: string, year: number, month: number, sourceVersion: string, payload: unknown) {
  await run(
    `INSERT INTO metric_cache (cache_key, year, month, source_version, payload, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(cache_key) DO UPDATE SET
       year=excluded.year,
       month=excluded.month,
       source_version=excluded.source_version,
       payload=excluded.payload,
       updated_at=CURRENT_TIMESTAMP`,
    [cacheKey, year, month, sourceVersion, JSON.stringify(payload)]
  );
}

async function buildIntelligentGrowth(year: number, month: number) {
  const cacheKey = `growth:${year}-${String(month).padStart(2, "0")}`;
  const sourceVersion = await periodSourceVersion(year, month);
  const cached = await readMetricCache<AnyRow>(cacheKey, sourceVersion);
  if (cached) return cached;

  const previous = previousPeriod(year, month);
  const previousClientRows = await all<AnyRow>(
    `SELECT DISTINCT client_external_id client
     FROM sales
     WHERE year = ? AND month = ? AND value > 0 AND client_external_id IS NOT NULL AND client_external_id <> ''`,
    [previous.year, previous.month]
  );
  const currentClientRows = await all<AnyRow>(
    `SELECT s.client_external_id client, s.branch_id, b.display_name branch, s.advisor_id, a.name advisor, COALESCE(SUM(s.value), 0) revenue
     FROM sales s
     LEFT JOIN branches b ON b.id = s.branch_id
     LEFT JOIN advisors a ON a.id = s.advisor_id
     WHERE s.year = ? AND s.month = ? AND s.value > 0 AND s.client_external_id IS NOT NULL AND s.client_external_id <> ''
     GROUP BY s.client_external_id, s.branch_id, s.advisor_id`,
    [year, month]
  );

  const previousClientSet = new Set(previousClientRows.map((row) => String(row.client)));
  const currentRevenueByClient = new Map<string, number>();
  for (const row of currentClientRows) {
    const client = String(row.client);
    currentRevenueByClient.set(client, (currentRevenueByClient.get(client) ?? 0) + num(row.revenue));
  }
  const currentClients = currentRevenueByClient.size;
  const previousClients = previousClientSet.size;
  const selectedRevenue = Array.from(currentRevenueByClient.values()).reduce((sum, value) => sum + value, 0);
  const retainedClientSet = new Set(Array.from(currentRevenueByClient.keys()).filter((client) => previousClientSet.has(client)));
  const retainedClients = retainedClientSet.size;
  const retainedRevenue = Array.from(retainedClientSet).reduce((sum, client) => sum + (currentRevenueByClient.get(client) ?? 0), 0);
  const lostClients = Math.max(previousClients - retainedClients, 0);
  const retentionRate = previousClients > 0 ? retainedClients / previousClients : 0;

  const branchMap = new Map<string, { branch: string; clients: Set<string>; revenue: number }>();
  const advisorMap = new Map<string, { advisor: string; branch: string; clients: Set<string>; revenue: number }>();
  for (const row of currentClientRows) {
    const client = String(row.client);
    if (!retainedClientSet.has(client)) continue;
    const branch = row.branch || "Sin sede";
    const branchBucket = branchMap.get(branch) ?? { branch, clients: new Set<string>(), revenue: 0 };
    branchBucket.clients.add(client);
    branchBucket.revenue += num(row.revenue);
    branchMap.set(branch, branchBucket);

    const advisor = row.advisor || "Sin asesor";
    const advisorKey = advisor + "|" + branch;
    const advisorBucket = advisorMap.get(advisorKey) ?? { advisor, branch, clients: new Set<string>(), revenue: 0 };
    advisorBucket.clients.add(client);
    advisorBucket.revenue += num(row.revenue);
    advisorMap.set(advisorKey, advisorBucket);
  }
  const retainedByBranch = Array.from(branchMap.values())
    .map((item) => ({ branch: item.branch, clients: item.clients.size, revenue: item.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 12);
  const retainedByAdvisor = Array.from(advisorMap.values())
    .map((item) => ({ advisor: item.advisor, branch: item.branch, clients: item.clients.size, revenue: item.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  const planRows = await all<AnyRow>(
    `SELECT p.id, p.name, p.category, p.cash_price, p.card_price, p.cost_per_month,
       COUNT(s.id) rows, COUNT(DISTINCT s.client_external_id) clients, COALESCE(SUM(s.value), 0) revenue, AVG(NULLIF(s.value, 0)) avg_ticket
     FROM plans p
     LEFT JOIN sales s ON s.plan_id = p.id AND s.year = ? AND s.month = ? AND s.value > 0
     GROUP BY p.id
     HAVING revenue > 0
     ORDER BY revenue DESC`,
    [year, month]
  );

  const familyMap = new Map<string, { family: string; rows: number; clients: number; revenue: number; avgTicketNumerator: number }>();
  for (const row of planRows) {
    const family = planFamily(row.name);
    const current = familyMap.get(family) ?? { family, rows: 0, clients: 0, revenue: 0, avgTicketNumerator: 0 };
    current.rows += num(row.rows);
    current.clients += num(row.clients);
    current.revenue += num(row.revenue);
    current.avgTicketNumerator += num(row.avg_ticket) * num(row.rows);
    familyMap.set(family, current);
  }
  const planFamilies = Array.from(familyMap.values())
    .map((item) => ({
      family: item.family,
      rows: item.rows,
      clients: item.clients,
      revenue: item.revenue,
      avgTicket: item.rows > 0 ? item.avgTicketNumerator / item.rows : 0
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const findPlan = (matcher: (name: string) => boolean) => planRows.find((plan) => matcher(normalizeKey(plan.name))) ?? null;
  const monthPlan = findPlan((name) => name === "MES");
  const twoDayPlan = findPlan((name) => name.includes("2 DIAS"));
  const duoPlan = findPlan((name) => name.includes("DUO") && name.includes("6 MESES"));
  const valleyPlan = findPlan((name) => name.includes("HORA VALLE"));
  const corporatePlan = findPlan((name) => name.includes("CORPORATIVO"));

  const avgRevenuePerClient = currentClients > 0 ? selectedRevenue / currentClients : 0;

  const monthClients = num(monthPlan?.clients);
  const monthAvg = num(monthPlan?.avg_ticket) || num(monthPlan?.cash_price) || avgRevenuePerClient;
  const twoDayClients = num(twoDayPlan?.clients);
  const twoDayAvg = num(twoDayPlan?.avg_ticket) || num(twoDayPlan?.cash_price) || 0;
  const duoAvg = num(duoPlan?.avg_ticket) || num(duoPlan?.cash_price) || 379500;
  const valleyPrice = num(valleyPlan?.cash_price) || 85000;
  const corporatePrice = num(corporatePlan?.cash_price) || 79000;

  const simulator = [
    {
      id: "upgrade_mes_duo",
      name: "Upgrade MES a DUO 6 meses",
      assumption: "Convertir 5% de clientes MES al ticket promedio DUO 6 meses",
      segment: "Clientes MES",
      baseClients: monthClients,
      impact: Math.round(monthClients * 0.05 * Math.max(duoAvg - monthAvg, 0))
    },
    {
      id: "hora_valle",
      name: "Hora valle desde 2 DIAS",
      assumption: "Convertir 10% de 2 DIAS y sumar 50 nuevos miembros hora valle",
      segment: "2 DIAS + nuevos",
      baseClients: twoDayClients,
      impact: Math.round(twoDayClients * 0.1 * Math.max(valleyPrice - twoDayAvg, 0) + 50 * valleyPrice)
    },
    {
      id: "corporativo",
      name: "Paquete corporativo",
      assumption: "150 nuevos corporativos con 20% de canibalizacion de MES",
      segment: "Empresas",
      baseClients: 150,
      impact: Math.round(150 * corporatePrice - 30 * monthAvg)
    },
    {
      id: "retention_lift",
      name: "Mejorar recompra 3 puntos",
      assumption: "Subir la recompra proxy del mes anterior en 3 puntos porcentuales",
      segment: "Clientes no recomprados",
      baseClients: previousClients,
      impact: Math.round(previousClients * 0.03 * avgRevenuePerClient)
    },
    {
      id: "pt_upsell",
      name: "Entrenamiento personal",
      assumption: "Vender ticket de $109.000 al 5% de clientes del mes",
      segment: "Clientes activos",
      baseClients: currentClients,
      impact: Math.round(currentClients * 0.05 * 109000)
    },
    {
      id: "wellness_bundle",
      name: "Nutricion + clases premium + merchandise",
      assumption: "Nutricion 3%, clases premium 8% y merchandise 5%",
      segment: "Clientes activos",
      baseClients: currentClients,
      impact: Math.round(currentClients * 0.03 * 69000 + currentClients * 0.08 * 35000 + currentClients * 0.05 * 45000)
    }
  ];

  const opportunities = [
    {
      title: "Convertir MES recurrente a planes largos o DUO",
      segment: "MES",
      clients: monthClients,
      currentTicket: monthAvg,
      targetTicket: duoAvg,
      potential: simulator[0].impact,
      action: "Priorizar clientes MES que ya compraron mas de una vez y ofrecer DUO, trimestre o semestre."
    },
    {
      title: "Mover 2 DIAS hacia HORA VALLE",
      segment: "2 DIAS",
      clients: twoDayClients,
      currentTicket: twoDayAvg,
      targetTicket: valleyPrice,
      potential: simulator[1].impact,
      action: "Usar 2 DIAS como producto de entrada y cerrar membresia de horario valle antes de ampliar descuentos."
    },
    {
      title: "Abrir paquete corporativo por sede",
      segment: "Empresas",
      clients: 150,
      currentTicket: monthAvg,
      targetTicket: corporatePrice,
      potential: simulator[2].impact,
      action: "Asignar prospeccion semanal por sede y medir ventas corporativas separadas de planes base."
    },
    {
      title: "Monetizar servicios premium no capturados",
      segment: "Upsell",
      clients: currentClients,
      currentTicket: 0,
      targetTicket: 109000,
      potential: simulator[4].impact + simulator[5].impact,
      action: "Separar entrenamiento, nutricion, clases premium y merchandise como productos para medir adopcion real."
    }
  ];

  const ltvScenarios = [0.25, 0.2, 0.15, 0.1].map((monthlyChurn) => ({
    monthlyChurn,
    revenueLtv: monthlyChurn > 0 ? Math.round(avgRevenuePerClient / monthlyChurn) : 0,
    grossLtv60: monthlyChurn > 0 ? Math.round((avgRevenuePerClient * 0.6) / monthlyChurn) : 0,
    cacTarget3x: monthlyChurn > 0 ? Math.round(((avgRevenuePerClient * 0.6) / monthlyChurn) / 3) : 0
  }));

  const recommendations = [
    retainedClients > 0
      ? {
          priority: "Alta",
          title: "Premiar y replicar recompra por asesor",
          detail: "La recompra proxy es " + Math.round(retentionRate * 100) + "%. Usar el guion de los asesores con mayor recompra antes de aumentar descuentos.",
          metric: retainedClients + " clientes recompraron"
        }
      : {
          priority: "Alta",
          title: "Activar medicion de recompra",
          detail: "No hay recompra visible para el filtro. Validar si el periodo esta incompleto o si las ventas no tienen cliente externo.",
          metric: previousClients + " clientes en el mes anterior"
        },
    {
      priority: "Alta",
      title: "Lanzar piloto de upgrades MES",
      detail: "El plan MES concentra " + monthClients + " clientes. Un piloto de 5% hacia DUO/planes largos simula " + compactCurrency(simulator[0].impact) + " adicionales.",
      metric: monthClients + " candidatos MES"
    },
    {
      priority: "Media",
      title: "Convertir compradores de 2 DIAS",
      detail: "Hay " + twoDayClients + " clientes en 2 DIAS. Hora valle permite subir permanencia sin romper precio base.",
      metric: compactCurrency(simulator[1].impact) + " potencial simulado"
    },
    {
      priority: "Media",
      title: "Crear SKUs de upsell",
      detail: "La base actual casi no separa entrenamiento, nutricion, clases premium ni merchandise. Sin SKU separado no se puede medir adopcion ni margen.",
      metric: compactCurrency(simulator[4].impact + simulator[5].impact) + " potencial simulado"
    }
  ];

  const result = {
    period: { year, month, previousYear: previous.year, previousMonth: previous.month },
    retention: {
      previousClients,
      currentClients,
      retainedClients,
      lostClients,
      retentionRate,
      churnProxy: previousClients > 0 ? lostClients / previousClients : 0,
      retainedRevenue,
      avgRevenuePerClient,
      byBranch: retainedByBranch.map((row) => ({ branch: row.branch || "Sin sede", clients: num(row.clients), revenue: num(row.revenue) })),
      byAdvisor: retainedByAdvisor.map((row) => ({ advisor: row.advisor || "Sin asesor", branch: row.branch || "Sin sede", clients: num(row.clients), revenue: num(row.revenue) }))
    },
    planFamilies,
    opportunities,
    simulator,
    ltvScenarios,
    recommendations
  };
  await writeMetricCache(cacheKey, year, month, sourceVersion, result);
  return result;
}

const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

async function globalSalesSourceVersion() {
  const salesRow = await get<AnyRow>(
    `SELECT
      COUNT(*) rows_count,
      COALESCE(SUM(value), 0) sales,
      COALESCE(MAX(id), 0) max_id,
      COALESCE(MAX(created_at), '') last_created_at
     FROM sales`
  );
  const accessRow = await get<AnyRow>(
    `SELECT
      COUNT(*) rows_count,
      COALESCE(MAX(id), 0) max_id,
      COALESCE(MAX(created_at), '') last_created_at
     FROM access_entries`
  ).catch(() => null);
  return JSON.stringify({
    rows: num(salesRow?.rows_count),
    sales: Math.round(num(salesRow?.sales)),
    maxId: num(salesRow?.max_id),
    lastCreatedAt: salesRow?.last_created_at ?? "",
    accessRows: num(accessRow?.rows_count),
    accessMaxId: num(accessRow?.max_id),
    accessLastCreatedAt: accessRow?.last_created_at ?? ""
  });
}

function monthWindowEndingAt(year: number, month: number, monthsBack: number) {
  const periods: Array<{ year: number; month: number }> = [];
  let y = year;
  let m = month;
  for (let i = 0; i < monthsBack; i += 1) {
    periods.push({ year: y, month: m });
    if (m === 1) {
      m = 12;
      y -= 1;
    } else {
      m -= 1;
    }
  }
  return periods;
}

export async function advisorSalesHistory(year: number, month: number, monthsBack = 6) {
  const periods = monthWindowEndingAt(year, month, monthsBack);
  const placeholders = periods.map(() => "(year = ? AND month = ?)").join(" OR ");
  const params = periods.flatMap((period) => [period.year, period.month]);
  const rows = params.length
    ? await all<AnyRow>(
        `SELECT advisor_id, year, month, COALESCE(SUM(value), 0) revenue
         FROM sales
         WHERE value > 0 AND advisor_id IS NOT NULL AND (${placeholders})
         GROUP BY advisor_id, year, month`,
        params
      )
    : [];
  const byAdvisor = new Map<number, Array<{ year: number; month: number; revenue: number }>>();
  for (const row of rows) {
    const advisorId = Number(row.advisor_id);
    const list = byAdvisor.get(advisorId) ?? [];
    list.push({ year: Number(row.year), month: Number(row.month), revenue: num(row.revenue) });
    byAdvisor.set(advisorId, list);
  }
  for (const list of byAdvisor.values()) {
    list.sort((a, b) => a.year - b.year || a.month - b.month);
  }
  return byAdvisor;
}

async function buildSalesTrends(year: number, month: number) {
  const cacheKey = `trends-v10:${year}-${String(month).padStart(2, "0")}`;
  const sourceVersion = await globalSalesSourceVersion();
  const cached = await readMetricCache<AnyRow>(cacheKey, sourceVersion);
  if (cached) return cached;

  const habitWindow = monthWindowEndingAt(year, month, 12);
  const windowPlaceholders = habitWindow.map(() => "(year = ? AND month = ?)").join(" OR ");
  const windowParams = habitWindow.flatMap((period) => [period.year, period.month]);

  const weekdayRows = windowParams.length
    ? await all<AnyRow>(
        `SELECT CAST(strftime('%w', sold_at) AS INTEGER) weekday,
           COUNT(*) rows, COALESCE(SUM(value), 0) revenue
         FROM sales
         WHERE value > 0 AND sold_at IS NOT NULL AND (${windowPlaceholders})
         GROUP BY weekday`,
        windowParams
      )
    : [];
  const weekdayStats = WEEKDAY_LABELS.map((label, weekday) => {
    const row = weekdayRows.find((item) => num(item.weekday) === weekday);
    const rows = num(row?.rows);
    const revenue = num(row?.revenue);
    return { weekday, label, rows, revenue, avgTicket: rows > 0 ? revenue / rows : 0 };
  });
  const bestWeekday = weekdayStats.slice().sort((a, b) => b.revenue - a.revenue)[0] ?? null;

  const planRows = await all<AnyRow>(
    `SELECT p.name, COUNT(s.id) rows, COALESCE(SUM(s.value), 0) revenue
     FROM sales s
     JOIN plans p ON p.id = s.plan_id
     WHERE s.year = ? AND s.month = ? AND s.value > 0
     GROUP BY p.id
     ORDER BY revenue DESC`,
    [year, month]
  );
  const familyMap = new Map<string, { family: string; rows: number; revenue: number }>();
  for (const row of planRows) {
    const family = planFamily(row.name);
    const current = familyMap.get(family) ?? { family, rows: 0, revenue: 0 };
    current.rows += num(row.rows);
    current.revenue += num(row.revenue);
    familyMap.set(family, current);
  }
  const planMix = Array.from(familyMap.values()).sort((a, b) => b.revenue - a.revenue);
  const topPlanFamily = planMix[0] ?? null;

  const referenceDate = new Date(Date.UTC(year, month - 1, 15));
  const yearsToScan = [year - 2, year - 1, year];
  const allImportantDates = yearsToScan.flatMap((y) => importantDatesForYear(y));

  // Combina ventas transaccionales (fuente principal) con la estacionalidad diaria
  // historica (data/seasonalityDaily.json, extraida de libros de estacionalidad de anios
  // anteriores) para poder calcular el impacto de fechas clave en periodos sin ventas
  // transaccionales todavia cargadas.
  const transactionalByDate = new Map<string, number>();
  const transactionalRows = await all<AnyRow>(
    `SELECT date(sold_at) sale_date, COALESCE(SUM(value), 0) revenue
     FROM sales
     WHERE value > 0 AND sold_at IS NOT NULL
     GROUP BY sale_date`
  );
  for (const row of transactionalRows) {
    if (row.sale_date) transactionalByDate.set(String(row.sale_date), num(row.revenue));
  }
  const seasonalityByDate = seasonalityDailyMap();
  const revenueForDate = (date: string) => transactionalByDate.get(date) ?? seasonalityByDate.get(date) ?? 0;
  const daysWithDataInMonth = (y: number, m: number) => {
    const prefix = `${y}-${String(m).padStart(2, "0")}`;
    const days = new Set<string>();
    for (const key of transactionalByDate.keys()) if (key.startsWith(prefix)) days.add(key);
    for (const key of seasonalityByDate.keys()) if (key.startsWith(prefix)) days.add(key);
    return Array.from(days);
  };
  const monthDailyAverage = (y: number, m: number) => {
    const days = daysWithDataInMonth(y, m);
    if (!days.length) return 0;
    return days.reduce((sum, day) => sum + revenueForDate(day), 0) / days.length;
  };

  // Comparativo mes vs. mismo mes del anio anterior, a igual corte de dias
  // (para no comparar un mes en curso contra un mes anterior completo).
  const today = new Date();
  const isCurrentPeriod = today.getUTCFullYear() === year && today.getUTCMonth() + 1 === month;
  const daysInSelectedMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cutoffDay = isCurrentPeriod ? today.getUTCDate() : daysInSelectedMonth;
  const monthToDateRevenue = (y: number, m: number, uptoDay: number) => {
    let sum = 0;
    for (let d = 1; d <= uptoDay; d += 1) {
      sum += revenueForDate(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    return sum;
  };
  const currentMonthRevenue = monthToDateRevenue(year, month, cutoffDay);
  const previousYearMonthRevenue = monthToDateRevenue(year - 1, month, cutoffDay);
  const monthlyComparison = {
    year,
    month,
    previousYear: year - 1,
    cutoffDay,
    isPartialMonth: isCurrentPeriod && cutoffDay < daysInSelectedMonth,
    currentRevenue: currentMonthRevenue,
    previousRevenue: previousYearMonthRevenue,
    deltaRatio: previousYearMonthRevenue > 0 ? currentMonthRevenue / previousYearMonthRevenue - 1 : null
  };

  // Habito por tramo del mes: a diferencia de la version anterior (suma generica de
  // los ultimos 12 meses), esto separa lo YA ejecutado (dias <= corte, ventas reales)
  // de lo proyectado (dias > corte). Lo proyectado usa la estacionalidad real: la venta
  // del MISMO dia del mes en el anio anterior, ajustada por el ritmo interanual del mes
  // en curso (monthlyComparison.deltaRatio) para no perder el efecto de crecimiento.
  const seasonalGrowthFactor = monthlyComparison.deltaRatio != null
    ? Math.max(0.5, Math.min(2, 1 + monthlyComparison.deltaRatio))
    : 1;
  const priorYearRevenueForDay = (day: number) => {
    const dateStr = `${year - 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return transactionalByDate.get(dateStr) ?? seasonalityByDate.get(dateStr) ?? 0;
  };
  const monthPartRanges: Array<{ part: string; from: number; to: number }> = [
    { part: "Inicio (1-10)", from: 1, to: 10 },
    { part: "Mitad (11-20)", from: 11, to: 20 },
    { part: `Cierre (21-${daysInSelectedMonth})`, from: 21, to: daysInSelectedMonth }
  ];
  const monthPartStats = monthPartRanges.map(({ part, from, to }) => {
    let actual = 0;
    let projected = 0;
    for (let day = from; day <= to; day += 1) {
      if (day <= cutoffDay) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        actual += transactionalByDate.get(dateStr) ?? 0;
      } else {
        projected += priorYearRevenueForDay(day) * seasonalGrowthFactor;
      }
    }
    return { part, actual, projected, revenue: actual + projected };
  });
  const bestMonthPart = monthPartStats.slice().sort((a, b) => b.revenue - a.revenue)[0] ?? null;

  // Estado de cada fecha clave relativo al periodo SELECCIONADO (year/month), no a la
  // fecha real del sistema: si cae dentro del mes que el usuario esta viendo, "esta en
  // curso"; si cae en los 2 meses siguientes, esta "proxima".
  const todayIso = today.toISOString().slice(0, 10);
  const dateStatus = (dateIso: string): "en_curso" | "proxima" | "programada" => {
    const [dy, dm] = dateIso.split("-").map(Number);
    const diffMonths = (dy - year) * 12 + (dm - month);
    if (diffMonths === 0) return "en_curso";
    if (diffMonths > 0 && diffMonths <= 2) return "proxima";
    return "programada";
  };

  const dateImpacts: Array<{
    date: string;
    name: string;
    kind: "festivo" | "comercial";
    windowRevenue: number;
    baselineDailyAvg: number;
    liftRatio: number;
  }> = [];

  for (const entry of allImportantDates) {
    const [dy, dm] = entry.date.split("-").map(Number);
    const centerDate = new Date(`${entry.date}T00:00:00Z`);
    let windowRevenue = 0;
    for (let offset = -3; offset <= 3; offset += 1) {
      const day = new Date(centerDate);
      day.setUTCDate(day.getUTCDate() + offset);
      windowRevenue += revenueForDate(day.toISOString().slice(0, 10));
    }
    const baselineDailyAvg = monthDailyAverage(dy, dm);
    const windowDailyAvg = windowRevenue / 7;
    const liftRatio = baselineDailyAvg > 0 ? windowDailyAvg / baselineDailyAvg - 1 : 0;
    if (windowRevenue > 0) {
      dateImpacts.push({ date: entry.date, name: entry.name, kind: entry.kind, windowRevenue, baselineDailyAvg, liftRatio });
    }
  }

  // Se separan dos promedios por nombre de fecha: el HISTORICO (anios anteriores al
  // seleccionado) y el REAL del anio en curso (solo existe si esa fecha ya paso y hay
  // ventas transaccionales reales en su ventana). Antes se mezclaban en un solo promedio,
  // lo que hacia imposible distinguir "asi se comporto historicamente" de "asi fue en 2026".
  const byNameHistorical = new Map<string, { name: string; kind: "festivo" | "comercial"; samples: number; avgLift: number; nextDate: string }>();
  const byNameCurrentYear = new Map<string, { name: string; kind: "festivo" | "comercial"; samples: number; avgLift: number; nextDate: string }>();
  for (const impact of dateImpacts) {
    const impactYear = Number(impact.date.slice(0, 4));
    const target = impactYear === year ? byNameCurrentYear : byNameHistorical;
    const current = target.get(impact.name);
    if (!current) {
      target.set(impact.name, { name: impact.name, kind: impact.kind, samples: 1, avgLift: impact.liftRatio, nextDate: impact.date });
    } else {
      current.samples += 1;
      current.avgLift = (current.avgLift * (current.samples - 1) + impact.liftRatio) / current.samples;
      if (impact.date > current.nextDate) current.nextDate = impact.date;
    }
  }

  const futureCandidates = importantDatesForYear(year)
    .concat(importantDatesForYear(year + 1))
    .filter((entry) => entry.date >= referenceDate.toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextKeyDate = futureCandidates[0] ?? null;
  const nextKeyDateHistory = nextKeyDate ? byNameHistorical.get(nextKeyDate.name) ?? null : null;

  // Todas las fechas comerciales del anio seleccionado (no solo las proximas), para el
  // panel "Fechas clave": la que este en curso se fija arriba, el resto en orden
  // cronologico para poder recorrer el anio completo con scroll dentro de la tarjeta.
  const yearKeyDates = commercialDatesForYear(year)
    .map((entry) => {
      const historical = byNameHistorical.get(entry.name);
      const currentYearLift = byNameCurrentYear.get(entry.name);
      return {
        date: entry.date,
        name: entry.name,
        kind: entry.kind,
        status: dateStatus(entry.date),
        historicalLift: historical?.avgLift ?? null,
        historicalSamples: historical?.samples ?? 0,
        currentLift: currentYearLift?.avgLift ?? null,
        samples: historical?.samples ?? 0
      };
    })
    .sort((a, b) => {
      const aFirst = a.status === "en_curso" ? 0 : 1;
      const bFirst = b.status === "en_curso" ? 0 : 1;
      if (aFirst !== bFirst) return aFirst - bFirst;
      return a.date.localeCompare(b.date);
    });

  const topHistoricalDates = Array.from(byNameHistorical.values())
    .filter((item) => item.samples > 0)
    .sort((a, b) => b.avgLift - a.avgLift)
    .slice(0, 6);

  const branchOpportunityRows = await all<AnyRow>(
    `SELECT COALESCE(b.display_name, 'Sin sede') branch, COUNT(s.id) rows, COALESCE(SUM(s.value), 0) revenue
     FROM sales s
     LEFT JOIN branches b ON b.id = s.branch_id
     WHERE s.value > 0 AND s.year = ? AND s.month = ?
     GROUP BY branch
     ORDER BY revenue DESC
     LIMIT 5`,
    [year, month]
  );
  const accessByHourRows = await all<AnyRow>(
    `SELECT hour, COUNT(*) entries, COUNT(DISTINCT COALESCE(NULLIF(member_external_id, ''), NULLIF(prospect_external_id, ''), entry_key)) clients
     FROM access_entries
     WHERE year = ? AND month = ?
     GROUP BY hour
     ORDER BY hour`,
    [year, month]
  ).catch(() => []);
  const accessByBranchHourRows = await all<AnyRow>(
    `SELECT COALESCE(b.display_name, 'Sin sede') branch, ae.hour, COUNT(*) entries
     FROM access_entries ae
     LEFT JOIN branches b ON b.id = ae.branch_id
     WHERE ae.year = ? AND ae.month = ?
     GROUP BY branch, ae.hour
     ORDER BY branch, ae.hour`,
    [year, month]
  ).catch(() => []);
  const totalEntries = accessByHourRows.reduce((sum, row) => sum + num(row.entries), 0);
  const activeHourRows = accessByHourRows
    .map((row) => ({ hour: num(row.hour), entries: num(row.entries), clients: num(row.clients) }))
    .filter((row) => row.entries > 0);
  const avgEntriesByActiveHour = activeHourRows.length ? totalEntries / activeHourRows.length : 0;
  const valleyHours = activeHourRows
    .filter((row) => row.entries <= avgEntriesByActiveHour)
    .sort((a, b) => a.entries - b.entries || a.hour - b.hour)
    .slice(0, 5);
  const valleyByBranch = new Map<string, { branch: string; hours: Array<{ hour: number; entries: number }>; totalEntries: number }>();
  for (const row of accessByBranchHourRows) {
    const branch = String(row.branch || "Sin sede");
    const current = valleyByBranch.get(branch) ?? { branch, hours: [], totalEntries: 0 };
    current.hours.push({ hour: num(row.hour), entries: num(row.entries) });
    current.totalEntries += num(row.entries);
    valleyByBranch.set(branch, current);
  }
  const valleyBranchActions = Array.from(valleyByBranch.values())
    .map((branch) => {
      const avg = branch.hours.length ? branch.totalEntries / branch.hours.length : 0;
      const hours = branch.hours
        .filter((row) => row.entries <= avg)
        .sort((a, b) => a.entries - b.entries || a.hour - b.hour)
        .slice(0, 2);
      return { ...branch, valleyHours: hours, avgEntries: avg };
    })
    .filter((branch) => branch.valleyHours.length)
    .sort((a, b) => a.totalEntries - b.totalEntries)
    .slice(0, 6);
  const accessTrends = {
    available: totalEntries > 0,
    totalEntries,
    averageEntriesByActiveHour: avgEntriesByActiveHour,
    byHour: activeHourRows,
    valleyHours,
    branchValleys: valleyBranchActions,
    sourceLabel: totalEntries > 0 ? "EVO entradas" : "Sin entradas EVO para el periodo"
  };
  const daysAwayAnchor = isCurrentPeriod ? new Date(`${todayIso}T00:00:00Z`) : referenceDate;
  const daysToNextKeyDate = nextKeyDate
    ? Math.round((new Date(`${nextKeyDate.date}T00:00:00Z`).getTime() - daysAwayAnchor.getTime()) / 86_400_000)
    : null;

  const recommendations: string[] = [];
  if (topPlanFamily) {
    recommendations.push(
      `La familia de planes "${topPlanFamily.family}" concentra ${compactCurrency(topPlanFamily.revenue)} este período. Usarla como base de la promoción para la próxima fecha clave.`
    );
  }
  if (nextKeyDate) {
    const liftLabel = nextKeyDateHistory?.avgLift != null
      ? `${nextKeyDateHistory.avgLift >= 0 ? "+" : ""}${Math.round(nextKeyDateHistory.avgLift * 100)}%`
      : "sin historial suficiente";
    recommendations.push(
      `${nextKeyDate.name} cae el ${nextKeyDate.date} (en ${daysToNextKeyDate} días). Historicamente el efecto en ventas alrededor de esa fecha es de ${liftLabel} vs. el promedio diario del mes. Preparar oferta con ${daysToNextKeyDate && daysToNextKeyDate > 10 ? "anticipación" : "urgencia"}.`
    );
  }
  if (bestWeekday) {
    recommendations.push(
      `${bestWeekday.label} es el día con más ventas en los últimos 12 meses (${compactCurrency(bestWeekday.revenue)}). Concentrar promociones y refuerzo de asesores ese día.`
    );
  }
  if (bestMonthPart) {
    const quincenaHint = bestMonthPart.part.startsWith("Cierre")
      ? "coincide con el pago de la segunda quincena/nómina de fin de mes"
      : bestMonthPart.part === "Mitad (11-20)"
        ? "coincide con la primera quincena de pago"
        : "concentra el arranque de mes";
    recommendations.push(
      `El tramo "${bestMonthPart.part}" del mes concentra más ventas (${compactCurrency(bestMonthPart.revenue)}), ${quincenaHint}. Programar el lanzamiento de ofertas 2-3 días antes de esa fecha de pago para capturar la decisión de compra.`
    );
  }

  const branchActions = branchOpportunityRows.map((row) => ({
    branch: row.branch,
    revenue: num(row.revenue),
    rows: num(row.rows),
    action: nextKeyDate
      ? `Antes de ${nextKeyDate.name} (${nextKeyDate.date}), reforzar prospección con el plan "${topPlanFamily?.family ?? "top del período"}".`
      : "Reforzar prospección con el plan de mayor ingreso del período."
  }));

  // Sugerencias de nuevas promociones para el mes siguiente, con nombre, precio y
  // condiciones. Se guardan como tareas (todos, area "Promociones") para poder marcarlas
  // "Hecho" y darles seguimiento tanto desde Tendencias como desde la pestaña de Tareas.
  // El insert es idempotente (se salta si ya existe una tarea con el mismo titulo) para
  // no duplicar la sugerencia en cada recalculo de esta cache.
  const nextMonthNum = month === 12 ? 1 : month + 1;
  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonthLabel = `${monthName(nextMonthNum)} ${nextMonthYear}`;
  const nextMonthKeyDates = commercialDatesForYear(nextMonthYear)
    .filter((entry) => Number(entry.date.slice(5, 7)) === nextMonthNum)
    .sort((a, b) => a.date.localeCompare(b.date));
  const shiftDate = (iso: string, days: number) => {
    const parsed = new Date(`${iso}T00:00:00Z`);
    parsed.setUTCDate(parsed.getUTCDate() + days);
    return parsed.toISOString().slice(0, 10);
  };
  const dateLabelEs = (iso: string) => {
    const [, m, d] = iso.split("-").map(Number);
    return `${d} de ${monthName(m).toLowerCase()}`;
  };
  const roundPrice = (value: number) => Math.round(value / 1000) * 1000;

  // Brecha a Meta 4 por sede en el mes actual: identifica que sedes estan mas lejos
  // (en % de su meta) para que las promociones ayuden a CERRAR esa brecha, no solo a
  // mover volumen. Orientado a rentabilidad: descuentos acotados, no agresivos.
  const branchMeta4Rows = await all<AnyRow>(
    `SELECT b.id branch_id, COALESCE(b.display_name, 'Sin sede') branch,
            COALESCE(mt.branch_meta4, 0) meta4,
            COALESCE((SELECT SUM(s.value) FROM sales s WHERE s.branch_id = b.id AND s.year = ? AND s.month = ? AND s.value > 0), 0) revenue
     FROM branches b
     LEFT JOIN monthly_targets mt ON mt.branch_id = b.id AND mt.year = ? AND mt.month = ?`,
    [year, month, year, month]
  );
  const branchesNeedingMeta4 = branchMeta4Rows
    .map((row) => {
      const meta4 = num(row.meta4);
      const revenue = num(row.revenue);
      return { branch: String(row.branch), meta4, revenue, gap: Math.max(meta4 - revenue, 0), gapRatio: meta4 > 0 ? Math.max(meta4 - revenue, 0) / meta4 : 0 };
    })
    .filter((row) => row.meta4 > 0 && row.gap > 0)
    .sort((a, b) => b.gapRatio - a.gapRatio);

  // Planes individuales (no agrupados por familia) mejor posicionados, para dar
  // variedad de oferta entre los segmentos mas fuertes en vez de repetir siempre el
  // mismo plan top.
  const topIndividualPlans = planRows
    .map((row) => {
      const rows = num(row.rows);
      const revenue = num(row.revenue);
      return { name: String(row.name), revenue, rows, avgTicket: rows > 0 ? revenue / rows : 0 };
    })
    .filter((row) => row.avgTicket > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3);

  const promoIdeas: Array<{ title: string; notes: string; dueDate: string }> = [];
  topIndividualPlans.forEach((plan, index) => {
    const targetBranch = branchesNeedingMeta4[index % Math.max(branchesNeedingMeta4.length, 1)] ?? null;
    const anchor = nextMonthKeyDates[index] ?? nextMonthKeyDates[0] ?? null;
    // Descuento acotado (8%) para proteger margen: el objetivo es cerrar brecha de
    // Meta 4 con volumen, no regalar rentabilidad con descuentos agresivos.
    const price = roundPrice(plan.avgTicket * 0.92);
    const dueDate = anchor ? shiftDate(anchor.date, -7) : `${nextMonthYear}-${String(nextMonthNum).padStart(2, "0")}-${String(5 + index * 10).padStart(2, "0")}`;
    const branchNote = targetBranch
      ? ` Objetivo: ayudar a ${targetBranch.branch} a cerrar su brecha de ${compactCurrency(targetBranch.gap)} hacia Meta 4 (lleva ${compactCurrency(targetBranch.revenue)} de ${compactCurrency(targetBranch.meta4)}).`
      : " Objetivo: acercar a todas las sedes a su Meta 4 con un segmento adicional de oferta.";
    promoIdeas.push({
      title: `Promo ${plan.name}${targetBranch ? ` · ${targetBranch.branch}` : ""}${anchor ? ` · ${anchor.name}` : ""}`,
      notes: `Precio sugerido ${compactCurrency(price)} (solo 8% bajo el ticket promedio del plan "${plan.name}", para proteger la rentabilidad).${branchNote} Condiciones: plan individual "${plan.name}", cupo limitado, válida solo durante ${nextMonthLabel}${anchor ? `, con foco en ${anchor.name} (${dateLabelEs(anchor.date)})` : ""}.`,
      dueDate
    });
  });

  const promoTitles = promoIdeas.map((idea) => idea.title);
  if (promoTitles.length) {
    await run(
      `DELETE FROM todos WHERE area = 'Promociones' AND status = 'Pendiente' AND title NOT IN (${promoTitles.map(() => "?").join(",")})`,
      promoTitles
    );
  } else {
    await run("DELETE FROM todos WHERE area = 'Promociones' AND status = 'Pendiente'");
  }
  for (const idea of promoIdeas) {
    const existing = await get<AnyRow>("SELECT id FROM todos WHERE title = ? AND area = 'Promociones'", [idea.title]);
    if (!existing) {
      await run(
        `INSERT INTO todos (title, status, priority, owner, due_date, area, notes)
         VALUES (?, 'Pendiente', 'Alta', 'Mercadeo', ?, 'Promociones', ?)`,
        [idea.title, idea.dueDate, idea.notes]
      );
    }
  }

  const result = {
    period: { year, month },
    weekdayStats,
    bestWeekday,
    monthPartStats,
    bestMonthPart,
    planMix,
    topPlanFamily,
    nextKeyDate: nextKeyDate
      ? { ...nextKeyDate, daysAway: daysToNextKeyDate, historicalLift: nextKeyDateHistory?.avgLift ?? null, status: dateStatus(nextKeyDate.date) }
      : null,
    yearKeyDates,
    topHistoricalDates,
    branchActions,
    recommendations,
    monthlyComparison,
    accessTrends
  };
  await writeMetricCache(cacheKey, year, month, sourceVersion, result);
  return result;
}

function buildCommercialRecommendations(input: {
  advisors: AnyRow[];
  branches: AnyRow[];
  plans: AnyRow[];
  kpis: { totalSales: number; totalTarget: number; targetProgress: number };
}) {
  const recommendations: Array<{ title: string; priority: string; detail: string; metric: string }> = [];
  const lowScoreAdvisors = input.advisors
    .filter((advisor) => advisor.sales > 0 && advisor.score.status !== "Alto")
    .sort((a, b) => (b.commission.missingMeta1 ?? 0) - (a.commission.missingMeta1 ?? 0))
    .slice(0, 5);

  for (const advisor of lowScoreAdvisors) {
    recommendations.push({
      title: `Plan de cierre para ${advisor.name}`,
      priority: advisor.score.status === "Bajo" ? "Alta" : "Media",
      detail: `${advisor.branchName}: faltan ${compactCurrency(advisor.commission.missingMeta1)} para Meta 1 y tiene ${Math.round(advisor.score.score ?? 0)} puntos de score. Priorizar agenda diaria, seguimiento de leads calientes y revisar calidad/gestion.`,
      metric: `Ventas ${compactCurrency(advisor.sales)}`
    });
  }

  const branchesBelowTarget = input.branches
    .filter((branch) => branch.target && branch.score.progressMeta1 < 1)
    .sort((a, b) => a.score.progressMeta1 - b.score.progressMeta1)
    .slice(0, 4);
  for (const branch of branchesBelowTarget) {
    recommendations.push({
      title: `Ritmo comercial en ${branch.name}`,
      priority: branch.score.progressMeta1 < 0.75 ? "Alta" : "Media",
      detail: `La sede va en ${Math.round(branch.score.progressMeta1 * 100)}% de Meta 1. Reforzar cierres de planes de mayor ticket y activar campana local con seguimiento diario.`,
      metric: `Meta 1 ${compactCurrency(branch.target.meta1)}`
    });
  }

  const topPlan = input.plans.find((plan) => plan.sales > 0);
  if (topPlan) {
    recommendations.push({
      title: `Duplicar aprendizajes del plan ${topPlan.name}`,
      priority: "Media",
      detail: `Es el plan con mayor ingreso del filtro. Usarlo como referencia para guiones, pauta y convenios, comparando conversion por sede.`,
      metric: `Ventas ${compactCurrency(topPlan.sales)}`
    });
  }

  if (input.kpis.totalTarget > 0 && input.kpis.targetProgress < 0.85) {
    recommendations.push({
      title: "Plan de choque para cerrar brecha mensual",
      priority: "Alta",
      detail: `El avance compania esta en ${Math.round(input.kpis.targetProgress * 100)}%. Enfocar asesores con brecha a Meta 1 y sedes con score bajo antes de ampliar descuentos.`,
      metric: `Brecha ${compactCurrency(input.kpis.totalTarget - input.kpis.totalSales)}`
    });
  }

  return recommendations.slice(0, 10);
}

function compactCurrency(value: number) {
  const number = Number(value || 0);
  const formatCompact = (amount: number) => {
    const truncated = Math.trunc(Math.abs(amount) * 10) / 10;
    const signed = amount < 0 ? -truncated : truncated;
    return new Intl.NumberFormat("es-CO", {
      maximumFractionDigits: 1
    }).format(signed).replace(",0", "");
  };
  if (Math.abs(number) >= 1_000_000) return `$${formatCompact(number / 1_000_000)}M`;
  if (Math.abs(number) >= 1_000) return `$${formatCompact(number / 1_000)}K`;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(number);
}

export function localDateLabel(iso: string) {
  try {
    return format(parseISO(iso), "yyyy-MM-dd HH:mm");
  } catch {
    return iso;
  }
}
