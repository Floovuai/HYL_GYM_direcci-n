import { describe, expect, it } from "vitest";
import {
  calculateAdvisorCommission,
  calculateAdvisorScore,
  calculateBranchScore,
  calculateDirectorCommission,
  ratingMultiplier,
  ratingScore
} from "../src/shared/business";
import type { AdvisorTarget, BranchTarget } from "../src/shared/types";

const advisorTarget: AdvisorTarget = {
  activation: 60,
  bronze: 75,
  silver: 90,
  meta1: 100,
  meta2: 120,
  meta3: 140,
  meta4: 160,
  dailyMeta4: 5.16,
  weeklyMeta4: 36.82
};

const branchTarget: BranchTarget = {
  activation: 600,
  bronze: 750,
  silver: 900,
  meta1: 1000,
  meta2: 1200,
  meta3: 1400,
  meta4: 1600,
  dailyMeta4: 51.6,
  weeklyMeta4: 368.2
};

describe("mecanica comercial HYL", () => {
  it("convierte calificaciones a puntajes y multiplicadores del Excel", () => {
    expect(ratingScore("Malo")).toBe(60);
    expect(ratingScore("Regular")).toBe(75);
    expect(ratingScore("Bueno")).toBe(85);
    expect(ratingScore("Excelente")).toBe(100);
    expect(ratingMultiplier("Malo")).toBe(0.6);
    expect(ratingMultiplier("Regular")).toBe(0.85);
    expect(ratingMultiplier("Bueno")).toBe(1);
    expect(ratingMultiplier("Excelente")).toBe(1.15);
  });

  it("liquida asesor en Meta 4 con 2% mas bono fijo y multiplicadores", () => {
    const result = calculateAdvisorCommission({
      sales: 200_000_000,
      target: { ...advisorTarget, meta4: 160_000_000 },
      evaluation: { qualityRating: "Excelente", adminRating: "Bueno" }
    });

    expect(result.level).toBe("Meta 4");
    expect(result.rate).toBe(0.02);
    expect(result.fixedBonus).toBe(500_000);
    expect(result.baseCommission).toBe(4_500_000);
    expect(result.finalCommission).toBe(5_175_000);
  });

  it("liquida enero-junio 2026 con bonificacion historica sin valoraciones", () => {
    const result = calculateAdvisorCommission(
      {
        sales: 100_000_000,
        target: { ...advisorTarget, meta1: 100_000_000, meta2: 120_000_000, meta3: 140_000_000, meta4: 160_000_000 },
        evaluation: { qualityRating: "Excelente", adminRating: "Excelente" }
      },
      { year: 2026, month: 6 }
    );

    expect(result.level).toBe("Meta 1");
    expect(result.rate).toBe(0.004);
    expect(result.usesEvaluation).toBe(false);
    expect(result.finalCommission).toBe(400_000);
  });

  it("no liquida comision cuando no alcanza activacion", () => {
    const result = calculateAdvisorCommission({ sales: 50, target: advisorTarget });
    expect(result.level).toBe("Sin comision");
    expect(result.finalCommission).toBe(0);
  });

  it("calcula score de asesor con pesos 40/15/15/15/10/5", () => {
    const result = calculateAdvisorScore({
      sales: 100,
      target: advisorTarget,
      conversions: 100,
      discounts: 0,
      evaluation: { qualityRating: "Bueno", adminRating: "Excelente" }
    });

    expect(result.salesScore).toBe(100);
    expect(result.meta4Score).toBeCloseTo(62.5);
    expect(result.qualityScore).toBe(85);
    expect(result.adminScore).toBe(100);
    expect(result.conversionScore).toBe(100);
    expect(result.discountScore).toBe(100);
    expect(result.score).toBeCloseTo(92.125);
    expect(result.status).toBe("Alto");
  });

  it("calcula score de sede con ventas, meta 4, asesores, conversiones, descuentos y participacion", () => {
    const result = calculateBranchScore({
      sales: 1000,
      target: branchTarget,
      conversions: 200,
      discounts: 0,
      advisorAverageScore: 80,
      advisorsWithSales: 2,
      expectedAdvisors: 2
    });

    expect(result.salesScore).toBe(100);
    expect(result.meta4Score).toBeCloseTo(62.5);
    expect(result.conversionScore).toBe(100);
    expect(result.participationScore).toBe(100);
    expect(result.score).toBeCloseTo(89.5);
  });

  it("liquida director por Meta 1, 2, 3 y 4", () => {
    expect(calculateDirectorCommission(1000, branchTarget).bonus).toBe(100000);
    expect(calculateDirectorCommission(1200, branchTarget).bonus).toBe(200000);
    expect(calculateDirectorCommission(1400, branchTarget).bonus).toBe(500000);
    expect(calculateDirectorCommission(1600, branchTarget).bonus).toBe(700000);
    expect(calculateDirectorCommission(999, branchTarget).bonus).toBe(0);
  });
});
