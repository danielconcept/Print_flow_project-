"use server";

import { revalidatePath } from "next/cache";
import { quotationSchema } from "@/lib/domain/schemas";
import { quantityMilliToNumber } from "@/lib/domain/money";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermissionApi } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withAction } from "@/lib/server/actions";
import type { ActionResult } from "@/lib/errors";

export async function createQuotation(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.QUOTATIONS_MANAGE);
    const supabase = await createServerSupabaseClient();
    const parsed = quotationSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("INVALID", "Invalid quotation data.", parsed.error.message, 400);
    }

    const { data: quotation, error } = await supabase
      .from("quotations")
      .insert({
        company_id: context.company.id,
        customer_id: parsed.data.customerId,
        quotation_number: "",
        status: "draft",
        issue_date: parsed.data.issueDate,
        valid_until: parsed.data.validUntil ?? null,
        order_discount_minor: parsed.data.orderDiscount,
        notes: parsed.data.notes ?? null,
        terms: parsed.data.terms ?? null,
        created_by: context.user.id,
        updated_by: context.user.id,
      } as any)
      .select("id")
      .single();

    if (error) throw error;

    const items = parsed.data.items.map((item, index) => ({
      quotation_id: (quotation as any).id,
      company_id: context.company.id,
      position: index,
      description: item.description,
      service_id: item.serviceId ?? null,
      quantity: quantityMilliToNumber(item.quantity),
      unit: item.unit,
      unit_price_minor: item.unitPrice,
      discount_minor: item.discount,
      tax_rate: item.taxRate / 100,
    }));

    const { error: itemsError } = await supabase.from("quotation_items").insert(items as any);
    if (itemsError) throw itemsError;

    revalidatePath("/quotations");
    return { id: quotation.id };
  });
}

export async function updateQuotationStatus(
  id: string,
  status: "sent" | "accepted" | "rejected" | "expired",
): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.QUOTATIONS_MANAGE);
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("quotations")
      .update({ status, updated_by: context.user.id })
      .eq("id", id)
      .eq("company_id", context.company.id)
      .select("id")
      .single();

    if (error) throw error;
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${id}`);
    return { id: data.id };
  });
}

export async function convertQuotationToJob(
  id: string,
  input: {
    jobTitle?: string;
    dueDate?: string;
    priority?: "low" | "normal" | "high" | "urgent";
  } = {},
): Promise<ActionResult<{ jobId: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.JOBS_MANAGE);
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc("convert_quotation_to_job", {
      p_quotation_id: id,
      p_title: input.jobTitle ?? null,
      p_due_date: input.dueDate ?? null,
      p_priority: input.priority ?? "normal",
    });

    if (error) throw error;
    revalidatePath("/quotations");
    revalidatePath("/jobs");
    return { jobId: data as string };
  });
}
