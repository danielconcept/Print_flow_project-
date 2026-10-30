import { describe, expect, it } from "vitest";
import {
  calculateDocumentTotals,
  calculateLineAmounts,
  deriveInvoiceStatus,
  formatMoney,
  parseMoneyToMinor,
  parseMoneyToMinorNonNegative,
  parseQuantityToMilli,
  percentToBasisPoints,
  quantityMilliToString,
  validateAllocations,
} from "@/lib/domain/money";

describe("money parsing", () => {
  it("parses naira input into integer kobo", () => {
    expect(parseMoneyToMinor("₦1,250.50")).toBe(125050);
    expect(parseMoneyToMinor("NGN 0.1")).toBe(10);
    expect(parseMoneyToMinor(1234.56)).toBe(123456);
  });

  it("rejects excessive precision and negative non-negative values", () => {
    expect(() => parseMoneyToMinor("10.001")).toThrow(/decimal/);
    expect(() => parseMoneyToMinorNonNegative("-1")).toThrow(/negative/i);
  });

  it("formats minor units without losing kobo", () => {
    expect(formatMoney(125050)).toContain("1,250.50");
  });

  it("parses quantities to thousandths", () => {
    expect(parseQuantityToMilli("1.005")).toBe(1005);
    expect(parseQuantityToMilli(2)).toBe(2000);
    expect(quantityMilliToString(1005)).toBe("1.005");
    expect(quantityMilliToString(1500)).toBe("1.5");
  });

  it("rounds percentages to basis points", () => {
    expect(percentToBasisPoints("7.5")).toBe(750);
    expect(percentToBasisPoints("0.01")).toBe(1);
    expect(percentToBasisPoints("7.5099")).toBe(751);
    expect(() => percentToBasisPoints("100.1")).toThrow(/100/);
  });
});

describe("line and document totals", () => {
  it("calculates quantity, discount and tax using integers", () => {
    expect(
      calculateLineAmounts({
        quantityMilli: 2500,
        unitPriceMinor: 10000,
        discountMinor: 0,
        taxRateBp: 750,
      }),
    ).toEqual({
      baseMinor: 25000,
      taxableMinor: 25000,
      taxMinor: 1875,
      totalMinor: 26875,
    });
  });

  it("rounds fractional quantities half up", () => {
    expect(
      calculateLineAmounts({
        quantityMilli: 333,
        unitPriceMinor: 9900,
        discountMinor: 0,
        taxRateBp: 0,
      }).baseMinor,
    ).toBe(3297);
  });

  it("rejects line discounts larger than the line amount", () => {
    expect(() =>
      calculateLineAmounts({
        quantityMilli: 1000,
        unitPriceMinor: 500,
        discountMinor: 501,
        taxRateBp: 0,
      }),
    ).toThrow(/exceed/);
  });

  it("sums lines and applies an order discount to the total", () => {
    const totals = calculateDocumentTotals(
      [
        {
          quantityMilli: 2500,
          unitPriceMinor: 10000,
          discountMinor: 500,
          taxRateBp: 750,
        },
        {
          quantityMilli: 1000,
          unitPriceMinor: 2000,
          discountMinor: 0,
          taxRateBp: 0,
        },
      ],
      1000,
    );
    expect(totals.subtotalMinor).toBe(27000);
    expect(totals.itemDiscountMinor).toBe(500);
    expect(totals.taxMinor).toBe(1838);
    expect(totals.totalMinor).toBe(27338);
  });
});

describe("invoice status derivation", () => {
  const base = {
    subtotalMinor: 10000,
    itemDiscountMinor: 0,
    orderDiscountMinor: 0,
    taxMinor: 0,
    dueDate: "2026-01-01",
    today: "2026-02-01",
  };

  it("derives issued, overdue and partial states", () => {
    expect(deriveInvoiceStatus({ ...base, paidMinor: 0 })).toBe("overdue");
    expect(deriveInvoiceStatus({ ...base, paidMinor: 0, dueDate: "2026-03-01" })).toBe("issued");
    expect(deriveInvoiceStatus({ ...base, paidMinor: 5000 })).toBe("partially_paid");
    expect(deriveInvoiceStatus({ ...base, paidMinor: 10000 })).toBe("paid");
  });

  it("does not overwrite draft or void status", () => {
    expect(deriveInvoiceStatus({ ...base, paidMinor: 10000, currentStatus: "draft" })).toBe("draft");
    expect(deriveInvoiceStatus({ ...base, paidMinor: 0, currentStatus: "void" })).toBe("void");
  });
});

describe("payment allocation validation", () => {
  const invoices = [
    {
      id: "invoice-1",
      customerId: "customer-1",
      companyId: "company-1",
      totalMinor: 10000,
      paidMinor: 0,
      status: "issued",
    },
    {
      id: "invoice-2",
      customerId: "customer-1",
      companyId: "company-1",
      totalMinor: 5000,
      paidMinor: 2000,
      status: "partially_paid",
    },
    {
      id: "invoice-3",
      customerId: "customer-2",
      companyId: "company-1",
      totalMinor: 5000,
      paidMinor: 0,
      status: "issued",
    },
    {
      id: "invoice-4",
      customerId: "customer-1",
      companyId: "company-1",
      totalMinor: 5000,
      paidMinor: 0,
      status: "void",
    },
  ];

  it("allocates up to the outstanding balance and leaves the remainder unallocated", () => {
    const result = validateAllocations({
      paymentAmountMinor: 15000,
      customerId: "customer-1",
      companyId: "company-1",
      allocations: [
        { invoiceId: "invoice-1", amountMinor: 5000 },
        { invoiceId: "invoice-1", amountMinor: 1000 },
        { invoiceId: "invoice-2", amountMinor: 3000 },
      ],
      invoices,
    });
    expect(result.allocations).toEqual([
      { invoiceId: "invoice-1", amountMinor: 6000 },
      { invoiceId: "invoice-2", amountMinor: 3000 },
    ]);
    expect(result.allocatedMinor).toBe(9000);
    expect(result.unallocatedMinor).toBe(6000);
  });

  it("rejects cross-customer, cross-company and non-payable invoices", () => {
    const base = { paymentAmountMinor: 5000, customerId: "customer-1", companyId: "company-1" };
    expect(() =>
      validateAllocations({ ...base, allocations: [{ invoiceId: "invoice-3", amountMinor: 100 }], invoices }),
    ).toThrow(/customer/);
    expect(() =>
      validateAllocations({
        ...base,
        companyId: "company-2",
        allocations: [{ invoiceId: "invoice-1", amountMinor: 100 }],
        invoices,
      }),
    ).toThrow(/company/);
    expect(() =>
      validateAllocations({ ...base, allocations: [{ invoiceId: "invoice-4", amountMinor: 100 }], invoices }),
    ).toThrow(/cannot receive payments/);
  });

  it("rejects over-allocation and over-payment", () => {
    expect(() =>
      validateAllocations({
        paymentAmountMinor: 50000,
        customerId: "customer-1",
        companyId: "company-1",
        allocations: [{ invoiceId: "invoice-2", amountMinor: 3001 }],
        invoices,
      }),
    ).toThrow(/outstanding/);
    expect(() =>
      validateAllocations({
        paymentAmountMinor: 1000,
        customerId: "customer-1",
        companyId: "company-1",
        allocations: [{ invoiceId: "invoice-1", amountMinor: 1001 }],
        invoices,
      }),
    ).toThrow(/exceed the payment/);
  });
});
