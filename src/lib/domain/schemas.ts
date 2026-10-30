import { z } from "zod";
import {
  parseMoneyToMinorNonNegative,
  parseQuantityToMilli,
  percentToBasisPoints,
} from "./money";
import { JOB_PRIORITIES } from "./jobs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const uuidSchema = z.string().regex(UUID_RE, "Select a valid record.");
export const dateSchema = z.string().regex(DATE_RE, "Use a valid date.");
export const optionalDateSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  dateSchema.optional(),
);
export const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().trim().max(max).optional(),
  );
export const optionalEmailSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().trim().email("Enter a valid email address.").max(254).optional(),
);

function moneyField(label: string) {
  return z
    .union([z.string(), z.number()])
    .transform((value, ctx) => {
      try {
        return parseMoneyToMinorNonNegative(value);
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          message: (error as Error).message || `${label} is invalid.`,
        });
        return 0;
      }
    });
}

function moneyFieldAllowNegative(label: string) {
  return z.union([z.string(), z.number()]).transform((value, ctx) => {
    try {
      const text = typeof value === "string" ? value.trim().replace(/[\u20a6,\s]/g, "") : value;
      if (typeof text === "string" && text.startsWith("-")) {
        return -parseMoneyToMinorNonNegative(text.slice(1));
      }
      return parseMoneyToMinorNonNegative(text);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: (error as Error).message || `${label} is invalid.`,
      });
      return 0;
    }
  });
}

function quantityField(allowNegative = false, allowZero = false) {
  return z
    .union([z.string(), z.number()])
    .transform((value, ctx) => {
      try {
        const parsed = parseQuantityToMilli(value);
        if (!allowZero && !allowNegative && parsed <= 0) {
          ctx.addIssue({ code: "custom", message: "Quantity must be greater than zero." });
        }
        if (!allowZero && allowNegative && parsed === 0) {
          ctx.addIssue({ code: "custom", message: "Quantity adjustment cannot be zero." });
        }
        return parsed;
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          message: (error as Error).message || "Quantity is invalid.",
        });
        return 0;
      }
    });
}

function taxRateField() {
  return z
    .union([z.string(), z.number()])
    .transform((value, ctx) => {
      try {
        return percentToBasisPoints(value);
      } catch (error) {
        ctx.addIssue({
          code: "custom",
          message: (error as Error).message || "Tax rate is invalid.",
        });
        return 0;
      }
    });
}

export const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Enter a description.").max(500),
  serviceId: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    uuidSchema.optional(),
  ),
  quantity: quantityField(),
  unit: z.string().trim().min(1, "Enter a unit.").max(30),
  unitPrice: moneyField("Unit price"),
  discount: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? "0" : value),
    moneyField("Discount"),
  ),
  taxRate: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? "0" : value),
    taxRateField(),
  ),
  dimensions: z
    .object({
      width: z.union([z.string(), z.number()]).optional(),
      height: z.union([z.string(), z.number()]).optional(),
      unit: z.enum(["mm", "cm", "m", "inch"]).optional(),
    })
    .optional(),
  productionNotes: optionalText(1000),
});

export type LineItemInput = z.infer<typeof lineItemSchema>;

export const lineItemsSchema = z.array(lineItemSchema).min(1, "Add at least one line item.").max(100);

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Enter the customer name.").max(160),
  phone: z.string().trim().min(5, "Enter a phone number.").max(40),
  email: optionalEmailSchema,
  address: optionalText(500),
  notes: optionalText(2000),
});

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Enter a service name.").max(120),
  description: optionalText(1000),
  category: z.string().trim().min(2, "Enter a category.").max(60),
  defaultUnit: z.string().trim().min(1, "Enter a default unit.").max(30),
  defaultPrice: moneyField("Default price"),
  active: z.boolean().default(true),
});

export const quotationSchema = z.object({
  customerId: uuidSchema,
  issueDate: dateSchema,
  validUntil: optionalDateSchema,
  orderDiscount: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? "0" : value),
    moneyField("Order discount"),
  ),
  notes: optionalText(2000),
  terms: optionalText(4000),
  items: lineItemsSchema,
});

export const jobSchema = z.object({
  customerId: uuidSchema,
  title: z.string().trim().min(2, "Enter a job title.").max(180),
  description: optionalText(3000),
  priority: z.enum(JOB_PRIORITIES),
  dueDate: optionalDateSchema,
  designRequired: z.boolean().default(false),
  designApprovalRequired: z.boolean().default(false),
  items: lineItemsSchema,
});

export const invoiceSchema = z.object({
  customerId: uuidSchema,
  jobOrderId: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    uuidSchema.optional(),
  ),
  quotationId: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    uuidSchema.optional(),
  ),
  issueDate: dateSchema,
  dueDate: optionalDateSchema,
  orderDiscount: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? "0" : value),
    moneyField("Order discount"),
  ),
  notes: optionalText(2000),
  items: lineItemsSchema,
});

export const paymentAllocationSchema = z.object({
  invoiceId: uuidSchema,
  amount: moneyField("Allocation"),
});

