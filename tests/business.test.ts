import { describe, expect, it } from "vitest";
import {
  advisorBranchOverrideForSale,
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

  it("liquida asesor en Meta 4 sobre el total vendido y bono fijo", () => {
    const result = calculateAdvisorCommission({
      sales: 200_000_000,
      target: {
        activation: 60_000_000,
        bronze: 75_000_000,
        silver: 90_000_000,
        meta1: 100_000_000,
        meta2: 120_000_000,
        meta3: 140_000_000,
        meta4: 160_000_000,
        dailyMeta4: 5_161_290,
        weeklyMeta4: 36_823_936
      },
      evaluation: { qualityRating: "Excelente", adminRating: "Bueno" }
    });

    expect(result.level).toBe("Meta 4");
    expect(result.rate).toBe(0.02);
    expect(result.fixedBonus).toBe(500_000);
    expect(result.baseCommission).toBe(4_500_000);
    expect(result.finalCommission).toBe(4_500_000);
  });

  it("liquida enero-junio 2026 sobre el total vendido sin valoraciones", () => {
    const result = calculateAdvisorCommission(
      {
        sales: 130_000_000,
        target: { ...advisorTarget, meta1: 100_000_000, meta2: 120_000_000, meta3: 140_000_000, meta4: 160_000_000 },
        evaluation: { qualityRating: "Excelente", adminRating: "Excelente" }
      },
      { year: 2026, month: 6 }
    );

    expect(result.level).toBe("Meta 2");
    expect(result.rate).toBe(0.008);
    expect(result.usesEvaluation).toBe(false);
    expect(result.finalCommission).toBe(1_040_000);
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

  it("liquida director por Meta 1, 2 y 3", () => {
    expect(calculateDirectorCommission(1000, branchTarget).bonus).toBe(100000);
    expect(calculateDirectorCommission(1200, branchTarget).bonus).toBe(200000);
    expect(calculateDirectorCommission(1400, branchTarget).bonus).toBe(500000);
    expect(calculateDirectorCommission(1600, branchTarget).bonus).toBe(500000);
    expect(calculateDirectorCommission(1600, branchTarget).level).toBe("META 3");
    expect(calculateDirectorCommission(999, branchTarget).bonus).toBe(0);
  });

  it("aplica cambios de asesores desde el 16 de julio de 2026", () => {
    const beforeChange = new Date(2026, 6, 15, 23, 59, 0);
    const changeDate = new Date(2026, 6, 16, 9, 0, 0);
    const august = new Date(2026, 7, 1, 9, 0, 0);

    expect(advisorBranchOverrideForSale("Fernanda Amaya", beforeChange)).toBeNull();
    expect(advisorBranchOverrideForSale("Alejandra Cuello", changeDate)).toBe("Colors 162");
    expect(advisorBranchOverrideForSale("Fernanda Amaya", changeDate)).toBe("Prado Veraniego");
    expect(advisorBranchOverrideForSale("Melissa Montoya", changeDate)).toBe("Modelia");
    expect(advisorBranchOverrideForSale("Lina Alejandra Torres Leal", changeDate)).toBe("Buenos Aires");
    expect(advisorBranchOverrideForSale("Melissa Montoya", august)).toBe("Modelia");
  });

  it("carga solo las ventas de Xiomara del 16 de julio a Calle 109", () => {
    expect(advisorBranchOverrideForSale("Xiomara Ochoa", new Date(2026, 6, 16, 12, 0, 0))).toBe("Calle 109");
    expect(advisorBranchOverrideForSale("Xiomara Ochoa", new Date(2026, 6, 17, 12, 0, 0))).toBeNull();
  });
});
