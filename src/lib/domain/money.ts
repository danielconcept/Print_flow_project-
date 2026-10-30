export class MoneyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MoneyError";
  }
}

const MAX_SAFE_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

function toSafeNumber(value: bigint, label: string): number {
  if (value > MAX_SAFE_MINOR || value < -MAX_SAFE_MINOR) {
    throw new MoneyError("AMOUNT_TOO_LARGE", `${label} is too large.`);
  }
  return Number(value);
}

function normalizeDecimalInput(value: string | number): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new MoneyError("INVALID_NUMBER", "Enter a valid number.");
    }
    return value.toString();
  }
  return value
    .trim()
    .replace(/[\u20a6,\s]/g, "")
    .replace(/^NGN/i, "");
}

interface ParsedDecimal {
  negative: boolean;
  whole: bigint;
  fraction: string;
}

function parseDecimal(value: string | number, fractionDigits: number): ParsedDecimal {
  let text = normalizeDecimalInput(value);
  let negative = false;
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }
  if (text.startsWith("+")) {
    text = text.slice(1);
  }
  if (text === "" || !/^\d+(\.\d+)?$/.test(text)) {
    throw new MoneyError("INVALID_NUMBER", "Enter a valid number.");
  }
  const [wholePart, fractionPart = ""] = text.split(".");
  if ((fractionPart ?? "").length > fractionDigits) {
    throw new MoneyError(
      "INVALID_PRECISION",
      `Use at most ${fractionDigits} decimal place${fractionDigits === 1 ? "" : "s"}.`,
    );
  }
  return {
    negative,
    whole: BigInt(wholePart ?? "0"),
    fraction: (fractionPart ?? "").padEnd(fractionDigits, "0"),
  };
}

export function parseMoneyToMinor(value: string | number): number {
  const parsed = parseDecimal(value, 2);
  const minor = parsed.whole * 100n + BigInt(parsed.fraction || "0");
  return toSafeNumber(parsed.negative ? -minor : minor, "Amount");
}

export function parseMoneyToMinorNonNegative(value: string | number): number {
  const minor = parseMoneyToMinor(value);
  if (minor < 0) {
    throw new MoneyError("NEGATIVE_AMOUNT", "Amount cannot be negative.");
  }
  return minor;
}

export function minorToDecimalString(minor: number): string {
  assertMinor(minor);
  const negative = minor < 0;
  const absolute = Math.abs(minor);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function formatMoney(
  minor: number,
  currency = "NGN",
  options: Intl.NumberFormatOptions = {},
): string {
  assertMinor(minor);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(minor / 100);
}

export function formatNaira(minor: number): string {
  return formatMoney(minor, "NGN");
}

export function assertMinor(value: number, label = "Amount"): void {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError("INVALID_MINOR_UNITS", `${label} must be a whole number of kobo.`);
  }
}

export function parseQuantityToMilli(value: string | number): number {
  const parsed = parseDecimal(value, 3);
  const milli = parsed.whole * 1000n + BigInt(parsed.fraction || "0");
  return toSafeNumber(parsed.negative ? -milli : milli, "Quantity");
}

export function quantityMilliToString(value: number): string {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError("INVALID_QUANTITY", "Quantity precision is invalid.");
  }
  const negative = value < 0;
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 1000);
  const fraction = String(absolute % 1000).padStart(3, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function quantityMilliToNumber(value: number): number {
  return value / 1000;
}

export function percentToBasisPoints(value: string | number): number {
  const parsed = parseDecimal(value, 4);
  if (parsed.negative) {
    throw new MoneyError("NEGATIVE_RATE", "Rate cannot be negative.");
  }
  const bp = divRoundHalfUp(parsed.whole * 10000n + BigInt(parsed.fraction || "0"), 100n);
  if (bp > 10000n) {
    throw new MoneyError("RATE_TOO_HIGH", "Rate cannot exceed 100%.");
  }
  return Number(bp);
}

export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new MoneyError("DIVISION_BY_ZERO", "Cannot divide by zero.");
  }
  const negative = (numerator < 0n) !== (denominator < 0n);
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const result = (n + d / 2n) / d;
  return negative ? -result : result;
}

