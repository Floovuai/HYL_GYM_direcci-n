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

type AnyRow = Record<string, any>;

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function settings() {
  const rows = await all<{ key: string; value: string }>("SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
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
    }, {
      year: selectedYear,
      month: selectedMonth
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
      dailyGoal: target ? target.meta1 / new Date(selectedYear, selectedMonth, 0).getDate() : 0,
      monthlyGoal: target?.meta1 ?? 0,
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
    })
    .filter((branch) => {
      const isPlaceholderBranch = String(branch.name ?? "").trim().toUpperCase() === "SIN SEDE";
      return !isPlaceholderBranch || branch.sales > 0 || Boolean(branch.target);
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
  const growth = await buildIntelligentGrowth(selectedYear, selectedMonth);

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
  const daysInSelectedMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const pendingFromDay = lastPositiveDay > 0 && lastPositiveDay < daysInSelectedMonth ? lastPositiveDay + 1 : null;

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
              totalValue: num(latestImport.total_value),
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
      activeAdvisors: num(salesSummary?.active_advisors),
      totalTarget,
      targetProgress: totalTarget > 0 ? totalSales / totalTarget : 0,
      totalAdvisorCommissions: advisors.reduce((sum, advisor) => sum + advisor.commission.finalCommission, 0),
      totalDirectorCommissions: branches.reduce((sum, branch) => sum + branch.directorCommission.bonus, 0),
      averageAdvisorScore: advisors.filter((advisor) => advisor.score.score !== null).reduce((sum, advisor, _, arr) => sum + (advisor.score.score ?? 0) / arr.length, 0) || 0,
      averageBranchScore: branches.filter((branch) => branch.score.score !== null).reduce((sum, branch, _, arr) => sum + (branch.score.score ?? 0) / arr.length, 0) || 0
    },
    commissionPolicy: {
      scheme: commissionScheme,
      label: commissionScheme === "historico_enero_junio_2026"
        ? "Bonificacion historica enero-junio 2026"
        : "Rendimiento con evaluacion desde julio 2026",
      usesEvaluation: commissionScheme === "rendimiento_julio_2026"
    },
    branches,
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
        cost_per_month: plan.cost_per_month === null ? null : num(plan.cost_per_month)
      };
    }),
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
    growth,
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
     WHERE b.active = 1
     GROUP BY b.id
     ORDER BY sales DESC, b.display_name`,
    [year]
  );
  const currentBranchById = new Map(state.branches.map((branch: AnyRow) => [Number(branch.id), branch]));
  const branchMonthlyRows = await all<AnyRow>(
    `SELECT b.id branch_id, s.month, COALESCE(SUM(s.value), 0) sales
     FROM branches b
     LEFT JOIN sales s ON s.branch_id = b.id AND s.year = ? AND s.month <= ?
     WHERE b.active = 1
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
     WHERE a.active = 1 AND a.excluded_from_commissions = 0
     GROUP BY a.id
     ORDER BY sales DESC, a.name`,
    [year]
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
    topDays
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

export function localDateLabel(iso: string) {
  try {
    return format(parseISO(iso), "yyyy-MM-dd HH:mm");
  } catch {
    return iso;
  }
}
