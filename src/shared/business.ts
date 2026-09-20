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

const OFFICIAL_2026_BRANCH_META1: Record<number, Record<string, number>> = {
  7: {
    "BUENOS AIRES": 139000000,
    "CALLE 109": 114000000,
    "COLORS 162": 82000000,
    MODELIA: 224000000,
    ONLINE: 57000000,
    "PRADO VERANIEGO": 82000000,
    "SANTA MATILDE": 78000000,
    VILLAVICENCIO: 139000000
  },
  8: {
    "BUENOS AIRES": 89000000,
    "COLORS 162": 80000000,
    MODELIA: 157000000,
    ONLINE: 70000000,
    "PRADO VERANIEGO": 80000000,
    "SANTA MATILDE": 66000000,
    "VILLA MAYOR": 66000000,
    VILLAVICENCIO: 89000000
  },
  9: {
    "BUENOS AIRES": 127000000,
    "COLORS 162": 78000000,
    MODELIA: 179000000,
    ONLINE: 57000000,
    "PRADO VERANIEGO": 78000000,
    "SANTA MATILDE": 92000000,
    "VILLA MAYOR": 92000000,
    VILLAVICENCIO: 127000000
  },
  10: {
    "BUENOS AIRES": 117000000,
    "COLORS 162": 71000000,
    MODELIA: 159000000,
    ONLINE: 50000000,
    "PRADO VERANIEGO": 71000000,
    "SANTA MATILDE": 75000000,
    "VILLA MAYOR": 75000000,
    VILLAVICENCIO: 117000000
  },
  11: {
    "BUENOS AIRES": 103000000,
    "COLORS 162": 72000000,
    MODELIA: 170000000,
    ONLINE: 58000000,
    "PRADO VERANIEGO": 72000000,
    "SANTA MATILDE": 67000000,
    "VILLA MAYOR": 67000000,
    VILLAVICENCIO: 115000000
  },
  12: {
    "BUENOS AIRES": 104000000,
    "COLORS 162": 56000000,
    MODELIA: 159000000,
    ONLINE: 30000000,
    "PRADO VERANIEGO": 97000000,
    "SANTA MATILDE": 84000000,
    "VILLA MAYOR": 84000000,
    VILLAVICENCIO: 104000000
  }
};

const EXCEL_2026_TARGET_MONTHS = new Set([7, 8, 9, 10, 11, 12]);
const EXCEL_2026_META2_FACTOR = 1.0224;
const EXCEL_2026_META3_FACTOR = 1.0377;
const EXCEL_2026_META4_FACTOR = 1.2;

function roundToMillion(value: number) {
  return Math.round(value / 1_000_000) * 1_000_000;
}

const OFFICIAL_2026_ADVISOR_COUNTS: Record<string, number> = {
  "BUENOS AIRES": 2,
  "CALLE 109": 2,
  "COLORS 162": 2,
  MODELIA: 2,
  ONLINE: 1,
  "PRADO VERANIEGO": 2,
  "SANTA MATILDE": 2,
  "VILLA MAYOR": 2,
  VILLAVICENCIO: 2
};

export const ADVISOR_ASSIGNMENT_CHANGE_START = "2026-07-16";

export const JULY_2026_ADVISOR_BRANCH_CHANGES = [
  {
    advisor: "ALEJANDRA CUELLO",
    branch: "Colors 162",
    effectiveFrom: ADVISOR_ASSIGNMENT_CHANGE_START,
    appliesThrough: null,
    note: "Nuevo esquema desde el 16/07/2026 y fijo desde agosto."
  },
  {
    advisor: "FERNANDA AMAYA",
    branch: "Prado Veraniego",
    effectiveFrom: ADVISOR_ASSIGNMENT_CHANGE_START,
    appliesThrough: null,
    note: "Sale de Modelia y pasa a Prado Veraniego."
  },
  {
    advisor: "MELISSA MONTOYA",
    branch: "Modelia",
    effectiveFrom: ADVISOR_ASSIGNMENT_CHANGE_START,
    appliesThrough: null,
    note: "Sale de Buenos Aires y pasa a Modelia."
  },
  {
    advisor: "LINA ALEJANDRA TORRES LEAL",
    branch: "Buenos Aires",
    effectiveFrom: ADVISOR_ASSIGNMENT_CHANGE_START,
    appliesThrough: null,
    note: "Sale de Calle 109 y pasa a Buenos Aires."
  },
  {
    advisor: "XIOMARA OCHOA",
    branch: "Calle 109",
    effectiveFrom: ADVISOR_ASSIGNMENT_CHANGE_START,
    appliesThrough: ADVISOR_ASSIGNMENT_CHANGE_START,
    note: "Excepcion operativa: ventas del 16/07/2026 se cargan a Calle 109."
  }
] as const;

