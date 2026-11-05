"use server";

import { revalidatePath } from "next/cache";
import { paymentSchema } from "@/lib/domain/schemas";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermissionApi } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withAction } from "@/lib/server/actions";
import type { ActionResult } from "@/lib/errors";

export async function recordPayment(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.PAYMENTS_MANAGE);
    const supabase = await createServerSupabaseClient();
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("INVALID", "Invalid payment data.", parsed.error.message, 400);
    }

    const { data, error } = await supabase.rpc("record_payment", {
      p_company_id: context.company.id,
      p_customer_id: parsed.data.customerId,
      p_amount_minor: parsed.data.amount,
      p_payment_method: parsed.data.paymentMethod,
      p_payment_date: parsed.data.paymentDate,
      p_reference: null,
      p_external_reference: parsed.data.reference ?? null,
      p_notes: parsed.data.notes ?? null,
      p_allocations: parsed.data.allocations.map((item) => ({
        invoice_id: item.invoiceId,
        amount_minor: item.amount,
      })),
      p_idempotency_key: parsed.data.idempotencyKey,
    });

    if (error) throw error;
    revalidatePath("/payments");
    revalidatePath("/invoices");
    revalidatePath("/customers");
    return { id: (data as { payment_id: string }).payment_id };
  });
}

export async function reversePayment(paymentId: string, reason: string): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.PAYMENTS_REVERSE);
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase.rpc("reverse_payment", {
      p_payment_id: paymentId,
      p_reason: reason,
    });

    if (error) throw error;
    revalidatePath("/payments");
    revalidatePath("/invoices");
    revalidatePath("/customers");
    return { id: paymentId };
  });
}
