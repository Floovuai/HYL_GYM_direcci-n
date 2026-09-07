export type MonthName =
  | "Enero"
  | "Febrero"
  | "Marzo"
  | "Abril"
  | "Mayo"
  | "Junio"
  | "Julio"
  | "Agosto"
  | "Septiembre"
  | "Octubre"
  | "Noviembre"
  | "Diciembre";

export type QualityRating = "" | "Malo" | "Regular" | "Bueno" | "Excelente";

export type CommissionLevel =
  | "Sin venta"
  | "Sin comision"
  | "Activacion"
  | "Bronce"
  | "Plata"
  | "Meta 1"
  | "Meta 2"
  | "Meta 3"
  | "Meta 4";

export type ScoreStatus = "Pendiente" | "Bajo" | "Medio" | "Alto";

export interface AdvisorTarget {
  activation: number;
  bronze: number;
  silver: number;
  meta1: number;
  meta2: number;
  meta3: number;
  meta4: number;
  dailyMeta4: number;
  weeklyMeta4: number;
}

export interface BranchTarget {
  activation: number;
  bronze: number;
  silver: number;
  meta1: number;
  meta2: number;
  meta3: number;
  meta4: number;
  dailyMeta4: number;
  weeklyMeta4: number;
}

export interface EvaluationInput {
  qualityRating?: QualityRating;
  adminRating?: QualityRating;
  qualityScore?: number;
  adminScore?: number;
  qualityMultiplier?: number;
  adminMultiplier?: number;
}

export interface AdvisorMetricInput {
  sales: number;
  target?: AdvisorTarget | null;
  conversions?: number;
  discounts?: number;
  evaluation?: EvaluationInput | null;
}

export interface AdvisorCommission {
  level: CommissionLevel;
  rate: number;
  fixedBonus: number;
  baseCommission: number;
  finalCommission: number;
  progressMeta1: number;
  missingMeta1: number;
  missingMeta4: number;
  status: string;
  scheme: "historico_enero_junio_2026" | "rendimiento_julio_2026";
  usesEvaluation: boolean;
}

export interface AdvisorScore {
  score: number | null;
  status: ScoreStatus;
  salesScore: number;
  meta4Score: number;
  qualityScore: number;
  adminScore: number;
  conversionScore: number;
  discountScore: number;
  progressMeta1: number;
  progressMeta4: number;
}

export interface BranchMetricInput {
  sales: number;
  target?: BranchTarget | null;
  conversions?: number;
  discounts?: number;
  advisorAverageScore?: number;
  advisorsWithSales?: number;
  expectedAdvisors?: number;
  monthlyConversionGoalPerAdvisor?: number;
  maxDiscountRate?: number;
}

export interface BranchScore {
  score: number | null;
  status: ScoreStatus;
  salesScore: number;
  meta4Score: number;
  advisorScore: number;
  conversionScore: number;
  discountScore: number;
  participationScore: number;
  progressMeta1: number;
  progressMeta4: number;
}

export interface DirectorCommission {
  level: "Sin venta" | "Sin meta" | "META 1" | "META 2" | "META 3";
  bonus: number;
  progressMeta1: number;
  missingMeta1: number;
  missingMeta4: number;
}

export interface AppState {
  generatedAt: string;
  filters: {
    selectedYear: number;
    selectedMonth: number;
    years: number[];
  };
  kpis: Record<string, number>;
  branches: unknown[];
  advisors: unknown[];
  plans: unknown[];
  dailySales: unknown[];
  monthlySales: unknown[];
  marketing: unknown[];
  initiatives: unknown[];
  todos: unknown[];
  settings: Record<string, string>;
}