const COMMISSION_RATES: Record<CommissionLevel, { rate: number; fixedBonus: number }> = {
  "Sin venta": { rate: 0, fixedBonus: 0 },
  "Sin comision": { rate: 0, fixedBonus: 0 },
  "Meta 1": { rate: 0.004, fixedBonus: 0 },
  "Meta 2": { rate: 0.008, fixedBonus: 0 },
  "Meta 3": { rate: 0.012, fixedBonus: 0 },
  "Meta 4": { rate: 0.02, fixedBonus: 500000 }
};

const HISTORICAL_COMMISSION_RATES: Record<CommissionLevel, { rate: number; fixedBonus: number }> = {
  "Sin venta": { rate: 0, fixedBonus: 0 },
  "Sin comision": { rate: 0, fixedBonus: 0 },
  "Meta 1": { rate: 0.004, fixedBonus: 0 },
  "Meta 2": { rate: 0.008, fixedBonus: 0 },
  "Meta 3": { rate: 0.012, fixedBonus: 0 },
  "Meta 4": { rate: 0.02, fixedBonus: 500000 }
};

export function commissionSchemeForPeriod(year?: number, month?: number) {
  if (year === 2026 && (month ?? 0) > 0 && (month ?? 0) <= 6) {
    return "historico_enero_junio_2026" as const;
  }
  return "rendimiento_julio_2026" as const;
}

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

