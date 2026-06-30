import { format, parseISO } from "date-fns";
import {
  calculateAdvisorCommission,
  calculateAdvisorScore,
  calculateBranchScore,
  calculateDirectorCommission,
  DEFAULT_SCORE_SETTINGS,
  monthName
} from "../shared/business";
import type { AdvisorTarget, BranchTarget, EvaluationInput } from "../shared/types";
import { all, get } from "./db";

type AnyRow = Record<string, any>;

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function settings() {
  const rows = await all<{ key: string; value: string }>("SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
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

export async function buildAppState(year?: number, month?: number) {
  const settingMap = await settings();
  const selectedYear = year || Number(settingMap.selected_year) || 2026;
  const selectedMonth = month || Number(settingMap.selected_month) || 6;
  const scoreConfig = scoreSettings(settingMap);
  const targets = await targetRows(selectedYear, selectedMonth);

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
     WHERE b.active = 1
     GROUP BY b.id
     ORDER BY sales DESC, b.display_name`,
    [selectedYear, selectedMonth]
  );

  const advisorSales = await all<AnyRow>(
    `SELECT
      a.id, a.name, a.branch_id, b.display_name branch_name,
      COALESCE(SUM(s.value), 0) sales,
      COUNT(s.id) rows_count,
      COALESCE(SUM(CASE WHEN s.value > 0 THEN 1 ELSE 0 END), 0) conversions
     FROM advisors a
     LEFT JOIN branches b ON b.id = a.branch_id
     LEFT JOIN sales s ON s.advisor_id = a.id AND s.year = ? AND s.month = ?
     WHERE a.active = 1 AND a.excluded_from_commissions = 0
     GROUP BY a.id
     ORDER BY sales DESC, a.name`,
    [selectedYear, selectedMonth]
  );

  const yearlyAdvisorSales = await all<AnyRow>(
    `SELECT advisor_id, COALESCE(SUM(value), 0) yearly_sales
     FROM sales
     WHERE year = ?
     GROUP BY advisor_id`,
    [selectedYear]
  );
  const yearlyByAdvisor = new Map(yearlyAdvisorSales.map((row) => [Number(row.advisor_id), num(row.yearly_sales)]));

  const evaluations = await all<AnyRow>(
    `SELECT * FROM advisor_evaluations WHERE year = ? AND month = ?`,
    [selectedYear, selectedMonth]
  );
  const evaluationByAdvisor = new Map(evaluations.map((row) => [Number(row.advisor_id), row]));

  const advisors = advisorSales.map((row) => {
    const target = advisorTarget(targets.get(Number(row.branch_id)));
    const evalInput = evaluation(evaluationByAdvisor.get(Number(row.id)));
    const commission = calculateAdvisorCommission({
      sales: num(row.sales),
      target,
      conversions: num(row.conversions),
      discounts: 0,
      evaluation: evalInput
    });
    const score = calculateAdvisorScore(
      {
        sales: num(row.sales),
        target,
        conversions: num(row.conversions),
        discounts: 0,
        evaluation: evalInput
      },
      scoreConfig
    );
    return {
      id: Number(row.id),
      name: row.name,
      branchId: row.branch_id ? Number(row.branch_id) : null,
      branchName: row.branch_name ?? "Sin sede",
      sales: num(row.sales),
      yearlySales: yearlyByAdvisor.get(Number(row.id)) ?? 0,
      rows: num(row.rows_count),
      conversions: num(row.conversions),
      target,
      commission,
      score,
      dailyGoal: target?.dailyMeta4 ?? 0,
      monthlyGoal: target?.meta4 ?? 0,
      progressMeta1: commission.progressMeta1,
      progressMeta4: score.progressMeta4,
      evaluation: evalInput
    };
  });

  const advisorsByBranch = new Map<number, typeof advisors>();
  for (const advisor of advisors) {
    if (!advisor.branchId) continue;
    const bucket = advisorsByBranch.get(advisor.branchId) ?? [];
    bucket.push(advisor);
    advisorsByBranch.set(advisor.branchId, bucket);
  }

  const branches = branchSales.map((row) => {
    const branchId = Number(row.id);
    const branchAdvisors = advisorsByBranch.get(branchId) ?? [];
    const validScores = branchAdvisors.map((advisor) => advisor.score.score).filter((score): score is number => score !== null);
    const avgAdvisorScore = validScores.length
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
      : 0;
    const target = branchTarget(targets.get(branchId));
    const score = calculateBranchScore(
      {
        sales: num(row.sales),
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
    const directorCommission = calculateDirectorCommission(num(row.sales), target);
    return {
      id: branchId,
      code: row.code,
      name: row.name,
      sales: num(row.sales),
      rows: num(row.rows_count),
      advisorsWithSales: num(row.advisors_with_sales),
      expectedAdvisors: branchAdvisors.length,
      target,
      score,
      directorCommission
    };
  });

  const plans = await all<AnyRow>(
    `SELECT
      p.id, p.name, p.category, p.cash_price, p.card_price, p.cost_per_month,
      COALESCE(SUM(s.value), 0) sales,
      COUNT(s.id) rows
     FROM plans p
     LEFT JOIN sales s ON s.plan_id = p.id AND s.year = ? AND s.month = ?
     GROUP BY p.id
     ORDER BY sales DESC, rows DESC, p.name
     LIMIT 60`,
    [selectedYear, selectedMonth]
  );

  const dailySalesRaw = await all<AnyRow>(
    `SELECT day, COALESCE(SUM(value), 0) sales, COUNT(*) rows
     FROM sales
     WHERE year = ? AND month = ?
     GROUP BY day
     ORDER BY day`,
    [selectedYear, selectedMonth]
  );
  const dailySales = dailySalesRaw.map((row) => ({
    day: Number(row.day),
    label: String(row.day).padStart(2, "0"),
    sales: num(row.sales),
    rows: num(row.rows)
  }));

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
  const imports = await all<AnyRow>("SELECT * FROM import_batches ORDER BY imported_at DESC LIMIT 8");

  const totalTarget = branches.reduce((sum, branch) => sum + (branch.target?.meta1 ?? 0), 0);
  const totalSales = num(salesSummary?.total_sales);
  const quality = await buildQualityReport(selectedYear, selectedMonth);
  const recommendations = buildCommercialRecommendations({
    advisors,
    branches,
    plans,
    kpis: {
      totalSales,
      totalTarget,
      targetProgress: totalTarget > 0 ? totalSales / totalTarget : 0
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      selectedYear,
      selectedMonth,
      selectedMonthName: monthName(selectedMonth),
      years: years.map((row) => Number(row.year)).filter(Boolean)
    },
    kpis: {
      totalSales,
      salesRows: num(salesSummary?.sales_rows),
      avgTicket: num(salesSummary?.avg_ticket),
      activeBranches: num(salesSummary?.active_branches),
      activeAdvisors: num(salesSummary?.active_advisors),
      totalTarget,
      targetProgress: totalTarget > 0 ? totalSales / totalTarget : 0,
      totalAdvisorCommissions: advisors.reduce((sum, advisor) => sum + advisor.commission.finalCommission, 0),
      totalDirectorCommissions: branches.reduce((sum, branch) => sum + branch.directorCommission.bonus, 0),
      averageAdvisorScore: advisors.filter((advisor) => advisor.score.score !== null).reduce((sum, advisor, _, arr) => sum + (advisor.score.score ?? 0) / arr.length, 0) || 0,
      averageBranchScore: branches.filter((branch) => branch.score.score !== null).reduce((sum, branch, _, arr) => sum + (branch.score.score ?? 0) / arr.length, 0) || 0
    },
    branches,
    advisors,
    plans: plans.map((plan) => ({
      ...plan,
      sales: num(plan.sales),
      rows: num(plan.rows),
      cash_price: plan.cash_price === null ? null : num(plan.cash_price),
      card_price: plan.card_price === null ? null : num(plan.card_price),
      cost_per_month: plan.cost_per_month === null ? null : num(plan.cost_per_month)
    })),
    dailySales,
    monthlySales: monthlySales.map((row) => ({
      ...row,
      label: `${monthName(Number(row.month)).slice(0, 3)} ${row.year}`,
      sales: num(row.sales),
      rows: num(row.rows)
    })),
    paymentMethods: paymentMethods.map((row) => ({ ...row, sales: num(row.sales), rows: num(row.rows) })),
    marketing,
    initiatives,
    todos,
    imports,
    quality,
    recommendations,
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
      SUM(CASE WHEN value <= 0 THEN 1 ELSE 0 END) zero_value
     FROM sales ${where}`,
    params
  );

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
      zeroValue: num(orphanSales?.zero_value)
    },
    status:
      duplicateGroups.length === 0 && naturalDuplicateGroups.length === 0
        ? "OK"
        : "Revisar"
  };
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
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard"
  }).format(Number(value || 0));
}

export async function exportRows(kind: string, year: number, month: number) {
  if (kind === "sales") {
    return all(
      `SELECT s.sold_at, b.display_name sede, a.name asesor, p.name plan, s.value, s.payment_method, s.origin
       FROM sales s
       LEFT JOIN branches b ON b.id = s.branch_id
       LEFT JOIN advisors a ON a.id = s.advisor_id
       LEFT JOIN plans p ON p.id = s.plan_id
       WHERE s.year = ? AND s.month = ?
       ORDER BY s.sold_at`,
      [year, month]
    );
  }
  const state = await buildAppState(year, month);
  if (kind === "advisors") return state.advisors;
  if (kind === "branches") return state.branches;
  if (kind === "plans") return state.plans;
  return [];
}

export function toCsv(rows: AnyRow[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value instanceof Date ? value.toISOString() : typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

export function localDateLabel(iso: string) {
  try {
    return format(parseISO(iso), "yyyy-MM-dd HH:mm");
  } catch {
    return iso;
  }
}