export const paymentSchema = z
  .object({
    customerId: uuidSchema,
    amount: moneyField("Payment amount"),
    paymentMethod: z.string().trim().min(2, "Choose a payment method.").max(40),
    paymentDate: dateSchema,
    reference: z.string().trim().max(80).optional(),
    notes: optionalText(2000),
    allocations: z.array(paymentAllocationSchema).max(50),
    idempotencyKey: z.string().trim().min(8, "Missing idempotency key."),
  })
  .superRefine((value, ctx) => {
    const total = value.allocations.reduce((sum, item) => sum + item.amount, 0);
    if (total > value.amount) {
      ctx.addIssue({
        code: "custom",
        path: ["allocations"],
        message: "Allocations cannot exceed the payment amount.",
      });
    }
    if (value.amount <= 0) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter an amount greater than zero." });
    }
  });

export const materialSchema = z.object({
  name: z.string().trim().min(2, "Enter a material name.").max(160),
  code: optionalText(40),
  category: z.string().trim().min(2, "Enter a category.").max(60),
  unit: z.string().trim().min(1, "Enter a unit.").max(30),
  reorderLevel: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? "0" : value),
    quantityField(true, true).pipe(z.number().min(0)),
  ),
  active: z.boolean().default(true),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Enter the supplier name.").max(160),
  code: optionalText(40),
  contactPerson: optionalText(120),
  phone: optionalText(40),
  email: optionalEmailSchema,
  address: optionalText(500),
  notes: optionalText(2000),
});

export const purchaseOrderItemSchema = z.object({
  materialId: uuidSchema,
  quantity: quantityField(),
  unitCost: moneyField("Unit cost"),
});

export const purchaseOrderSchema = z.object({
  supplierId: uuidSchema,
  orderDate: dateSchema,
  expectedDate: optionalDateSchema,
  notes: optionalText(2000),
  items: z.array(purchaseOrderItemSchema).min(1, "Add at least one material.").max(100),
});

export const receiptItemSchema = z.object({
  itemId: uuidSchema,
  quantity: quantityField(),
  unitCost: moneyField("Unit cost").optional(),
});

export const receiptSchema = z.object({
  purchaseOrderId: uuidSchema,
  items: z.array(receiptItemSchema).min(1, "Add at least one receipt line."),
  idempotencyKey: z.string().trim().min(8),
});

export const expenseSchema = z.object({
  category: z.string().trim().min(2, "Enter a category.").max(60),
  description: z.string().trim().min(2, "Enter a description.").max(300),
  amount: moneyField("Amount"),
  expenseDate: dateSchema,
  paymentMethod: optionalText(40),
  supplierId: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    uuidSchema.optional(),
  ),
  notes: optionalText(2000),
});

export const settingsSchema = z.object({
  name: z.string().trim().min(2, "Enter the company name.").max(120),
  legalName: optionalText(160),
  email: optionalEmailSchema,
  phone: optionalText(40),
  address: optionalText(500),
  timezone: z.string().trim().min(3).max(60),
  taxLabel: z.string().trim().min(1).max(20),
  defaultTaxRate: taxRateField(),
  pricesIncludeTax: z.boolean().default(false),
  paymentMethods: z.string().trim().max(300).optional(),
  expenseCategories: z.string().trim().max(500).optional(),
  quotationTerms: optionalText(4000),
  invoiceFooter: optionalText(1000),
});

export const invitationSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
  role: z.enum(["admin", "staff"]),
  permissions: z.array(z.string()).default([]),
});

export const memberUpdateSchema = z.object({
  membershipId: uuidSchema,
  role: z.enum(["admin", "staff"]),
  permissions: z.array(z.string()).default([]),
});

export const artworkReviewSchema = z.object({
  artworkId: uuidSchema,
  status: z.enum(["awaiting_approval", "approved", "revision_required"]),
  note: optionalText(500),
});

export const consumptionItemSchema = z.object({
  materialId: uuidSchema,
  quantity: quantityField(),
});

export const consumptionSchema = z.object({
  jobId: uuidSchema,
  items: z.array(consumptionItemSchema).min(1, "Add at least one material."),
  note: optionalText(500),
  idempotencyKey: z.string().trim().min(8),
});

export const adjustStockSchema = z.object({
  materialId: uuidSchema,
  quantityDelta: quantityField(true),
  movementType: z.enum(["opening", "adjustment", "waste", "reversal", "return"]),
  note: z.string().trim().min(3, "Enter a reason for the adjustment.").max(500),
  idempotencyKey: z.string().trim().min(8),
  unitCost: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    moneyField("Unit cost").optional(),
  ),
});

export const recipeSchema = z.object({
  serviceId: uuidSchema,
  materialId: uuidSchema,
  quantityPerUnit: quantityField(),
  wastePercentage: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? "0" : value),
    z.union([z.string(), z.number()]).transform((value, ctx) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        ctx.addIssue({ code: "custom", message: "Waste must be between 0 and 100." });
        return 0;
      }
      return Math.round(parsed * 100) / 100;
    }),
  ),
});

export const onboardingSchema = z.object({
  companyName: z.string().trim().min(2, "Enter your company name.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Use at least 3 characters.")
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, "Use lowercase letters, numbers and hyphens."),
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(8, "Use at least 8 characters.").max(72),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters.").max(72),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: optionalText(40),
});

export const searchParamsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
  sort: z.string().trim().max(40).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
});

export function parseMoneyInput(value: string | number): number {
  return parseMoneyToMinorNonNegative(value);
}

export function parseQuantityInput(value: string | number): number {
  return parseQuantityToMilli(value);
}

export { moneyField, moneyFieldAllowNegative, quantityField, taxRateField };