function localDateKey(date?: Date | null): number {
  if (!date || Number.isNaN(date.getTime())) return 0;
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function isoDateKey(value: string): number {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return (year || 0) * 10000 + (month || 0) * 100 + (day || 0);
}

export function advisorBranchOverrideForSale(advisorName: unknown, soldAt?: Date | null): string | null {
  const advisor = normalizeKey(advisorName);
  const soldAtKey = localDateKey(soldAt);
  if (!advisor || !soldAtKey) return null;

  for (const change of JULY_2026_ADVISOR_BRANCH_CHANGES) {
    if (normalizeKey(change.advisor) !== advisor) continue;
    const fromKey = isoDateKey(change.effectiveFrom);
    const throughKey = change.appliesThrough ? isoDateKey(change.appliesThrough) : Number.POSITIVE_INFINITY;
    if (soldAtKey >= fromKey && soldAtKey <= throughKey) return change.branch;
  }

  return null;
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

function chooseAdvisorLevel(
  sales: number,
  target?: AdvisorMetricInput["target"],
  scheme: ReturnType<typeof commissionSchemeForPeriod> = "rendimiento_julio_2026"
): CommissionLevel {
  if (sales <= 0) return "Sin venta";
  if (!target) return "Sin comision";
  if (sales >= target.meta4) return "Meta 4";
  if (sales >= target.meta3) return "Meta 3";
  if (sales >= target.meta2) return "Meta 2";
  if (sales >= target.meta1) return "Meta 1";
  return "Sin comision";
}

function advisorCommissionByReachedLevel(input: {
  sales: number;
  target: AdvisorMetricInput["target"];
  level: CommissionLevel;
  rates: Record<CommissionLevel, { rate: number; fixedBonus: number }>;
  scheme: ReturnType<typeof commissionSchemeForPeriod>;
}) {
  if (input.level === "Sin venta" || input.level === "Sin comision" || !input.target) {
    return { variableCommission: 0, fixedBonus: 0 };
  }

  return {
    variableCommission: input.sales * input.rates[input.level].rate,
    fixedBonus: input.rates[input.level].fixedBonus
  };
}

export function calculateAdvisorCommission(
  input: AdvisorMetricInput,
  period?: { year?: number; month?: number }
): AdvisorCommission {
  const sales = Math.max(0, input.sales || 0);
  const target = input.target ?? null;
  const scheme = commissionSchemeForPeriod(period?.year, period?.month);
  const rates = scheme === "historico_enero_junio_2026" ? HISTORICAL_COMMISSION_RATES : COMMISSION_RATES;
  const level = chooseAdvisorLevel(sales, target, scheme);
  const rate = rates[level].rate;
  const { variableCommission, fixedBonus } = advisorCommissionByReachedLevel({ sales, target, level, rates, scheme });
  const baseCommission = variableCommission + fixedBonus;
  const evaluation = resolveEvaluation(input.evaluation);
  const usesEvaluation = false;
  const finalCommission = baseCommission;
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
    status,
    scheme,
    usesEvaluation
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
  daysInMonth: number;
  advisorMeta1?: number;
  scheme?: "performance" | "excel_2026";
}) {
  const advisorMeta1 = branch.advisorMeta1 ?? branch.meta1 / 2;
  const usesExcel2026Targets = branch.scheme === "excel_2026";
  const branchMeta2 = usesExcel2026Targets ? roundToMillion(branch.meta1 * EXCEL_2026_META2_FACTOR) : branch.meta1 * 1.1;
  const branchMeta3 = usesExcel2026Targets ? roundToMillion(branch.meta1 * EXCEL_2026_META3_FACTOR) : branch.meta1 * 1.2;
  const branchMeta4 = usesExcel2026Targets ? branchMeta3 * EXCEL_2026_META4_FACTOR : branch.meta1 * 1.3;
  const advisorDivisor = branch.meta1 > 0 && advisorMeta1 > 0 ? branch.meta1 / advisorMeta1 : 1;
  const advisorMeta2 = usesExcel2026Targets ? branchMeta2 / advisorDivisor : advisorMeta1 * 1.1;
  const advisorMeta3 = usesExcel2026Targets ? branchMeta3 / advisorDivisor : advisorMeta1 * 1.2;
  const advisorMeta4 = usesExcel2026Targets ? branchMeta4 / advisorDivisor : advisorMeta1 * 1.3;
  const advisorTarget = {
    activation: advisorMeta1 * 0.6,
    bronze: advisorMeta1 * 0.75,
    silver: advisorMeta1 * 0.9,
    meta1: advisorMeta1,
    meta2: advisorMeta2,
    meta3: advisorMeta3,
    meta4: advisorMeta4,
    dailyMeta4: advisorMeta4 / branch.daysInMonth,
    weeklyMeta4: advisorMeta4 / 4.345
  };
  const branchTarget = {
    activation: branch.meta1 * 0.6,
    bronze: branch.meta1 * 0.75,
    silver: branch.meta1 * 0.9,
    meta1: branch.meta1,
    meta2: branchMeta2,
    meta3: branchMeta3,
    meta4: branchMeta4,
    dailyMeta4: branchMeta4 / branch.daysInMonth,
    weeklyMeta4: branchMeta4 / 4.345
  };
  return { advisorTarget, branchTarget };
}

export function officialIntegratedReportTargets2026(branchName: string, month: number) {
  const branchKey = normalizeKey(branchName);
  const branchMeta1 = OFFICIAL_2026_BRANCH_META1[month]?.[branchKey];
  const advisorCount = OFFICIAL_2026_ADVISOR_COUNTS[branchKey];
  if (!branchMeta1 || !advisorCount) return null;
  const targets = createTargetsFromBranchGoals({
    meta1: branchMeta1,
    advisorMeta1: branchMeta1 / advisorCount,
    daysInMonth: new Date(2026, month, 0).getDate(),
    scheme: EXCEL_2026_TARGET_MONTHS.has(month) ? "excel_2026" : "performance"
  });
  return {
    advisor: targets.advisorTarget,
    branch: targets.branchTarget
  };
}
