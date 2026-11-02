-- Return the stock movement ID for both fresh and idempotent stock adjustments.
-- The server action uses this ID to confirm exactly which movement was applied.

create or replace function public.adjust_stock(
  p_material_id uuid,
  p_quantity_delta numeric,
  p_movement_type text,
  p_note text,
  p_idempotency_key text,
  p_unit_cost_minor bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_material public.materials;
  v_new_qty numeric;
  v_movement_id uuid;
begin
  select * into v_material
  from public.materials
  where id = p_material_id
  for update;

  if v_material.id is null then
    raise exception 'MATERIAL_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not public.has_company_permission(v_material.company_id, 'inventory.adjust') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_quantity_delta is null or p_quantity_delta = 0 then
    raise exception 'STOCK_DELTA_REQUIRED' using errcode = 'P0001';
  end if;
  if p_movement_type not in ('opening', 'adjustment', 'waste', 'reversal', 'return') then
    raise exception 'INVALID_MOVEMENT_TYPE' using errcode = 'P0001';
  end if;
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;
  if p_unit_cost_minor is not null and p_unit_cost_minor < 0 then
    raise exception 'INVALID_UNIT_COST' using errcode = 'P0001';
  end if;

  select id into v_movement_id
  from public.stock_movements
  where company_id = v_material.company_id and idempotency_key = p_idempotency_key;

  if v_movement_id is not null then
    return jsonb_build_object(
      'status', 'duplicate',
      'material_id', v_material.id,
      'movement_id', v_movement_id
    );
  end if;

  v_new_qty := v_material.quantity_on_hand + p_quantity_delta;
  if v_new_qty < 0 then
    raise exception 'INSUFFICIENT_STOCK' using errcode = 'P0001';
  end if;

  insert into public.stock_movements (
    company_id, material_id, movement_type, quantity_delta, unit_cost_minor,
    reference_type, reference_id, note, performed_by, idempotency_key
  ) values (
    v_material.company_id, v_material.id, p_movement_type, p_quantity_delta,
    coalesce(p_unit_cost_minor, v_material.average_unit_cost_minor),
    'adjustment', v_material.id, p_note, auth.uid(), p_idempotency_key
  ) returning id into v_movement_id;

  perform set_config('app.stock_movement', 'allowed', true);
  update public.materials
  set quantity_on_hand = v_new_qty,
      average_unit_cost_minor = case
        when p_movement_type = 'opening' and p_unit_cost_minor is not null and quantity_on_hand = 0
          then p_unit_cost_minor
        else average_unit_cost_minor
      end,
      updated_by = auth.uid()
  where id = v_material.id;
  perform set_config('app.stock_movement', '', true);

  perform public.queue_low_stock_notification(v_material.id);

  return jsonb_build_object(
    'status', 'applied',
    'material_id', v_material.id,
    'movement_id', v_movement_id,
    'quantity_on_hand', v_new_qty
  );
end;
$$;
