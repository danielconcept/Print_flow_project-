"use server";

import { revalidatePath } from "next/cache";
import { customerSchema } from "@/lib/domain/schemas";
import { AppError } from "@/lib/errors";
import { requirePermissionApi } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PERMISSIONS } from "@/lib/permissions";
import { withAction } from "@/lib/server/actions";
import type { ActionResult } from "@/lib/errors";

export async function createCustomer(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.CUSTOMERS_MANAGE);
    const supabase = await createServerSupabaseClient();
    const parsed = customerSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("INVALID", "Invalid customer data.", parsed.error.message, 400);
    }

    const { data: code } = await supabase.rpc("next_document_number", {
      p_company_id: context.company.id,
      p_doc_type: "CUS",
    } as any);

    const { data, error } = await supabase
      .from("customers")
      .insert({
        company_id: context.company.id,
        customer_code: (code as string) ?? `CUS-${Date.now()}`,
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email ?? null,
        address: parsed.data.address ?? null,
        notes: parsed.data.notes ?? null,
        created_by: context.user.id,
        updated_by: context.user.id,
      } as any)
      .select("id")
      .single();

    if (error) throw error;
    revalidatePath("/customers");
    return { id: data.id };
  });
}

export async function updateCustomer(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.CUSTOMERS_MANAGE);
    const supabase = await createServerSupabaseClient();
    const parsed = customerSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("INVALID", "Invalid customer data.", parsed.error.message, 400);
    }

    const { data, error } = await supabase
      .from("customers")
      .update({
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email ?? null,
        address: parsed.data.address ?? null,
        notes: parsed.data.notes ?? null,
        updated_by: context.user.id,
      })
      .eq("id", id)
      .eq("company_id", context.company.id)
      .select("id")
      .single();

    if (error) throw error;
    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    return { id: data.id };
  });
}

export async function archiveCustomer(id: string): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.CUSTOMERS_MANAGE);
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("customers")
      .update({ archived_at: new Date().toISOString(), updated_by: context.user.id })
      .eq("id", id)
      .eq("company_id", context.company.id)
      .is("archived_at", null)
      .select("id")
      .single();

    if (error) throw error;
    revalidatePath("/customers");
    return { id: data.id };
  });
}
