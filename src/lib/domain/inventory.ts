import { divRoundHalfUp, MoneyError, quantityMilliToString } from "./money";

interface DecimalParts {
  negative: boolean;
  whole: bigint;
  fraction: string;
}

function parseDecimal(value: string | number, fractionDigits: number): DecimalParts {
  let text = typeof value === "number" ? value.toString() : value.trim();
  let negative = false;
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new MoneyError("INVALID_NUMBER", "Enter a valid number.");
  }
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > fractionDigits) {
    throw new MoneyError("INVALID_PRECISION", `Use at most ${fractionDigits} decimal places.`);
  }
  return {
    negative,
    whole: BigInt(whole ?? "0"),
    fraction: fraction.padEnd(fractionDigits, "0"),
  };
}

export interface RecipeRequirement {
  materialId: string;
  materialName: string;
  unit: string;
  quantityPerOutputUnit: string | number;
  wastePercentage: string | number;
}

export interface EstimatedRequirement {
  materialId: string;
  materialName: string;
  unit: string;
  quantityMilli: number;
  quantity: string;
}

export function estimateMaterialRequirements(
  recipes: RecipeRequirement[],
  outputQuantityMilli: number,
): EstimatedRequirement[] {
  if (!Number.isSafeInteger(outputQuantityMilli) || outputQuantityMilli <= 0) {
    throw new MoneyError("INVALID_QUANTITY", "Output quantity must be greater than zero.");
  }

  return recipes.map((recipe) => {
    const perUnit = parseDecimal(recipe.quantityPerOutputUnit, 4);
    if (perUnit.negative || perUnit.whole === 0n && perUnit.fraction === "0000") {
      throw new MoneyError("INVALID_RECIPE", "Recipe quantity must be greater than zero.");
    }
    const perUnitScaled = perUnit.whole * 10000n + BigInt(perUnit.fraction);
    const waste = parseDecimal(recipe.wastePercentage, 2);
    if (waste.negative) {
      throw new MoneyError("INVALID_WASTE", "Waste percentage cannot be negative.");
    }
    const wasteBp = waste.whole * 100n + BigInt(waste.fraction);
    if (wasteBp > 10000n) {
      throw new MoneyError("INVALID_WASTE", "Waste percentage cannot exceed 100%.");
    }

    const quantityMilliBig =
      (BigInt(outputQuantityMilli) * perUnitScaled * (10000n + wasteBp) + 50_000_000n) /
      100_000_000n;

    const quantityMilli = Number(quantityMilliBig);
    if (!Number.isSafeInteger(quantityMilli)) {
      throw new MoneyError("QUANTITY_TOO_LARGE", "Required quantity is too large.");
    }

    return {
      materialId: recipe.materialId,
      materialName: recipe.materialName,
      unit: recipe.unit,
      quantityMilli,
      quantity: quantityMilliToString(quantityMilli),
    };
  });
}

export function weightedAverageCost(input: {
  oldQuantityMilli: number;
  oldUnitCostMinor: number;
  receivedQuantityMilli: number;
  receivedUnitCostMinor: number;
}): number {
  const oldQty = BigInt(input.oldQuantityMilli);
  const newQty = BigInt(input.receivedQuantityMilli);
  const totalQty = oldQty + newQty;
  if (totalQty <= 0n) {
    return input.receivedUnitCostMinor;
  }
  const value =
    oldQty * BigInt(input.oldUnitCostMinor) + newQty * BigInt(input.receivedUnitCostMinor);
  return Number(divRoundHalfUp(value, totalQty));
}

export function stockValueMinor(quantityMilli: number, averageUnitCostMinor: number): number {
  return Number(
    divRoundHalfUp(BigInt(quantityMilli) * BigInt(averageUnitCostMinor), 1000n),
  );
}

export function consumptionCostMinor(quantityMilli: number, unitCostMinor: number): number {
  return Number(divRoundHalfUp(BigInt(quantityMilli) * BigInt(unitCostMinor), 1000n));
}

export function applyStockDelta(currentQuantityMilli: number, deltaMilli: number): number {
  const next = currentQuantityMilli + deltaMilli;
  if (next < 0) {
    throw new MoneyError("INSUFFICIENT_STOCK", "Stock cannot go below zero.");
  }
  return next;
}

export function isLowStock(quantityMilli: number, reorderLevelMilli: number): boolean {
  return quantityMilli <= reorderLevelMilli;
}

export function totalMaterialCost(
  movements: Array<{ quantityDeltaMilli: number; unitCostMinor: number | null }>,
): number {
  const total = movements.reduce(
    (sum, movement) =>
      sum +
      divRoundHalfUp(
        BigInt(Math.abs(movement.quantityDeltaMilli)) * BigInt(movement.unitCostMinor ?? 0),
        1000n,
      ),
    0n,
  );
  return Number(total);
}
