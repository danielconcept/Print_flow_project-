"use server";

import { revalidatePath } from "next/cache";
import { invoiceSchema } from "@/lib/domain/schemas";
import { quantityMilliToNumber } from "@/lib/domain/money";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermissionApi } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withAction } from "@/lib/server/actions";
import type { ActionResult } from "@/lib/errors";

export async function createInvoice(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.INVOICES_MANAGE);
    const supabase = await createServerSupabaseClient();
    const parsed = invoiceSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("INVALID", "Invalid invoice data.", parsed.error.message, 400);
    }

    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        company_id: context.company.id,
        customer_id: parsed.data.customerId,
        job_order_id: parsed.data.jobOrderId ?? null,
        quotation_id: parsed.data.quotationId ?? null,
        invoice_number: "",
        status: "draft",
        issue_date: parsed.data.issueDate,
        due_date: parsed.data.dueDate ?? null,
        order_discount_minor: parsed.data.orderDiscount,
        notes: parsed.data.notes ?? null,
        created_by: context.user.id,
        updated_by: context.user.id,
      } as any)
      .select("id")
      .single();

    if (error) throw error;

    const items = parsed.data.items.map((item, index) => ({
      invoice_id: (invoice as any).id,
      company_id: context.company.id,
      position: index,
      description: item.description,
      service_id: item.serviceId ?? null,
      quantity: quantityMilliToNumber(item.quantity),
      unit: item.unit,
      unit_price_minor: item.unitPrice,
      discount_minor: item.discount,
      tax_rate: item.taxRate / 100,
      dimensions: item.dimensions ?? null,
    }));

    const { error: itemsError } = await supabase.from("invoice_items").insert(items as any);
    if (itemsError) throw itemsError;

    revalidatePath("/invoices");
    return { id: invoice.id };
  });
}

export async function issueInvoice(id: string): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.INVOICES_MANAGE);
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("invoices")
      .update({ status: "issued", updated_by: context.user.id })
      .eq("id", id)
      .eq("company_id", context.company.id)
      .eq("status", "draft")
      .select("id")
      .single();

    if (error) throw error;
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    return { id: data.id };
  });
}

export async function voidInvoice(id: string, reason: string): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.INVOICES_VOID);
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase.rpc("void_invoice", {
      p_invoice_id: id,
      p_reason: reason,
    });

    if (error) throw error;
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${id}`);
    return { id };
  });
}
