import { describe, expect, it } from "vitest";
import {
  invoiceSchema,
  lineItemSchema,
  onboardingSchema,
  paymentSchema,
  purchaseOrderSchema,
  registerSchema,
} from "@/lib/domain/schemas";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const INVOICE_ID = "22222222-2222-4222-8222-222222222222";
const MATERIAL_ID = "33333333-3333-4333-8333-333333333333";
const SUPPLIER_ID = "44444444-4444-4444-8444-444444444444";

function lineItem(overrides: Record<string, unknown> = {}) {
  return {
    description: "Business cards",
    serviceId: "",
    quantity: "2.5",
    unit: "pack",
    unitPrice: "25,000",
    discount: "0",
    taxRate: "7.5",
    ...overrides,
  };
}

describe("line item schema", () => {
  it("normalizes naira, quantity and tax rate to integers", () => {
    const parsed = lineItemSchema.safeParse(lineItem());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.quantity).toBe(2500);
      expect(parsed.data.unitPrice).toBe(2_500_000);
      expect(parsed.data.discount).toBe(0);
      expect(parsed.data.taxRate).toBe(750);
      expect(parsed.data.serviceId).toBeUndefined();
    }
  });

  it("requires a description, positive quantity and valid price", () => {
    expect(lineItemSchema.safeParse(lineItem({ description: "" })).success).toBe(false);
    expect(lineItemSchema.safeParse(lineItem({ quantity: "0" })).success).toBe(false);
    expect(lineItemSchema.safeParse(lineItem({ unitPrice: "abc" })).success).toBe(false);
    expect(lineItemSchema.safeParse(lineItem({ discount: "-1" })).success).toBe(false);
  });
});

describe("invoice schema", () => {
  it("accepts a valid invoice with lines", () => {
    const parsed = invoiceSchema.safeParse({
      customerId: CUSTOMER_ID,
      jobOrderId: "",
      quotationId: "",
      issueDate: "2026-10-23",
      dueDate: "",
      orderDiscount: "0",
      notes: "",
      items: [lineItem()],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items).toHaveLength(1);
      expect(parsed.data.jobOrderId).toBeUndefined();
      expect(parsed.data.dueDate).toBeUndefined();
    }
  });

  it("rejects invoices without items or with invalid dates", () => {
    expect(
      invoiceSchema.safeParse({
        customerId: CUSTOMER_ID,
        issueDate: "2026-10-23",
        items: [],
      }).success,
    ).toBe(false);
    expect(
      invoiceSchema.safeParse({
        customerId: CUSTOMER_ID,
        issueDate: "23/10/2026",
        items: [lineItem()],
      }).success,
    ).toBe(false);
  });
});

describe("payment schema", () => {
  it("accepts allocations within the payment amount", () => {
    const parsed = paymentSchema.safeParse({
      customerId: CUSTOMER_ID,
      amount: "10,000",
      paymentMethod: "transfer",
      paymentDate: "2026-10-23",
      reference: "TRX-1",
      allocations: [{ invoiceId: INVOICE_ID, amount: "7,500" }],
      idempotencyKey: "payment_12345",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount).toBe(1_000_000);
      expect(parsed.data.allocations[0]?.amount).toBe(750_000);
    }
  });

  it("rejects allocations above the payment and missing idempotency keys", () => {
    expect(
      paymentSchema.safeParse({
        customerId: CUSTOMER_ID,
        amount: "1000",
        paymentMethod: "cash",
        paymentDate: "2026-10-23",
        allocations: [{ invoiceId: INVOICE_ID, amount: "1001" }],
        idempotencyKey: "payment_12345",
      }).success,
    ).toBe(false);
    expect(
      paymentSchema.safeParse({
        customerId: CUSTOMER_ID,
        amount: "1000",
        paymentMethod: "cash",
        paymentDate: "2026-10-23",
        allocations: [],
        idempotencyKey: "short",
      }).success,
    ).toBe(false);
  });
});

describe("purchase order and forms", () => {
  it("accepts a purchase order with material lines", () => {
    const parsed = purchaseOrderSchema.safeParse({
      supplierId: SUPPLIER_ID,
      orderDate: "2026-10-23",
      expectedDate: "",
      notes: "",
      items: [{ materialId: MATERIAL_ID, quantity: "100", unitCost: "50" }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items[0]).toMatchObject({ quantity: 100_000, unitCost: 5000 });
    }
  });

  it("validates onboarding slugs and password confirmation", () => {
    expect(
      onboardingSchema.safeParse({
        companyName: "Acme Prints",
        slug: "acme-prints",
        fullName: "Ada Okafor",
      }).success,
    ).toBe(true);
    expect(
      onboardingSchema.safeParse({
        companyName: "Acme Prints",
        slug: "Bad Slug!",
        fullName: "Ada Okafor",
      }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        fullName: "Ada Okafor",
        email: "ada@example.com",
        password: "password123",
        confirmPassword: "different",
      }).success,
    ).toBe(false);
  });
});
