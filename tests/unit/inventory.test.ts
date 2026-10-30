import { describe, expect, it } from "vitest";
import {
  applyStockDelta,
  consumptionCostMinor,
  estimateMaterialRequirements,
  isLowStock,
  stockValueMinor,
  weightedAverageCost,
} from "@/lib/domain/inventory";

describe("material requirement estimation", () => {
  it("scales recipe quantities and includes waste", () => {
    const [requirement] = estimateMaterialRequirements(
      [
        {
          materialId: "material-1",
          materialName: "A4 80gsm",
          unit: "sheet",
          quantityPerOutputUnit: "0.5",
          wastePercentage: "10",
        },
      ],
      1500,
    );
    expect(requirement.quantityMilli).toBe(825);
    expect(requirement.quantity).toBe("0.825");
  });

  it("supports fractional recipe rates", () => {
    const [requirement] = estimateMaterialRequirements(
      [
        {
          materialId: "material-1",
          materialName: "Vinyl",
          unit: "m",
          quantityPerOutputUnit: "0.0001",
          wastePercentage: "0",
        },
      ],
      10_000,
    );
    expect(requirement.quantityMilli).toBe(1);
  });

  it("rejects invalid output and waste values", () => {
    expect(() => estimateMaterialRequirements([], 0)).toThrow(/greater than zero/);
    expect(() =>
      estimateMaterialRequirements(
        [
          {
            materialId: "material-1",
            materialName: "Vinyl",
            unit: "m",
            quantityPerOutputUnit: "1",
            wastePercentage: "101",
          },
        ],
        1000,
      ),
    ).toThrow(/100/);
  });
});

describe("inventory valuation", () => {
  it("computes weighted average unit cost", () => {
    expect(
      weightedAverageCost({
        oldQuantityMilli: 1000,
        oldUnitCostMinor: 500,
        receivedQuantityMilli: 2000,
        receivedUnitCostMinor: 800,
      }),
    ).toBe(700);
  });

  it("values stock and consumption using integer rounding", () => {
    expect(stockValueMinor(1500, 700)).toBe(1050);
    expect(consumptionCostMinor(333, 1000)).toBe(333);
    expect(consumptionCostMinor(1, 500)).toBe(1);
  });

  it("prevents negative stock and detects low stock", () => {
    expect(applyStockDelta(1000, 500)).toBe(1500);
    expect(applyStockDelta(1000, -1000)).toBe(0);
    expect(() => applyStockDelta(1000, -1001)).toThrow(/below zero/);
    expect(isLowStock(500, 500)).toBe(true);
    expect(isLowStock(501, 500)).toBe(false);
  });
});
