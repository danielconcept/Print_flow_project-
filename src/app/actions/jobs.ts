"use server";

import { revalidatePath } from "next/cache";
import { jobSchema } from "@/lib/domain/schemas";
import { calculateLineAmounts, quantityMilliToNumber } from "@/lib/domain/money";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermissionApi } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withAction } from "@/lib/server/actions";
import type { ActionResult } from "@/lib/errors";

export async function createJob(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.JOBS_MANAGE);
    const supabase = await createServerSupabaseClient();
    const parsed = jobSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("INVALID", "Invalid job data.", parsed.error.message, 400);
    }

    const { data: job, error } = await supabase
      .from("job_orders")
      .insert({
        company_id: context.company.id,
        customer_id: parsed.data.customerId,
        job_number: "",
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        status: "received",
        priority: parsed.data.priority,
        due_date: parsed.data.dueDate ?? null,
        design_required: parsed.data.designRequired,
        design_approval_required: parsed.data.designApprovalRequired,
        created_by: context.user.id,
        updated_by: context.user.id,
      } as any)
      .select("id")
      .single();

    if (error) throw error;

    const items = parsed.data.items.map((item, index) => ({
      job_order_id: (job as any).id,
      company_id: context.company.id,
      position: index,
      description: item.description,
      service_id: item.serviceId ?? null,
      quantity: quantityMilliToNumber(item.quantity),
      unit: item.unit,
      unit_price_minor: item.unitPrice,
      discount_minor: item.discount,
      tax_minor: calculateLineAmounts({
        quantityMilli: item.quantity,
        unitPriceMinor: item.unitPrice,
        discountMinor: item.discount,
        taxRateBp: item.taxRate,
      }).taxMinor,
      dimensions: item.dimensions ?? null,
      production_notes: item.productionNotes ?? null,
    }));

    const { error: itemsError } = await supabase.from("job_items").insert(items as any);
    if (itemsError) throw itemsError;

    revalidatePath("/jobs");
    return { id: job.id };
  });
}

export async function transitionJobStatus(
  jobId: string,
  toStatus: string,
  reason?: string,
): Promise<ActionResult<{ status: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.JOBS_UPDATE_STATUS);
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc("transition_job_status", {
      p_job_id: jobId,
      p_new_status: toStatus,
      p_note: reason ?? null,
    });

    if (error) throw error;
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${jobId}`);
    return { status: (data as { status: string }).status };
  });
}

export async function consumeJobMaterials(
  jobId: string,
  items: Array<{ materialId: string; quantity: number }>,
  note?: string,
  idempotencyKey?: string,
): Promise<ActionResult<{ ok: true }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.JOBS_CONSUME_MATERIALS);
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase.rpc("consume_job_materials", {
      p_job_id: jobId,
      p_items: items.map((item) => ({ material_id: item.materialId, quantity: quantityMilliToNumber(item.quantity) })),
      p_note: note ?? null,
      p_idempotency_key: idempotencyKey ?? crypto.randomUUID(),
    });

    if (error) throw error;
    revalidatePath("/jobs");
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/inventory");
    return { ok: true };
  });
}
