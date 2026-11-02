"use server";

import { revalidatePath } from "next/cache";
import { adjustStockSchema, materialSchema, purchaseOrderSchema, receiptSchema } from "@/lib/domain/schemas";
import { quantityMilliToNumber } from "@/lib/domain/money";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/permissions";
import { requirePermissionApi } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withAction } from "@/lib/server/actions";
import type { ActionResult } from "@/lib/errors";

export async function createMaterial(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.INVENTORY_MANAGE);
    const supabase = await createServerSupabaseClient();
    const parsed = materialSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("INVALID", "Invalid material data.", parsed.error.message, 400);
    }

    const { data, error } = await supabase
      .from("materials")
      .insert({
        company_id: context.company.id,
        material_code: parsed.data.code ?? "",
        name: parsed.data.name,
        category: parsed.data.category,
        unit: parsed.data.unit,
        reorder_level: quantityMilliToNumber(parsed.data.reorderLevel),
        active: parsed.data.active,
        created_by: context.user.id,
        updated_by: context.user.id,
      } as any)
      .select("id")
      .single();

    if (error) throw error;
    revalidatePath("/inventory");
    return { id: data.id };
  });
}

export async function adjustStock(input: unknown): Promise<ActionResult<{ movementId: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.INVENTORY_ADJUST);
    const supabase = await createServerSupabaseClient();
    const parsed = adjustStockSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("INVALID", "Invalid stock adjustment.", parsed.error.message, 400);
    }

    const { data, error } = await supabase.rpc("adjust_stock", {
      p_material_id: parsed.data.materialId,
      p_quantity_delta: quantityMilliToNumber(parsed.data.quantityDelta),
      p_movement_type: parsed.data.movementType,
      p_note: parsed.data.note,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_unit_cost_minor: parsed.data.unitCost ?? null,
    });

    if (error) throw error;
    const result = data as { movement_id?: string };
    if (!result?.movement_id) {
      throw new AppError("INTERNAL", "Stock adjustment did not return a movement ID.", "Stock adjustment could not be confirmed.", 500);
    }
    revalidatePath("/inventory");
    return { movementId: result.movement_id };
  });
}

export async function createPurchaseOrder(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.PURCHASES_MANAGE);
    const supabase = await createServerSupabaseClient();
    const parsed = purchaseOrderSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("INVALID", "Invalid purchase order data.", parsed.error.message, 400);
    }

    const { data: po, error } = await supabase
      .from("purchase_orders")
      .insert({
        company_id: context.company.id,
        supplier_id: parsed.data.supplierId,
        purchase_order_number: "",
        status: "draft",
        order_date: parsed.data.orderDate,
        expected_date: parsed.data.expectedDate ?? null,
        notes: parsed.data.notes ?? null,
        created_by: context.user.id,
        updated_by: context.user.id,
      } as any)
      .select("id")
      .single();

    if (error) throw error;

    const items = parsed.data.items.map((item, index) => ({
      purchase_order_id: (po as any).id,
      company_id: context.company.id,
      position: index,
      material_id: item.materialId,
      quantity_ordered: quantityMilliToNumber(item.quantity),
      unit_cost_minor: item.unitCost,
    }));

    const { error: itemsError } = await supabase.from("purchase_order_items").insert(items as any);
    if (itemsError) throw itemsError;

    // The database intentionally creates POs as drafts; order it only after its lines exist.
    const { error: orderError } = await supabase
      .from("purchase_orders")
      .update({ status: "ordered", updated_by: context.user.id })
      .eq("id", po.id)
      .eq("company_id", context.company.id)
      .eq("status", "draft");
    if (orderError) throw orderError;

    revalidatePath("/purchases");
    return { id: po.id };
  });
}

export async function receivePurchaseOrder(input: unknown): Promise<ActionResult<{ ok: true }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.PURCHASES_RECEIVE);
    const supabase = await createServerSupabaseClient();
    const parsed = receiptSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("INVALID", "Invalid receipt data.", parsed.error.message, 400);
    }

    const { error } = await supabase.rpc("receive_purchase_order", {
      p_purchase_order_id: parsed.data.purchaseOrderId,
      p_items: parsed.data.items.map((item) => ({
        item_id: item.itemId,
        quantity: quantityMilliToNumber(item.quantity),
        unit_cost_minor: item.unitCost ?? null,
      })),
      p_idempotency_key: parsed.data.idempotencyKey,
    });

    if (error) throw error;
    revalidatePath("/purchases");
    revalidatePath("/inventory");
    return { ok: true };
  });
}

export async function orderPurchaseOrder(id: string): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const context = await requirePermissionApi(PERMISSIONS.PURCHASES_MANAGE);
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("purchase_orders")
      .update({ status: "ordered", updated_by: context.user.id })
      .eq("id", id)
      .eq("company_id", context.company.id)
      .eq("status", "draft")
      .select("id")
      .single();

    if (error) throw error;
    revalidatePath("/purchases");
    return { id: data.id };
  });
}
