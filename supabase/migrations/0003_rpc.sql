-- Transactional business operations. Sensitive workflows are exposed only as
-- SECURITY DEFINER RPCs that validate membership, capability and tenant scope.

create or replace function public.assignable_permissions()
returns text[]
language sql
immutable
as $$
  select array[
    'customers.view','customers.manage',
    'services.view','services.manage',
    'quotations.view','quotations.manage',
    'jobs.view','jobs.manage','jobs.update_status','jobs.consume_materials',
    'artwork.view','artwork.manage','artwork.approve',
    'invoices.view','invoices.manage','invoices.void',
    'payments.view','payments.manage','payments.reverse',
    'inventory.view','inventory.manage','inventory.adjust',
    'suppliers.view','suppliers.manage',
    'purchases.view','purchases.manage','purchases.receive',
    'expenses.view','expenses.manage',
    'reports.view','reports.financial','reports.export',
    'staff.view','staff.manage',
    'settings.view','settings.manage',
    'audit.view','notifications.view'
  ]::text[];
$$;

-- ---------------------------------------------------------------------------
-- Onboarding and memberships
-- ---------------------------------------------------------------------------

create or replace function public.create_company(
  p_name text,
  p_slug text,
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_slug text := lower(trim(p_slug));
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  if p_name is null or char_length(trim(p_name)) < 2 then
    raise exception 'COMPANY_NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then
    raise exception 'INVALID_SLUG' using errcode = 'P0001';
  end if;

  if p_full_name is not null and char_length(trim(p_full_name)) >= 2 then
    insert into public.profiles (id, full_name)
    values (v_uid, trim(p_full_name))
    on conflict (id) do update
      set full_name = case
        when length(trim(public.profiles.full_name)) < 2 then trim(excluded.full_name)
        else public.profiles.full_name
      end;
  end if;

  insert into public.companies (name, slug, created_by)
  values (trim(p_name), v_slug, v_uid)
  returning id into v_company_id;

  insert into public.company_memberships (company_id, user_id, role, status)
  values (v_company_id, v_uid, 'owner', 'active');

  return v_company_id;
exception
  when unique_violation then
    raise exception 'SLUG_TAKEN' using errcode = 'P0001';
end;
$$;

create or replace function public.create_invitation(
  p_company_id uuid,
  p_email text,
  p_role text,
  p_permissions text[],
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_email text := lower(trim(p_email));
  v_perms text[] := coalesce(p_permissions, '{}'::text[]);
begin
  if not public.has_company_permission(p_company_id, 'staff.manage') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_role not in ('admin', 'staff') then
    raise exception 'INVALID_ROLE' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL' using errcode = 'P0001';
  end if;
  if p_token_hash is null or char_length(p_token_hash) < 32 then
    raise exception 'INVALID_INVITATION_TOKEN' using errcode = 'P0001';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'INVALID_INVITATION_EXPIRY' using errcode = 'P0001';
  end if;
  if not (v_perms <@ public.assignable_permissions()) then
    raise exception 'INVALID_PERMISSION' using errcode = 'P0001';
  end if;

  insert into public.invitations (
    company_id, email, role, permissions, token_hash, expires_at, invited_by
  ) values (
    p_company_id, v_email, p_role, v_perms, p_token_hash, p_expires_at, auth.uid()
  ) returning id into v_id;

  insert into public.audit_logs (
    company_id, actor_user_id, action, entity_type, entity_id, after_data
  ) values (
    p_company_id, auth.uid(), 'invite', 'invitations', v_id,
    jsonb_build_object('email', v_email, 'role', p_role, 'permissions', v_perms)
  );

  return v_id;
exception
  when unique_violation then
    raise exception 'INVITATION_PENDING' using errcode = 'P0001';
end;
$$;

create or replace function public.accept_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_inv public.invitations;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_inv
  from public.invitations
  where token_hash = p_token_hash
  for update;

  if v_inv.id is null then
    raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_inv.revoked_at is not null or v_inv.accepted_at is not null then
    raise exception 'INVITATION_INACTIVE' using errcode = 'P0001';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'INVITATION_EXPIRED' using errcode = 'P0001';
  end if;
  if lower(v_email) <> v_inv.email then
    raise exception 'INVITATION_EMAIL_MISMATCH' using errcode = 'P0001';
  end if;

  insert into public.company_memberships (
    company_id, user_id, role, permissions, status, invited_by
  ) values (
    v_inv.company_id, v_uid, v_inv.role, v_inv.permissions, 'active', v_inv.invited_by
  );

  update public.invitations
  set accepted_at = now(), accepted_by = v_uid
  where id = v_inv.id;

  insert into public.audit_logs (
    company_id, actor_user_id, action, entity_type, entity_id, after_data
  ) values (
    v_inv.company_id, v_uid, 'accept_invitation', 'company_memberships', v_uid,
    jsonb_build_object('role', v_inv.role)
  );

  return v_inv.company_id;
exception
  when unique_violation then
    raise exception 'ALREADY_MEMBER' using errcode = 'P0001';
end;
$$;

create or replace function public.set_member_role(
  p_membership_id uuid,
  p_role text,
  p_permissions text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.company_memberships;
  v_actor public.company_memberships;
  v_perms text[] := coalesce(p_permissions, '{}'::text[]);
begin
  select * into v_target
  from public.company_memberships
  where id = p_membership_id
  for update;

  if v_target.id is null then
    raise exception 'MEMBERSHIP_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not public.has_company_permission(v_target.company_id, 'staff.manage') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_actor
  from public.company_memberships
  where company_id = v_target.company_id and user_id = auth.uid() and status = 'active';

  if v_actor.role = 'admin' and (v_target.role = 'admin' or p_role = 'admin') then
    raise exception 'ONLY_OWNER_CAN_MANAGE_ADMINS' using errcode = 'P0001';
  end if;
  if v_target.role = 'owner' or p_role = 'owner' then
    raise exception 'OWNER_TRANSFER_REQUIRED' using errcode = 'P0001';
  end if;
  if p_role not in ('admin', 'staff') then
    raise exception 'INVALID_ROLE' using errcode = 'P0001';
  end if;
  if not (v_perms <@ public.assignable_permissions()) then
    raise exception 'INVALID_PERMISSION' using errcode = 'P0001';
  end if;

  update public.company_memberships
  set role = p_role,
      permissions = case when p_role = 'admin' then '{}'::text[] else v_perms end
  where id = p_membership_id;
end;
$$;

create or replace function public.remove_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.company_memberships;
  v_actor public.company_memberships;
begin
  select * into v_target
  from public.company_memberships
  where id = p_membership_id
  for update;

  if v_target.id is null then
    raise exception 'MEMBERSHIP_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not public.has_company_permission(v_target.company_id, 'staff.manage') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_target.role = 'owner' then
    raise exception 'CANNOT_REMOVE_OWNER' using errcode = 'P0001';
  end if;
  if v_target.user_id = auth.uid() then
    raise exception 'CANNOT_REMOVE_SELF' using errcode = 'P0001';
  end if;

  select * into v_actor
  from public.company_memberships
  where company_id = v_target.company_id and user_id = auth.uid() and status = 'active';

  if v_actor.role = 'admin' and v_target.role = 'admin' then
    raise exception 'ONLY_OWNER_CAN_MANAGE_ADMINS' using errcode = 'P0001';
  end if;

  update public.company_memberships
  set status = 'revoked'
  where id = p_membership_id;
end;
$$;

create or replace function public.transfer_ownership(
  p_company_id uuid,
  p_new_owner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner public.company_memberships;
  v_target public.company_memberships;
begin
  if not public.has_company_role(p_company_id, array['owner']) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_owner
  from public.company_memberships
  where company_id = p_company_id and role = 'owner' and status = 'active'
  for update;

  select * into v_target
  from public.company_memberships
  where company_id = p_company_id and user_id = p_new_owner_user_id and status = 'active'
  for update;

  if v_target.id is null then
    raise exception 'TARGET_MEMBER_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.company_memberships set role = 'admin' where id = v_owner.id;
  update public.company_memberships set role = 'owner', permissions = '{}'::text[] where id = v_target.id;

  insert into public.audit_logs (
    company_id, actor_user_id, action, entity_type, entity_id, after_data
  ) values (
    p_company_id, auth.uid(), 'transfer_ownership', 'companies', p_company_id,
    jsonb_build_object('new_owner_user_id', p_new_owner_user_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Quotations -> jobs
-- ---------------------------------------------------------------------------

create or replace function public.convert_quotation_to_job(
  p_quotation_id uuid,
  p_title text default null,
  p_due_date date default null,
  p_priority text default 'normal'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotations;
  v_job_id uuid;
  v_title text;
  v_item record;
  v_tax bigint;
begin
  select * into v_quote
  from public.quotations
  where id = p_quotation_id
  for update;

  if v_quote.id is null then
    raise exception 'QUOTATION_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not public.has_company_permission(v_quote.company_id, 'jobs.manage') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_quote.status <> 'accepted' then
    raise exception 'QUOTATION_MUST_BE_ACCEPTED' using errcode = 'P0001';
  end if;
  if p_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'INVALID_PRIORITY' using errcode = 'P0001';
  end if;

  v_title := coalesce(nullif(trim(p_title), ''), 'Job from ' || v_quote.quotation_number);

  insert into public.job_orders (
    company_id, customer_id, quotation_id, job_number, title, priority, due_date, created_by
  ) values (
    v_quote.company_id, v_quote.customer_id, v_quote.id, '', v_title, p_priority, p_due_date, auth.uid()
  ) returning id into v_job_id;

  for v_item in
    select * from public.quotation_items
    where quotation_id = v_quote.id and company_id = v_quote.company_id
    order by position, created_at
  loop
    select tax_minor into v_tax
    from public.line_amounts(v_item.quantity, v_item.unit_price_minor, v_item.discount_minor, v_item.tax_rate);

    insert into public.job_items (
      company_id, job_order_id, service_id, description, quantity, unit,
      unit_price_minor, discount_minor, tax_minor, position
    ) values (
      v_quote.company_id, v_job_id, v_item.service_id, v_item.description, v_item.quantity, v_item.unit,
      v_item.unit_price_minor, v_item.discount_minor, v_tax, v_item.position
    );
  end loop;

  update public.quotations
  set status = 'converted'
  where id = v_quote.id;

  return v_job_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Job workflow
-- ---------------------------------------------------------------------------

create or replace function public.transition_job_status(
  p_job_id uuid,
  p_new_status text,
  p_note text default null,
  p_delivery_notes text default null
)
returns public.job_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.job_orders;
  v_previous_status text;
  v_latest_artwork public.artwork_files;
  v_customer public.customers;
begin
  select * into v_job
  from public.job_orders
  where id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'JOB_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not public.has_company_permission(v_job.company_id, 'jobs.update_status') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_new_status not in ('received', 'in_design', 'in_production', 'ready', 'delivered', 'cancelled') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if p_new_status = v_job.status then
    raise exception 'JOB_ALREADY_IN_STATUS' using errcode = 'P0001';
  end if;

  if not (
    (v_job.status = 'received' and p_new_status in ('in_design', 'in_production', 'cancelled'))
    or (v_job.status = 'in_design' and p_new_status in ('in_production', 'cancelled'))
    or (v_job.status = 'in_production' and p_new_status in ('ready', 'cancelled'))
    or (v_job.status = 'ready' and p_new_status in ('delivered', 'in_production', 'cancelled'))
    or (v_job.status = 'delivered' and p_new_status = 'in_production')
  ) then
    raise exception 'INVALID_JOB_STATUS_TRANSITION' using errcode = 'P0001';
  end if;

  if p_new_status in ('cancelled')
     or (p_new_status = 'in_production' and v_job.status in ('ready', 'delivered')) then
    if not public.has_company_permission(v_job.company_id, 'jobs.manage') then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
  end if;

  if p_new_status = 'in_production' and v_job.design_approval_required then
    select * into v_latest_artwork
    from public.artwork_files
    where job_order_id = v_job.id and company_id = v_job.company_id
    order by version_number desc
    limit 1;

    if v_latest_artwork.id is null or v_latest_artwork.approval_status <> 'approved' then
      raise exception 'ARTWORK_APPROVAL_REQUIRED' using errcode = 'P0001';
    end if;
  end if;

  v_previous_status := v_job.status;
  perform set_config('app.job_status_change', 'allowed', true);

  update public.job_orders
  set status = p_new_status,
      production_started_at = case
        when p_new_status = 'in_production' then coalesce(production_started_at, now())
        else production_started_at
      end,
      ready_at = case
        when p_new_status = 'ready' then now()
        when p_new_status = 'in_production' then null
        else ready_at
      end,
      delivered_at = case
        when p_new_status = 'delivered' then now()
        when p_new_status = 'in_production' then null
        else delivered_at
      end,
      cancelled_at = case when p_new_status = 'cancelled' then now() else cancelled_at end,
      cancellation_reason = case when p_new_status = 'cancelled' then p_note else cancellation_reason end,
      delivery_notes = case when p_new_status = 'delivered' then coalesce(p_delivery_notes, delivery_notes) else delivery_notes end,
      updated_by = auth.uid()
  where id = v_job.id
  returning * into v_job;

  perform set_config('app.job_status_change', '', true);

  insert into public.job_status_history (
    company_id, job_order_id, previous_status, new_status, changed_by, note
  ) values (
    v_job.company_id, v_job.id, v_previous_status, p_new_status, auth.uid(), p_note
  );

  if p_new_status = 'ready' then
    perform public.queue_notification(
      v_job.company_id, 'job.ready', 'in_app', null, v_job.customer_id, null,
      'job-ready:' || v_job.id::text,
      jsonb_build_object('job_id', v_job.id, 'job_number', v_job.job_number, 'title', v_job.title)
    );

    select * into v_customer from public.customers where id = v_job.customer_id;
    if v_customer.email is not null and btrim(v_customer.email) <> '' then
      perform public.queue_notification(
        v_job.company_id, 'job.ready', 'email', null, v_job.customer_id, v_customer.email,
        'job-ready-email:' || v_job.id::text,
        jsonb_build_object('job_id', v_job.id, 'job_number', v_job.job_number, 'title', v_job.title)
      );
    end if;
  end if;

  return v_job;
end;
$$;

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------

create or replace function public.consume_job_materials(
  p_job_id uuid,
  p_items jsonb,
  p_idempotency_key text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.job_orders;
  v_item jsonb;
  v_material public.materials;
  v_material_id uuid;
  v_qty numeric;
  v_cost_total bigint := 0;
  v_count integer := 0;
  v_exists boolean;
  v_new_qty numeric;
begin
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'CONSUMPTION_ITEMS_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_job
  from public.job_orders
  where id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'JOB_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not public.has_company_permission(v_job.company_id, 'jobs.consume_materials') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_job.status not in ('in_production', 'ready') then
    raise exception 'CONSUMPTION_REQUIRES_ACTIVE_PRODUCTION' using errcode = 'P0001';
  end if;

  select exists (
    select 1 from public.stock_movements
    where company_id = v_job.company_id
      and idempotency_key = p_idempotency_key || ':' || material_id::text
  ) into v_exists;

  if v_exists then
    return jsonb_build_object('status', 'duplicate', 'job_id', v_job.id);
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) x
    group by (x ->> 'material_id')
    having count(*) > 1
  ) then
    raise exception 'DUPLICATE_MATERIAL_IN_REQUEST' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    begin
      v_material_id := (v_item ->> 'material_id')::uuid;
      v_qty := (v_item ->> 'quantity')::numeric;
    exception when others then
      raise exception 'INVALID_CONSUMPTION_ITEM' using errcode = 'P0001';
    end;

    if v_qty is null or v_qty <= 0 then
      raise exception 'CONSUMPTION_QUANTITY_MUST_BE_POSITIVE' using errcode = 'P0001';
    end if;

    select * into v_material
    from public.materials
    where id = v_material_id and company_id = v_job.company_id
    for update;

    if v_material.id is null then
      raise exception 'MATERIAL_NOT_FOUND' using errcode = 'P0001';
    end if;
    if v_material.quantity_on_hand < v_qty then
      raise exception 'INSUFFICIENT_STOCK: %', v_material.name using errcode = 'P0001';
    end if;

    insert into public.stock_movements (
      company_id, material_id, movement_type, quantity_delta, unit_cost_minor,
      reference_type, reference_id, note, performed_by, idempotency_key
    ) values (
      v_job.company_id, v_material.id, 'consumption', -v_qty, v_material.average_unit_cost_minor,
      'job_order', v_job.id, p_note, auth.uid(), p_idempotency_key || ':' || v_material.id::text
    );

    perform set_config('app.stock_movement', 'allowed', true);
    update public.materials
    set quantity_on_hand = quantity_on_hand - v_qty,
        updated_by = auth.uid()
    where id = v_material.id
    returning quantity_on_hand into v_new_qty;
    perform set_config('app.stock_movement', '', true);

    perform public.queue_low_stock_notification(v_material.id);

    v_cost_total := v_cost_total + round(v_qty * v_material.average_unit_cost_minor)::bigint;
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'status', 'applied',
    'job_id', v_job.id,
    'item_count', v_count,
    'material_cost_minor', v_cost_total
  );
end;
$$;

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

  if exists (
    select 1 from public.stock_movements
    where company_id = v_material.company_id and idempotency_key = p_idempotency_key
  ) then
    return jsonb_build_object('status', 'duplicate', 'material_id', v_material.id);
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
  );

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

  return jsonb_build_object('status', 'applied', 'material_id', v_material.id, 'quantity_on_hand', v_new_qty);
end;
$$;

create or replace function public.receive_purchase_order(
  p_purchase_order_id uuid,
  p_items jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po public.purchase_orders;
  v_item jsonb;
  v_po_item public.purchase_order_items;
  v_material public.materials;
  v_item_id uuid;
  v_qty numeric;
  v_cost bigint;
  v_new_qty numeric;
  v_new_avg bigint;
  v_all_received boolean;
  v_count integer := 0;
begin
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'RECEIPT_ITEMS_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_po
  from public.purchase_orders
  where id = p_purchase_order_id
  for update;

  if v_po.id is null then
    raise exception 'PURCHASE_ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not public.has_company_permission(v_po.company_id, 'purchases.receive') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_po.status not in ('ordered', 'partially_received') then
    raise exception 'PURCHASE_ORDER_NOT_RECEIVABLE' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.stock_movements
    where company_id = v_po.company_id
      and idempotency_key = 'receipt:' || v_po.id::text || ':' || p_idempotency_key || ':' || material_id::text
  ) then
    return jsonb_build_object('status', 'duplicate', 'purchase_order_id', v_po.id);
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    begin
      v_item_id := (v_item ->> 'item_id')::uuid;
      v_qty := (v_item ->> 'quantity')::numeric;
    exception when others then
      raise exception 'INVALID_RECEIPT_ITEM' using errcode = 'P0001';
    end;

    if v_qty is null or v_qty <= 0 then
      raise exception 'RECEIPT_QUANTITY_MUST_BE_POSITIVE' using errcode = 'P0001';
    end if;

    select * into v_po_item
    from public.purchase_order_items
    where id = v_item_id and purchase_order_id = v_po.id and company_id = v_po.company_id
    for update;

    if v_po_item.id is null then
      raise exception 'PURCHASE_ORDER_ITEM_NOT_FOUND' using errcode = 'P0001';
    end if;
    if v_qty > (v_po_item.quantity_ordered - v_po_item.quantity_received) then
      raise exception 'RECEIPT_EXCEEDS_REMAINING_QUANTITY' using errcode = 'P0001';
    end if;

    v_cost := coalesce((v_item ->> 'unit_cost_minor')::bigint, v_po_item.unit_cost_minor);
    if v_cost is null or v_cost < 0 then
      raise exception 'INVALID_UNIT_COST' using errcode = 'P0001';
    end if;

    perform set_config('app.po_receive', 'allowed', true);
    update public.purchase_order_items
    set quantity_received = quantity_received + v_qty,
        unit_cost_minor = v_cost
    where id = v_po_item.id;
    perform set_config('app.po_receive', '', true);

    select * into v_material
    from public.materials
    where id = v_po_item.material_id and company_id = v_po.company_id
    for update;

    if v_material.id is null then
      raise exception 'MATERIAL_NOT_FOUND' using errcode = 'P0001';
    end if;

    v_new_qty := v_material.quantity_on_hand + v_qty;
    if v_new_qty > 0 then
      v_new_avg := round(
        (v_material.quantity_on_hand * v_material.average_unit_cost_minor + v_qty * v_cost) / v_new_qty
      )::bigint;
    else
      v_new_avg := v_material.average_unit_cost_minor;
    end if;

    insert into public.stock_movements (
      company_id, material_id, movement_type, quantity_delta, unit_cost_minor,
      reference_type, reference_id, note, performed_by, idempotency_key
    ) values (
      v_po.company_id, v_material.id, 'purchase_receipt', v_qty, v_cost,
      'purchase_order', v_po.id, 'Goods received', auth.uid(),
      'receipt:' || v_po.id::text || ':' || p_idempotency_key || ':' || v_material.id::text
    );

    perform set_config('app.stock_movement', 'allowed', true);
    update public.materials
    set quantity_on_hand = v_new_qty,
        average_unit_cost_minor = v_new_avg,
        updated_by = auth.uid()
    where id = v_material.id;
    perform set_config('app.stock_movement', '', true);

    v_count := v_count + 1;
  end loop;

  select bool_and(quantity_received >= quantity_ordered) into v_all_received
  from public.purchase_order_items
  where purchase_order_id = v_po.id;

  perform set_config('app.po_status_change', 'allowed', true);
  update public.purchase_orders
  set status = case when v_all_received then 'received' else 'partially_received' end,
      updated_by = auth.uid()
  where id = v_po.id;
  perform set_config('app.po_status_change', '', true);

  return jsonb_build_object(
    'status', 'applied',
    'purchase_order_id', v_po.id,
    'item_count', v_count,
    'purchase_order_status', case when v_all_received then 'received' else 'partially_received' end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

create or replace function public.record_payment(
  p_company_id uuid,
  p_customer_id uuid,
  p_amount_minor bigint,
  p_payment_method text,
  p_payment_date date,
  p_reference text,
  p_external_reference text,
  p_notes text,
  p_idempotency_key text,
  p_allocations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_payment public.payments;
  v_existing public.payments;
  v_allocation record;
  v_alloc_total bigint := 0;
  v_customer public.customers;
  v_invoice public.invoices;
  v_reference text;
  v_unallocated bigint;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  if not public.has_company_permission(p_company_id, 'payments.manage') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'PAYMENT_AMOUNT_MUST_BE_POSITIVE' using errcode = 'P0001';
  end if;
  if p_payment_method is null or char_length(trim(p_payment_method)) < 2 then
    raise exception 'PAYMENT_METHOD_REQUIRED' using errcode = 'P0001';
  end if;
  if p_idempotency_key is null or char_length(trim(p_idempotency_key)) < 8 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;
  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'INVALID_ALLOCATIONS' using errcode = 'P0001';
  end if;

  select * into v_existing
  from public.payments
  where company_id = p_company_id and idempotency_key = p_idempotency_key;

  if v_existing.id is not null then
    return jsonb_build_object(
      'status', 'duplicate',
      'payment_id', v_existing.id,
      'payment_reference', v_existing.payment_reference
    );
  end if;

  select * into v_customer
  from public.customers
  where id = p_customer_id and company_id = p_company_id;

  if v_customer.id is null then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0001';
  end if;

  for v_allocation in
    select
      (x ->> 'invoice_id')::uuid as invoice_id,
      sum((x ->> 'amount_minor')::bigint) as amount_minor
    from jsonb_array_elements(p_allocations) x
    group by (x ->> 'invoice_id')::uuid
  loop
    if v_allocation.invoice_id is null or v_allocation.amount_minor is null or v_allocation.amount_minor <= 0 then
      raise exception 'INVALID_ALLOCATION' using errcode = 'P0001';
    end if;
    v_alloc_total := v_alloc_total + v_allocation.amount_minor;
  end loop;

  if v_alloc_total > p_amount_minor then
    raise exception 'ALLOCATIONS_EXCEED_PAYMENT_AMOUNT' using errcode = 'P0001';
  end if;

  v_reference := public.next_document_number(p_company_id, 'payment');

  insert into public.payments (
    company_id, customer_id, payment_reference, amount_minor, payment_method,
    payment_date, external_reference, notes, recorded_by, status, idempotency_key
  ) values (
    p_company_id, p_customer_id, v_reference, p_amount_minor, trim(p_payment_method),
    coalesce(p_payment_date, current_date), p_external_reference, p_notes, v_uid, 'recorded', p_idempotency_key
  ) returning * into v_payment;

  for v_allocation in
    select
      (x ->> 'invoice_id')::uuid as invoice_id,
      sum((x ->> 'amount_minor')::bigint) as amount_minor
    from jsonb_array_elements(p_allocations) x
    group by (x ->> 'invoice_id')::uuid
  loop
    select * into v_invoice
    from public.invoices
    where id = v_allocation.invoice_id and company_id = p_company_id
    for update;

    if v_invoice.id is null then
      raise exception 'INVOICE_NOT_FOUND' using errcode = 'P0001';
    end if;
    if v_invoice.customer_id <> p_customer_id then
      raise exception 'INVOICE_CUSTOMER_MISMATCH' using errcode = 'P0001';
    end if;
    if v_invoice.status in ('draft', 'void') then
      raise exception 'INVOICE_NOT_PAYABLE' using errcode = 'P0001';
    end if;
    if v_allocation.amount_minor > (v_invoice.total_minor - public.active_invoice_paid(v_invoice.id)) then
      raise exception 'ALLOCATION_EXCEEDS_OUTSTANDING_BALANCE' using errcode = 'P0001';
    end if;

    insert into public.payment_allocations (
      company_id, payment_id, invoice_id, amount_minor, status
    ) values (
      p_company_id, v_payment.id, v_invoice.id, v_allocation.amount_minor, 'recorded'
    );
  end loop;

  v_unallocated := p_amount_minor - v_alloc_total;

  perform public.queue_notification(
    p_company_id, 'payment.recorded', 'in_app', null, p_customer_id, null,
    'payment-in-app:' || v_payment.id::text,
    jsonb_build_object(
      'payment_id', v_payment.id,
      'payment_reference', v_payment.payment_reference,
      'amount_minor', v_payment.amount_minor,
      'customer_name', v_customer.name
    )
  );

  if v_customer.email is not null and btrim(v_customer.email) <> '' then
    perform public.queue_notification(
      p_company_id, 'payment.recorded', 'email', null, p_customer_id, v_customer.email,
      'payment-email:' || v_payment.id::text,
      jsonb_build_object(
        'payment_reference', v_payment.payment_reference,
        'amount_minor', v_payment.amount_minor,
        'customer_name', v_customer.name
      )
    );
  end if;

  return jsonb_build_object(
    'status', 'applied',
    'payment_id', v_payment.id,
    'payment_reference', v_payment.payment_reference,
    'amount_minor', v_payment.amount_minor,
    'allocated_minor', v_alloc_total,
    'unallocated_minor', v_unallocated
  );
end;
$$;

create or replace function public.reverse_payment(p_payment_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
begin
  if p_reason is null or char_length(trim(p_reason)) < 5 then
    raise exception 'REVERSAL_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if v_payment.id is null then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not public.has_company_permission(v_payment.company_id, 'payments.reverse') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_payment.status = 'reversed' then
    raise exception 'PAYMENT_ALREADY_REVERSED' using errcode = 'P0001';
  end if;

  update public.payments
  set status = 'reversed',
      reversed_at = now(),
      reversed_by = auth.uid(),
      reversal_reason = trim(p_reason)
  where id = v_payment.id;

  update public.payment_allocations
  set status = 'reversed',
      reversed_at = now(),
      reversed_by = auth.uid()
  where payment_id = v_payment.id and status = 'recorded';

  perform public.queue_notification(
    v_payment.company_id, 'payment.reversed', 'in_app', null, v_payment.customer_id, null,
    'payment-reversed:' || v_payment.id::text,
    jsonb_build_object('payment_id', v_payment.id, 'payment_reference', v_payment.payment_reference)
  );

  return jsonb_build_object('status', 'reversed', 'payment_id', v_payment.id);
end;
$$;

create or replace function public.void_invoice(p_invoice_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices;
begin
  if p_reason is null or char_length(trim(p_reason)) < 5 then
    raise exception 'VOID_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if v_invoice.id is null then
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not public.has_company_permission(v_invoice.company_id, 'invoices.void') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_invoice.status = 'void' then
    raise exception 'INVOICE_ALREADY_VOID' using errcode = 'P0001';
  end if;
  if public.active_invoice_paid(v_invoice.id) <> 0 then
    raise exception 'INVOICE_WITH_PAYMENTS_CANNOT_BE_VOIDED' using errcode = 'P0001';
  end if;

  update public.invoices
  set status = 'void', void_reason = trim(p_reason)
  where id = v_invoice.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Artwork review
-- ---------------------------------------------------------------------------

create or replace function public.review_artwork(
  p_artwork_id uuid,
  p_status text,
  p_note text default null
)
returns public.artwork_files
language plpgsql
security definer
set search_path = public
as $$
declare
  v_file public.artwork_files;
begin
  select * into v_file
  from public.artwork_files
  where id = p_artwork_id
  for update;

  if v_file.id is null then
    raise exception 'ARTWORK_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not public.has_company_permission(v_file.company_id, 'artwork.approve') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_status not in ('awaiting_approval', 'approved', 'revision_required') then
    raise exception 'INVALID_ARTWORK_STATUS' using errcode = 'P0001';
  end if;

  update public.artwork_files
  set approval_status = p_status,
      approved_by = case when p_status = 'approved' then auth.uid() else null end,
      approved_at = case when p_status = 'approved' then now() else null end,
      approval_note = p_note
  where id = v_file.id
  returning * into v_file;

  perform public.queue_notification(
    v_file.company_id,
    case when p_status = 'awaiting_approval' then 'artwork.awaiting_approval' else 'artwork.reviewed' end,
    'in_app',
    null,
    null,
    null,
    'artwork-review:' || v_file.id::text || ':' || p_status || ':' || extract(epoch from now())::text,
    jsonb_build_object(
      'artwork_id', v_file.id,
      'job_order_id', v_file.job_order_id,
      'status', p_status,
      'filename', v_file.original_filename
    )
  );

  return v_file;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduled maintenance (call from a trusted cron worker only)
-- ---------------------------------------------------------------------------

create or replace function public.expire_quotations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.quotations
  set status = 'expired'
  where status in ('draft', 'sent')
    and valid_until is not null
    and valid_until < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.enqueue_overdue_invoice_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_customer public.customers;
  v_count integer := 0;
begin
  for r in
    select i.*
    from public.invoices i
    where i.status in ('issued', 'partially_paid', 'overdue')
      and i.due_date is not null
      and i.due_date < current_date
      and i.total_minor > public.active_invoice_paid(i.id)
  loop
    perform public.refresh_invoice(r.id);

    select * into v_customer from public.customers where id = r.customer_id;

    perform public.queue_notification(
      r.company_id, 'invoice.overdue', 'in_app', null, r.customer_id, null,
      'invoice-overdue:' || r.id::text || ':' || r.due_date::text,
      jsonb_build_object('invoice_id', r.id, 'invoice_number', r.invoice_number, 'customer_name', v_customer.name)
    );

    if v_customer.email is not null and btrim(v_customer.email) <> '' then
      perform public.queue_notification(
        r.company_id, 'invoice.overdue', 'email', null, r.customer_id, v_customer.email,
        'invoice-overdue-email:' || r.id::text || ':' || r.due_date::text,
        jsonb_build_object('invoice_id', r.id, 'invoice_number', r.invoice_number, 'customer_name', v_customer.name)
      );
    end if;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.enqueue_due_job_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select j.*
    from public.job_orders j
    where j.status not in ('delivered', 'cancelled')
      and j.due_date is not null
      and j.due_date between current_date and current_date + 1
  loop
    perform public.queue_notification(
      r.company_id, 'job.due_soon', 'in_app', null, r.customer_id, null,
      'job-due:' || r.id::text || ':' || r.due_date::text,
      jsonb_build_object('job_id', r.id, 'job_number', r.job_number, 'title', r.title, 'due_date', r.due_date)
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
