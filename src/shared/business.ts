import type {
  AdvisorCommission,
  AdvisorMetricInput,
  AdvisorScore,
  BranchMetricInput,
  BranchScore,
  BranchTarget,
  CommissionLevel,
  DirectorCommission,
  EvaluationInput,
  MonthName,
  ScoreStatus
} from "./types";

export const MONTHS: MonthName[] = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

export const DEFAULT_SCORE_SETTINGS = {
  monthlyConversionGoalPerAdvisor: 100,
  maxDiscountRate: 0.03,
  scoreHigh: 80,
  scoreMedium: 60
};

const COMMISSION_RATES: Record<CommissionLevel, { rate: number; fixedBonus: number }> = {
  "Sin venta": { rate: 0, fixedBonus: 0 },
  "Sin comision": { rate: 0, fixedBonus: 0 },
  Activacion: { rate: 0.0015, fixedBonus: 0 },
  Bronce: { rate: 0.0025, fixedBonus: 0 },
  Plata: { rate: 0.0035, fixedBonus: 0 },
  "Meta 1": { rate: 0.005, fixedBonus: 0 },
  "Meta 2": { rate: 0.008, fixedBonus: 0 },
  "Meta 3": { rate: 0.012, fixedBonus: 0 },
  "Meta 4": { rate: 0.02, fixedBonus: 500000 }
};

export function monthName(month: number): MonthName {
  return MONTHS[Math.max(0, Math.min(11, month - 1))];
}

export function monthNumber(name: string): number {
  const idx = MONTHS.findIndex((month) => normalizeKey(month) === normalizeKey(name));
  return idx >= 0 ? idx + 1 : 0;
}