export interface LineAmountsInput {
  quantityMilli: number;
  unitPriceMinor: number;
  discountMinor: number;
  taxRateBp: number;
}

export interface LineAmounts {
  baseMinor: number;
  taxableMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export function calculateLineAmounts(input: LineAmountsInput): LineAmounts {
  if (!Number.isSafeInteger(input.quantityMilli) || input.quantityMilli <= 0) {
    throw new MoneyError("INVALID_QUANTITY", "Quantity must be greater than zero.");
  }
  assertMinor(input.unitPriceMinor, "Unit price");
  assertMinor(input.discountMinor, "Discount");
  if (input.unitPriceMinor < 0 || input.discountMinor < 0) {
    throw new MoneyError("NEGATIVE_AMOUNT", "Amounts cannot be negative.");
  }
  if (!Number.isInteger(input.taxRateBp) || input.taxRateBp < 0 || input.taxRateBp > 10000) {
    throw new MoneyError("INVALID_TAX_RATE", "Tax rate must be between 0 and 100.");
  }

  const base = divRoundHalfUp(
    BigInt(input.quantityMilli) * BigInt(input.unitPriceMinor),
    1000n,
  );
  if (BigInt(input.discountMinor) > base) {
    throw new MoneyError("DISCOUNT_EXCEEDS_LINE", "Discount cannot exceed the line amount.");
  }
  const taxable = base - BigInt(input.discountMinor);
  const tax = divRoundHalfUp(taxable * BigInt(input.taxRateBp), 10000n);
  return {
    baseMinor: toSafeNumber(base, "Line amount"),
    taxableMinor: toSafeNumber(taxable, "Taxable amount"),
    taxMinor: toSafeNumber(tax, "Tax"),
    totalMinor: toSafeNumber(taxable + tax, "Line total"),
  };
}

export interface DocumentLineInput extends LineAmountsInput {
  description?: string;
  serviceId?: string | null;
  unit?: string;
}

export interface DocumentTotals {
  subtotalMinor: number;
  itemDiscountMinor: number;
  orderDiscountMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  lines: LineAmounts[];
}

export function calculateDocumentTotals(
  lines: LineAmountsInput[],
  orderDiscountMinor = 0,
): DocumentTotals {
  assertMinor(orderDiscountMinor, "Order discount");
  if (orderDiscountMinor < 0) {
    throw new MoneyError("NEGATIVE_AMOUNT", "Discount cannot be negative.");
  }
  if (lines.length === 0) {
    throw new MoneyError("EMPTY_DOCUMENT", "Add at least one line item.");
  }

  let subtotal = 0n;
  let itemDiscount = 0n;
  let tax = 0n;
  const calculated: LineAmounts[] = [];

  for (const line of lines) {
    const amounts = calculateLineAmounts(line);
    subtotal += BigInt(amounts.baseMinor);
    itemDiscount += BigInt(line.discountMinor);
    tax += BigInt(amounts.taxMinor);
    calculated.push(amounts);
  }

  const total = subtotal - itemDiscount - BigInt(orderDiscountMinor) + tax;
  if (total < 0n) {
    throw new MoneyError("NEGATIVE_TOTAL", "Discount cannot exceed the document total.");
  }

  return {
    subtotalMinor: toSafeNumber(subtotal, "Subtotal"),
    itemDiscountMinor: toSafeNumber(itemDiscount, "Item discount"),
    orderDiscountMinor,
    discountMinor: toSafeNumber(itemDiscount + BigInt(orderDiscountMinor), "Discount"),
    taxMinor: toSafeNumber(tax, "Tax"),
    totalMinor: toSafeNumber(total, "Total"),
    lines: calculated,
  };
}

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";

export function deriveInvoiceStatus(input: {
  subtotalMinor: number;
  itemDiscountMinor: number;
  orderDiscountMinor: number;
  taxMinor: number;
  paidMinor: number;
  dueDate?: string | null;
  currentStatus?: InvoiceStatus;
  today?: string;
}): InvoiceStatus {
  const total =
    input.subtotalMinor -
    input.itemDiscountMinor -
    input.orderDiscountMinor +
    input.taxMinor;
  if (total < 0) {
    throw new MoneyError("NEGATIVE_TOTAL", "Invoice total cannot be negative.");
  }
  if (input.currentStatus === "void") return "void";
  if (input.currentStatus === "draft") return "draft";
  if (input.paidMinor >= total && total > 0) return "paid";
  if (input.paidMinor > 0) return "partially_paid";
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  if (input.dueDate && input.dueDate < today) return "overdue";
  return "issued";
}

export interface AllocationRequest {
  invoiceId: string;
  amountMinor: number;
}

export interface AllocationInvoice {
  id: string;
  customerId: string;
  companyId: string;
  totalMinor: number;
  paidMinor: number;
  status: string;
}

export interface ValidatedAllocation {
  invoiceId: string;
  amountMinor: number;
}

export interface AllocationResult {
  allocations: ValidatedAllocation[];
  allocatedMinor: number;
  unallocatedMinor: number;
}

export function validateAllocations(input: {
  paymentAmountMinor: number;
  customerId: string;
  companyId: string;
  allocations: AllocationRequest[];
  invoices: AllocationInvoice[];
}): AllocationResult {
  assertMinor(input.paymentAmountMinor, "Payment amount");
  if (input.paymentAmountMinor <= 0) {
    throw new MoneyError("INVALID_PAYMENT", "Payment amount must be greater than zero.");
  }

  const grouped = new Map<string, number>();
  for (const allocation of input.allocations) {
    assertMinor(allocation.amountMinor, "Allocation amount");
    if (allocation.amountMinor <= 0) {
      throw new MoneyError("INVALID_ALLOCATION", "Allocation amounts must be greater than zero.");
    }
    grouped.set(
      allocation.invoiceId,
      (grouped.get(allocation.invoiceId) ?? 0) + allocation.amountMinor,
    );
  }

  const invoiceMap = new Map(input.invoices.map((invoice) => [invoice.id, invoice]));
  const validated: ValidatedAllocation[] = [];
  let allocated = 0;

  for (const [invoiceId, amountMinor] of grouped) {
    const invoice = invoiceMap.get(invoiceId);
    if (!invoice) {
      throw new MoneyError("INVOICE_NOT_FOUND", "One of the selected invoices was not found.");
    }
    if (invoice.companyId !== input.companyId) {
      throw new MoneyError("TENANT_MISMATCH", "Invoice does not belong to this company.");
    }
    if (invoice.customerId !== input.customerId) {
      throw new MoneyError("CUSTOMER_MISMATCH", "Invoice does not belong to the selected customer.");
    }
    if (invoice.status === "draft" || invoice.status === "void") {
      throw new MoneyError("INVOICE_NOT_PAYABLE", "Draft or void invoices cannot receive payments.");
    }
    const outstanding = invoice.totalMinor - invoice.paidMinor;
    if (amountMinor > outstanding) {
      throw new MoneyError(
        "ALLOCATION_EXCEEDS_OUTSTANDING",
        "An allocation cannot exceed the invoice outstanding balance.",
      );
    }
    validated.push({ invoiceId, amountMinor });
    allocated += amountMinor;
  }

  if (allocated > input.paymentAmountMinor) {
    throw new MoneyError(
      "ALLOCATIONS_EXCEED_PAYMENT",
      "Allocations cannot exceed the payment amount.",
    );
  }

  return {
    allocations: validated,
    allocatedMinor: allocated,
    unallocatedMinor: input.paymentAmountMinor - allocated,
  };
}