export function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/�/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function cleanDisplay(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function ratingScore(rating?: string): number {
  switch (normalizeKey(rating)) {
    case "MALO":
      return 60;
    case "REGULAR":
      return 75;
    case "BUENO":
      return 85;
    case "EXCELENTE":
      return 100;
    default:
      return 0;
  }
}

export function ratingMultiplier(rating?: string): number {
  switch (normalizeKey(rating)) {
    case "MALO":
      return 0.6;
    case "REGULAR":
      return 0.85;
    case "BUENO":
      return 1;
    case "EXCELENTE":
      return 1.15;
    default:
      return 1;
  }
}

export function resolveEvaluation(evaluation?: EvaluationInput | null): Required<EvaluationInput> {
  const qualityRating = evaluation?.qualityRating ?? "";
  const adminRating = evaluation?.adminRating ?? "";
  return {
    qualityRating,
    adminRating,
    qualityScore: evaluation?.qualityScore ?? ratingScore(qualityRating),
    adminScore: evaluation?.adminScore ?? ratingScore(adminRating),
    qualityMultiplier: evaluation?.qualityMultiplier ?? ratingMultiplier(qualityRating),
    adminMultiplier: evaluation?.adminMultiplier ?? ratingMultiplier(adminRating)
  };
}

export function scoreStatus(score: number | null, high = 80, medium = 60): ScoreStatus {
  if (score === null || Number.isNaN(score)) return "Pendiente";
  if (score >= high) return "Alto";
  if (score >= medium) return "Medio";
  return "Bajo";
}

function progress(numerator: number, denominator?: number | null): number {
  if (!denominator || denominator <= 0) return 0;
  return numerator / denominator;
}

function boundedScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function chooseAdvisorLevel(sales: number, target?: AdvisorMetricInput["target"]): CommissionLevel {
  if (sales <= 0) return "Sin venta";
  if (!target) return "Sin comision";
  if (sales >= target.meta4) return "Meta 4";
  if (sales >= target.meta3) return "Meta 3";
  if (sales >= target.meta2) return "Meta 2";
  if (sales >= target.meta1) return "Meta 1";
  if (sales >= target.silver) return "Plata";
  if (sales >= target.bronze) return "Bronce";
  if (sales >= target.activation) return "Activacion";
  return "Sin comision";
}

export function calculateAdvisorCommission(input: AdvisorMetricInput): AdvisorCommission {
  const sales = Math.max(0, input.sales || 0);
  const target = input.target ?? null;
  const level = chooseAdvisorLevel(sales, target);
  const rate = COMMISSION_RATES[level].rate;
  const fixedBonus = COMMISSION_RATES[level].fixedBonus;
  const baseCommission = sales * rate + fixedBonus;
  const evaluation = resolveEvaluation(input.evaluation);
  const finalCommission = baseCommission * evaluation.qualityMultiplier * evaluation.adminMultiplier;
  const progressMeta1 = progress(sales, target?.meta1);
  const missingMeta1 = Math.max((target?.meta1 ?? 0) - sales, 0);
  const missingMeta4 = Math.max((target?.meta4 ?? 0) - sales, 0);
  const status =
    sales <= 0 ? "Pendiente venta" : finalCommission <= 0 ? "Sin comision" : "Calculado";

  return {
    level,
    rate,
    fixedBonus,
    baseCommission,
    finalCommission,
    progressMeta1,
    missingMeta1,
    missingMeta4,
    status
  };
}

export function calculateAdvisorScore(
  input: AdvisorMetricInput,
  settings = DEFAULT_SCORE_SETTINGS
): AdvisorScore {
  const sales = Math.max(0, input.sales || 0);
  const target = input.target ?? null;
  const evaluation = resolveEvaluation(input.evaluation);
  const progressMeta1 = progress(sales, target?.meta1);
  const progressMeta4 = progress(sales, target?.meta4);
  const salesScore = boundedScore(Math.min(progressMeta1, 1) * 100);
  const meta4Score = boundedScore(Math.min(progressMeta4, 1) * 100);
  const qualityScore = boundedScore(evaluation.qualityScore || 0);
  const adminScore = boundedScore(evaluation.adminScore || 0);
  const conversionScore = boundedScore(
    Math.min((input.conversions ?? 0) / settings.monthlyConversionGoalPerAdvisor, 1) * 100
  );
  const discountRate = sales > 0 ? (input.discounts ?? 0) / sales : 0;
  const discountScore =
    sales > 0 ? boundedScore((1 - discountRate / settings.maxDiscountRate) * 100) : 0;
  const score =
    sales <= 0
      ? null
      : salesScore * 0.4 +
        meta4Score * 0.15 +
        qualityScore * 0.15 +
        adminScore * 0.15 +
        conversionScore * 0.1 +
        discountScore * 0.05;

  return {
    score,
    status: scoreStatus(score, settings.scoreHigh, settings.scoreMedium),
    salesScore,
    meta4Score,
    qualityScore,
    adminScore,
    conversionScore,
    discountScore,
    progressMeta1,
    progressMeta4
  };
}

export function calculateDirectorCommission(sales: number, target?: BranchTarget | null): DirectorCommission {
  const safeSales = Math.max(0, sales || 0);
  const progressMeta1 = progress(safeSales, target?.meta1);
  const missingMeta1 = Math.max((target?.meta1 ?? 0) - safeSales, 0);
  const missingMeta4 = Math.max((target?.meta4 ?? 0) - safeSales, 0);
  if (safeSales <= 0) return { level: "Sin venta", bonus: 0, progressMeta1, missingMeta1, missingMeta4 };
  if (!target || safeSales < target.meta1) {
    return { level: "Sin meta", bonus: 0, progressMeta1, missingMeta1, missingMeta4 };
  }
  if (safeSales >= target.meta3) {
    return { level: "META 3", bonus: 500000, progressMeta1, missingMeta1, missingMeta4 };
  }
  if (safeSales >= target.meta2) {
    return { level: "META 2", bonus: 200000, progressMeta1, missingMeta1, missingMeta4 };
  }
  return { level: "META 1", bonus: 100000, progressMeta1, missingMeta1, missingMeta4 };
}

export function calculateBranchScore(
  input: BranchMetricInput,
  settings = DEFAULT_SCORE_SETTINGS
): BranchScore {
  const sales = Math.max(0, input.sales || 0);
  const target = input.target ?? null;
  const expectedAdvisors = Math.max(1, input.expectedAdvisors ?? 1);
  const progressMeta1 = progress(sales, target?.meta1);
  const progressMeta4 = progress(sales, target?.meta4);
  const salesScore = boundedScore(Math.min(progressMeta1, 1) * 100);
  const meta4Score = boundedScore(Math.min(progressMeta4, 1) * 100);
  const advisorScore = boundedScore(input.advisorAverageScore ?? 0);
  const conversionTarget = expectedAdvisors * (input.monthlyConversionGoalPerAdvisor ?? settings.monthlyConversionGoalPerAdvisor);
  const conversionScore = boundedScore(Math.min((input.conversions ?? 0) / conversionTarget, 1) * 100);
  const discountRate = sales > 0 ? (input.discounts ?? 0) / sales : 0;
  const discountScore =
    sales > 0 ? boundedScore((1 - discountRate / (input.maxDiscountRate ?? settings.maxDiscountRate)) * 100) : 0;
  const participationScore = boundedScore(Math.min((input.advisorsWithSales ?? 0) / expectedAdvisors, 1) * 100);
  const score =
    sales <= 0
      ? null
      : salesScore * 0.45 +
        meta4Score * 0.2 +
        advisorScore * 0.15 +
        conversionScore * 0.1 +
        discountScore * 0.05 +
        participationScore * 0.05;

  return {
    score,
    status: scoreStatus(score, settings.scoreHigh, settings.scoreMedium),
    salesScore,
    meta4Score,
    advisorScore,
    conversionScore,
    discountScore,
    participationScore,
    progressMeta1,
    progressMeta4
  };
}

export function createTargetsFromBranchGoals(branch: {
  meta1: number;
  meta2: number;
  meta3: number;
  meta4: number;
  daysInMonth: number;
}) {
  const advisorTarget = {
    activation: branch.meta1 / 2 * 0.6,
    bronze: branch.meta1 / 2 * 0.7,
    silver: branch.meta1 / 2 * 0.85,
    meta1: branch.meta1 / 2,
    meta2: branch.meta2 / 2,
    meta3: branch.meta3 / 2,
    meta4: branch.meta4 / 2,
    dailyMeta4: branch.meta4 / 2 / branch.daysInMonth,
    weeklyMeta4: branch.meta4 / 2 / 4.345
  };
  const branchTarget = {
    activation: branch.meta1 * 0.6,
    bronze: branch.meta1 * 0.7,
    silver: branch.meta1 * 0.85,
    meta1: branch.meta1,
    meta2: branch.meta2,
    meta3: branch.meta3,
    meta4: branch.meta4,
    dailyMeta4: branch.meta4 / branch.daysInMonth,
    weeklyMeta4: branch.meta4 / 4.345
  };
  return { advisorTarget, branchTarget };
}
