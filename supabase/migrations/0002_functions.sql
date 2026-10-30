-- PrintFlow domain functions, integrity triggers and audit helpers.

-- ---------------------------------------------------------------------------
-- Context and permissions
-- ---------------------------------------------------------------------------

create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    ''
  ) = 'service_role';
$$;

create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships m
    where m.company_id = p_company_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.has_company_role(p_company_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships m
    where m.company_id = p_company_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any (p_roles)
  );
$$;

-- Explicit capability evaluation. Owners have every capability, admins have
-- every capability except company ownership/deletion, staff require an
-- explicitly granted capability.
create or replace function public.shares_company_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships me
    join public.company_memberships them on them.company_id = me.company_id
    where me.user_id = auth.uid()
      and me.status = 'active'
      and them.user_id = p_user_id
      and them.status = 'active'
  );
$$;

create or replace function public.has_company_permission(p_company_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_memberships m
    where m.company_id = p_company_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (
        m.role = 'owner'
        or (m.role = 'admin' and p_permission not in ('company.transfer_ownership', 'company.delete'))
        or (m.role = 'staff' and p_permission = any (m.permissions))
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Timestamps and actor stamping
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.stamp_actor_insert()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.stamp_actor_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Human-readable sequential document numbers
-- ---------------------------------------------------------------------------

create or replace function public.next_document_number(p_company_id uuid, p_doc_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_year integer := extract(year from (now() at time zone 'utc'))::integer;
  v_key text;
  v_seq integer;
begin
  if not (public.is_company_member(p_company_id) or public.is_service_role()) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  v_prefix := case p_doc_type
    when 'quotation' then 'QUO'
    when 'invoice' then 'INV'
    when 'job' then 'JOB'
    when 'payment' then 'PAY'
    when 'expense' then 'EXP'
    when 'purchase_order' then 'PO'
    when 'customer' then 'CUS'
    when 'material' then 'MAT'
    when 'supplier' then 'SUP'
    else null
  end;

  if v_prefix is null then
    raise exception 'INVALID_DOCUMENT_TYPE' using errcode = 'P0001';
  end if;

  v_key := p_doc_type || ':' || v_year::text;

  insert into public.document_counters (company_id, doc_type, next_value)
  values (p_company_id, v_key, 2)
  on conflict (company_id, doc_type)
  do update set next_value = public.document_counters.next_value + 1,
                updated_at = now()
  returning next_value - 1 into v_seq;

  return v_prefix || '-' || v_year::text || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

create or replace function public.before_insert_numbered_customer()
returns trigger language plpgsql as $$
begin
  if new.customer_code is null or btrim(new.customer_code) = '' then
    new.customer_code := public.next_document_number(new.company_id, 'customer');
  end if;
  return new;
end;
$$;

create or replace function public.before_insert_numbered_material()
returns trigger language plpgsql as $$
begin
  if new.material_code is null or btrim(new.material_code) = '' then
    new.material_code := public.next_document_number(new.company_id, 'material');
  end if;
  return new;
end;
$$;

create or replace function public.before_insert_numbered_supplier()
returns trigger language plpgsql as $$
begin
  if new.supplier_code is null or btrim(new.supplier_code) = '' then
    new.supplier_code := public.next_document_number(new.company_id, 'supplier');
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Amount calculations
-- ---------------------------------------------------------------------------

create or replace function public.line_amounts(
  p_quantity numeric,
  p_unit_price_minor bigint,
  p_discount_minor bigint,
  p_tax_rate numeric
)
returns table (base_minor bigint, tax_minor bigint, total_minor bigint)
language plpgsql
immutable
as $$
declare
  v_base bigint;
  v_taxable bigint;
  v_tax bigint;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'QUANTITY_MUST_BE_POSITIVE' using errcode = 'P0001';
  end if;
  if p_unit_price_minor is null or p_unit_price_minor < 0 then
    raise exception 'PRICE_CANNOT_BE_NEGATIVE' using errcode = 'P0001';
  end if;
  if p_discount_minor is null or p_discount_minor < 0 then
    raise exception 'DISCOUNT_CANNOT_BE_NEGATIVE' using errcode = 'P0001';
  end if;
  if p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
    raise exception 'INVALID_TAX_RATE' using errcode = 'P0001';
  end if;

  v_base := round(p_quantity * p_unit_price_minor)::bigint;

  if p_discount_minor > v_base then
    raise exception 'DISCOUNT_EXCEEDS_LINE_AMOUNT' using errcode = 'P0001';
  end if;

  v_taxable := v_base - p_discount_minor;
  v_tax := round(v_taxable * p_tax_rate / 100.0)::bigint;

  base_minor := v_base;
  tax_minor := v_tax;
  total_minor := v_taxable + v_tax;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------------

create or replace function public.before_insert_quotation()
returns trigger
language plpgsql
as $$
begin
  new.quotation_number := public.next_document_number(new.company_id, 'quotation');
  if auth.uid() is not null then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  end if;
  if not public.is_service_role() then
    new.status := 'draft';
  end if;
  new.subtotal_minor := 0;
  new.item_discount_minor := 0;
  new.discount_minor := new.order_discount_minor;
  new.tax_minor := 0;
  new.total_minor := 0;
  return new;
end;
$$;

create or replace function public.before_update_quotation()
returns trigger
language plpgsql
as $$
declare
  v_subtotal bigint;
  v_item_discount bigint;
  v_tax bigint;
  v_discount bigint;
  v_total bigint;
begin
  if new.company_id <> old.company_id then
    raise exception 'COMPANY_CANNOT_BE_CHANGED' using errcode = 'P0001';
  end if;

  if new.status <> old.status then
    if not (
      (old.status = 'draft' and new.status in ('sent', 'accepted', 'rejected', 'expired'))
      or (old.status = 'sent' and new.status in ('accepted', 'rejected', 'expired'))
      or (old.status = 'accepted' and new.status = 'converted')
    ) then
      raise exception 'INVALID_QUOTATION_STATUS_TRANSITION' using errcode = 'P0001';
    end if;
    if new.status = 'converted' and not exists (
      select 1 from public.job_orders j
      where j.quotation_id = new.id and j.company_id = new.company_id
    ) then
      raise exception 'QUOTATION_NOT_CONVERTED_TO_JOB' using errcode = 'P0001';
    end if;
  end if;

  if old.status <> 'draft' and new.customer_id <> old.customer_id then
    raise exception 'CUSTOMER_CANNOT_BE_CHANGED_AFTER_DRAFT' using errcode = 'P0001';
  end if;

  select
    coalesce(sum(round(quantity * unit_price_minor)::bigint), 0),
    coalesce(sum(discount_minor), 0),
    coalesce(sum(tax_minor), 0)
  into v_subtotal, v_item_discount, v_tax
  from public.quotation_items
  where quotation_id = new.id and company_id = new.company_id;

  v_discount := v_item_discount + new.order_discount_minor;
  v_total := v_subtotal - v_discount + v_tax;

  if v_total < 0 then
    raise exception 'DOCUMENT_TOTAL_CANNOT_BE_NEGATIVE' using errcode = 'P0001';
  end if;

  new.subtotal_minor := v_subtotal;
  new.item_discount_minor := v_item_discount;
  new.discount_minor := v_discount;
  new.tax_minor := v_tax;
  new.total_minor := v_total;
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.recalculate_quotation_totals(p_quotation_id uuid)
returns void
language plpgsql
as $$
begin
  update public.quotations
  set updated_at = now()
  where id = p_quotation_id;
end;
$$;

create or replace function public.protect_quotation_item()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_parent uuid;
  v_base bigint;
  v_tax bigint;
  v_total bigint;
begin
  v_parent := case when tg_op = 'DELETE' then old.quotation_id else new.quotation_id end;

  select status into v_status
  from public.quotations
  where id = v_parent;

  if v_status is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    raise exception 'QUOTATION_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_status <> 'draft' and not public.is_service_role() then
    raise exception 'QUOTATION_ITEMS_LOCKED' using errcode = 'P0001';
  end if;

  if tg_op <> 'DELETE' then
    select base_minor, tax_minor, total_minor
    into v_base, v_tax, v_total
    from public.line_amounts(new.quantity, new.unit_price_minor, new.discount_minor, new.tax_rate);

    new.tax_minor := v_tax;
    new.line_total_minor := v_total;
    if new.company_id <> (select company_id from public.quotations where id = new.quotation_id) then
      raise exception 'TENANT_MISMATCH' using errcode = 'P0001';
    end if;
    return new;
  end if;
  return old;
end;
$$;

create or replace function public.after_quotation_item_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_quotation_totals(old.quotation_id);
  else
    perform public.recalculate_quotation_totals(new.quotation_id);
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Job orders
-- ---------------------------------------------------------------------------

create or replace function public.before_insert_job()
returns trigger
language plpgsql
as $$
begin
  new.job_number := public.next_document_number(new.company_id, 'job');
  if auth.uid() is not null then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  end if;
  if not public.is_service_role() then
    new.status := 'received';
    new.production_started_at := null;
    new.ready_at := null;
    new.delivered_at := null;
    new.cancelled_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.before_update_job()
returns trigger
language plpgsql
as $$
begin
  if new.company_id <> old.company_id then
    raise exception 'COMPANY_CANNOT_BE_CHANGED' using errcode = 'P0001';
  end if;
  if new.status <> old.status
     and coalesce(current_setting('app.job_status_change', true), '') <> 'allowed' then
    raise exception 'JOB_STATUS_REQUIRES_TRANSITION_RPC' using errcode = 'P0001';
  end if;
  if old.status <> 'received' and new.design_approval_required <> old.design_approval_required then
    raise exception 'APPROVAL_REQUIREMENT_LOCKED' using errcode = 'P0001';
  end if;
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.after_insert_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.job_status_history (
    company_id, job_order_id, previous_status, new_status, changed_by, note
  ) values (
    new.company_id, new.id, null, new.status, auth.uid(), 'Job created'
  );
  return new;
end;
$$;

create or replace function public.protect_job_item()
returns trigger
language plpgsql
as $$
declare
  v_base bigint;
  v_total bigint;
begin
  if tg_op <> 'DELETE' then
    v_base := round(new.quantity * new.unit_price_minor)::bigint;
    if new.discount_minor > v_base then
      raise exception 'DISCOUNT_EXCEEDS_LINE_AMOUNT' using errcode = 'P0001';
    end if;
    v_total := v_base - new.discount_minor + new.tax_minor;
    if v_total < 0 then
      raise exception 'LINE_TOTAL_CANNOT_BE_NEGATIVE' using errcode = 'P0001';
    end if;
    new.line_total_minor := v_total;
    return new;
  end if;
  return old;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invoices and payment allocations
-- ---------------------------------------------------------------------------

create or replace function public.before_insert_invoice()
returns trigger
language plpgsql
as $$
begin
  new.invoice_number := public.next_document_number(new.company_id, 'invoice');
  if auth.uid() is not null then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  end if;
  if not public.is_service_role() then
    new.status := 'draft';
  end if;
  new.subtotal_minor := 0;
  new.item_discount_minor := 0;
  new.discount_minor := new.order_discount_minor;
  new.tax_minor := 0;
  new.total_minor := 0;
  new.amount_paid_minor := 0;
  new.voided_at := null;
  new.voided_by := null;
  return new;
end;
$$;

create or replace function public.active_invoice_paid(p_invoice_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(a.amount_minor), 0)::bigint
  from public.payment_allocations a
  join public.payments p on p.id = a.payment_id and p.company_id = a.company_id
  where a.invoice_id = p_invoice_id
    and a.status = 'recorded'
    and p.status = 'recorded';
$$;

create or replace function public.before_update_invoice()
returns trigger
language plpgsql
as $$
declare
  v_subtotal bigint;
  v_item_discount bigint;
  v_tax bigint;
  v_discount bigint;
  v_total bigint;
  v_paid bigint;
  v_derived text;
begin
  if new.company_id <> old.company_id then
    raise exception 'COMPANY_CANNOT_BE_CHANGED' using errcode = 'P0001';
  end if;

  select
    coalesce(sum(round(quantity * unit_price_minor)::bigint), 0),
    coalesce(sum(discount_minor), 0),
    coalesce(sum(tax_minor), 0)
  into v_subtotal, v_item_discount, v_tax
  from public.invoice_items
  where invoice_id = new.id and company_id = new.company_id;

  v_discount := v_item_discount + new.order_discount_minor;
  v_total := v_subtotal - v_discount + v_tax;

  if v_total < 0 then
    raise exception 'DOCUMENT_TOTAL_CANNOT_BE_NEGATIVE' using errcode = 'P0001';
  end if;

  v_paid := public.active_invoice_paid(new.id);

  if v_paid > 0 and v_total < v_paid then
    raise exception 'INVOICE_HAS_PAYMENTS' using errcode = 'P0001';
  end if;

  if old.status = 'void' then
    new.status := 'void';
    new.amount_paid_minor := 0;
    new.subtotal_minor := v_subtotal;
    new.item_discount_minor := v_item_discount;
    new.discount_minor := v_discount;
    new.tax_minor := v_tax;
    new.total_minor := v_total;
    return new;
  end if;

  if new.status = 'void' and old.status <> 'void' then
    if not public.has_company_permission(new.company_id, 'invoices.void') then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
    if v_paid <> 0 then
      raise exception 'INVOICE_WITH_PAYMENTS_CANNOT_BE_VOIDED' using errcode = 'P0001';
    end if;
    new.voided_at := now();
    new.voided_by := auth.uid();
    new.amount_paid_minor := 0;
    new.subtotal_minor := v_subtotal;
    new.item_discount_minor := v_item_discount;
    new.discount_minor := v_discount;
    new.tax_minor := v_tax;
    new.total_minor := v_total;
    return new;
  end if;

  new.amount_paid_minor := v_paid;

  if old.status = 'draft' and new.status = 'draft' then
    v_derived := 'draft';
  else
    if v_paid > 0 and v_paid >= v_total and v_total > 0 then
      v_derived := 'paid';
    elsif v_paid > 0 then
      v_derived := 'partially_paid';
    elsif new.due_date is not null and new.due_date < current_date then
      v_derived := 'overdue';
    else
      v_derived := 'issued';
    end if;
  end if;

  new.status := v_derived;
  new.subtotal_minor := v_subtotal;
  new.item_discount_minor := v_item_discount;
  new.discount_minor := v_discount;
  new.tax_minor := v_tax;
  new.total_minor := v_total;
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.refresh_invoice(p_invoice_id uuid)
returns void
language plpgsql
as $$
begin
  update public.invoices set updated_at = now() where id = p_invoice_id;
end;
$$;

create or replace function public.protect_invoice_item()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_parent uuid;
  v_base bigint;
  v_tax bigint;
  v_total bigint;
begin
  v_parent := case when tg_op = 'DELETE' then old.invoice_id else new.invoice_id end;

  select status into v_status
  from public.invoices
  where id = v_parent;

  if v_status is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_status <> 'draft' and not public.is_service_role() then
    raise exception 'INVOICE_ITEMS_LOCKED' using errcode = 'P0001';
  end if;

  if tg_op <> 'DELETE' then
    select base_minor, tax_minor, total_minor
    into v_base, v_tax, v_total
    from public.line_amounts(new.quantity, new.unit_price_minor, new.discount_minor, new.tax_rate);

    new.tax_minor := v_tax;
    new.line_total_minor := v_total;
    return new;
  end if;
  return old;
end;
$$;

create or replace function public.after_invoice_item_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_invoice(old.invoice_id);
  else
    perform public.refresh_invoice(new.invoice_id);
  end if;
  return null;
end;
$$;

create or replace function public.validate_allocation()
returns trigger
language plpgsql
as $$
declare
  v_invoice public.invoices;
  v_paid bigint;
  v_existing bigint := 0;
begin
  if tg_op = 'UPDATE' then
    v_existing := old.amount_minor;
  end if;

  select * into v_invoice
  from public.invoices
  where id = new.invoice_id
  for update;

  if v_invoice.id is null then
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_invoice.company_id <> new.company_id then
    raise exception 'TENANT_MISMATCH' using errcode = 'P0001';
  end if;
  if new.status = 'recorded' and v_invoice.status in ('draft', 'void') then
    raise exception 'INVOICE_NOT_PAYABLE' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.payments p
    where p.id = new.payment_id
      and p.company_id = new.company_id
      and p.customer_id = v_invoice.customer_id
      and (p.status = 'recorded' or new.status = 'reversed')
  ) then
    raise exception 'PAYMENT_CUSTOMER_MISMATCH' using errcode = 'P0001';
  end if;

  v_paid := public.active_invoice_paid(new.invoice_id) - case when new.status = 'recorded' then v_existing else 0 end;

  if new.status = 'recorded' and v_paid + new.amount_minor > v_invoice.total_minor then
    raise exception 'ALLOCATION_EXCEEDS_OUTSTANDING_BALANCE' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.after_allocation_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_invoice(old.invoice_id);
  else
    perform public.refresh_invoice(new.invoice_id);
  end if;
  return null;
end;
$$;

create or replace function public.after_payment_status_change()
returns trigger
language plpgsql
as $$
declare
  r record;
begin
  if new.status <> old.status then
    for r in select distinct invoice_id from public.payment_allocations where payment_id = new.id loop
      perform public.refresh_invoice(r.invoice_id);
    end loop;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Materials, purchasing and stock guards
-- ---------------------------------------------------------------------------

create or replace function public.before_insert_material()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  end if;
  if not public.is_service_role() then
    new.quantity_on_hand := 0;
    new.average_unit_cost_minor := 0;
  end if;
  return new;
end;
$$;

create or replace function public.before_update_material()
returns trigger
language plpgsql
as $$
begin
  if new.company_id <> old.company_id then
    raise exception 'COMPANY_CANNOT_BE_CHANGED' using errcode = 'P0001';
  end if;
  if (new.quantity_on_hand <> old.quantity_on_hand
      or new.average_unit_cost_minor <> old.average_unit_cost_minor)
     and coalesce(current_setting('app.stock_movement', true), '') <> 'allowed'
     and not public.is_service_role() then
    raise exception 'STOCK_MUST_BE_CHANGED_THROUGH_MOVEMENT' using errcode = 'P0001';
  end if;
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.before_insert_purchase_order()
returns trigger
language plpgsql
as $$
begin
  new.purchase_order_number := public.next_document_number(new.company_id, 'purchase_order');
  if auth.uid() is not null then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
  end if;
  if not public.is_service_role() then
    new.status := 'draft';
  end if;
  new.subtotal_minor := 0;
  new.total_minor := 0;
  return new;
end;
$$;

create or replace function public.before_update_purchase_order()
returns trigger
language plpgsql
as $$
declare
  v_subtotal bigint;
  v_total bigint;
begin
  if new.company_id <> old.company_id then
    raise exception 'COMPANY_CANNOT_BE_CHANGED' using errcode = 'P0001';
  end if;

  if new.status <> old.status then
    if coalesce(current_setting('app.po_status_change', true), '') <> 'allowed'
       and not public.is_service_role() then
      if not (
        (old.status = 'draft' and new.status in ('ordered', 'cancelled'))
        or (old.status = 'ordered' and new.status = 'cancelled')
        or (old.status = 'partially_received' and new.status = 'cancelled')
      ) then
        raise exception 'PURCHASE_ORDER_STATUS_REQUIRES_RECEIVING_RPC' using errcode = 'P0001';
      end if;
    end if;
  end if;

  select coalesce(sum(round(quantity_ordered * unit_cost_minor)::bigint), 0),
         coalesce(sum(round(quantity_ordered * unit_cost_minor)::bigint), 0)
  into v_subtotal, v_total
  from public.purchase_order_items
  where purchase_order_id = new.id and company_id = new.company_id;

  new.subtotal_minor := v_subtotal;
  new.total_minor := v_total;
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.protect_purchase_order_item()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_parent uuid;
begin
  v_parent := case when tg_op = 'DELETE' then old.purchase_order_id else new.purchase_order_id end;

  select status into v_status
  from public.purchase_orders
  where id = v_parent;

  if v_status is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    raise exception 'PURCHASE_ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_status <> 'draft'
     and coalesce(current_setting('app.po_receive', true), '') <> 'allowed'
     and not public.is_service_role() then
    raise exception 'PURCHASE_ORDER_ITEMS_LOCKED' using errcode = 'P0001';
  end if;

  if tg_op <> 'DELETE' then
    new.line_total_minor := round(new.quantity_ordered * new.unit_cost_minor)::bigint;
    if new.quantity_received > new.quantity_ordered then
      raise exception 'RECEIVED_EXCEEDS_ORDERED' using errcode = 'P0001';
    end if;
    return new;
  end if;
  return old;
end;
$$;

create or replace function public.after_purchase_order_item_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    update public.purchase_orders set updated_at = now() where id = old.purchase_order_id;
  else
    update public.purchase_orders set updated_at = now() where id = new.purchase_order_id;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Expenses and artwork
-- ---------------------------------------------------------------------------

create or replace function public.before_insert_expense()
returns trigger
language plpgsql
as $$
begin
  new.expense_number := public.next_document_number(new.company_id, 'expense');
  if auth.uid() is not null then
    new.recorded_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.before_insert_artwork()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.uploaded_by := auth.uid();
  end if;
  if new.storage_path not like new.company_id::text || '/%' then
    raise exception 'INVALID_STORAGE_PATH' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.job_orders
    where id = new.job_order_id and company_id = new.company_id
  ) then
    raise exception 'JOB_NOT_FOUND' using errcode = 'P0001';
  end if;
  new.approval_status := 'pending';
  new.approved_by := null;
  new.approved_at := null;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create or replace function public.queue_notification(
  p_company_id uuid,
  p_event_type text,
  p_channel text,
  p_recipient_user_id uuid,
  p_customer_id uuid,
  p_destination text,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status text;
begin
  v_status := case when p_channel = 'in_app' then 'sent' else 'pending' end;

  insert into public.notifications (
    company_id, recipient_user_id, customer_id, event_type, channel, destination,
    status, payload, dedupe_key, sent_at
  ) values (
    p_company_id, p_recipient_user_id, p_customer_id, p_event_type, p_channel, p_destination,
    v_status, coalesce(p_payload, '{}'::jsonb), p_dedupe_key,
    case when p_channel = 'in_app' then now() else null end
  )
  on conflict (company_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.notifications
    where company_id = p_company_id and dedupe_key = p_dedupe_key
    limit 1;
    return v_id;
  end if;

  if p_channel in ('email', 'whatsapp') then
    insert into public.notification_outbox (company_id, notification_id, channel)
    values (p_company_id, v_id, p_channel)
    on conflict (notification_id, channel) do nothing;
  end if;

  return v_id;
end;
$$;

create or replace function public.queue_low_stock_notification(p_material_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_material public.materials;
begin
  select * into v_material from public.materials where id = p_material_id;
  if v_material.id is null or not v_material.active or v_material.reorder_level <= 0 then
    return;
  end if;
  if v_material.quantity_on_hand > v_material.reorder_level then
    return;
  end if;
  perform public.queue_notification(
    v_material.company_id,
    'inventory.low_stock',
    'in_app',
    null,
    null,
    null,
    'low-stock:' || v_material.id::text || ':' || current_date::text,
    jsonb_build_object(
      'material_id', v_material.id,
      'material_name', v_material.name,
      'quantity_on_hand', v_material.quantity_on_hand,
      'reorder_level', v_material.reorder_level
    )
  );
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n public.notifications;
begin
  select * into v_n from public.notifications where id = p_notification_id;
  if v_n.id is null then
    raise exception 'NOTIFICATION_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not public.is_company_member(v_n.company_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_n.recipient_user_id is not null and v_n.recipient_user_id <> auth.uid() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  update public.notifications set read_at = now() where id = p_notification_id;
end;
$$;

create or replace function public.mark_all_notifications_read(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_company_member(p_company_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  update public.notifications
  set read_at = now()
  where company_id = p_company_id
    and channel = 'in_app'
    and read_at is null
    and (recipient_user_id is null or recipient_user_id = auth.uid());
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_entity_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if tg_table_name = 'companies' then
    v_company_id := case when tg_op = 'DELETE' then old.id else new.id end;
  elsif tg_op = 'DELETE' then
    v_company_id := old.company_id;
  else
    v_company_id := new.company_id;
  end if;

  if tg_op = 'DELETE' then
    v_entity_id := old.id;
    v_before := to_jsonb(old);
  elsif tg_op = 'UPDATE' then
    v_entity_id := new.id;
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  else
    v_entity_id := new.id;
    v_after := to_jsonb(new);
  end if;

  insert into public.audit_logs (
    company_id, actor_user_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    v_company_id, auth.uid(), lower(tg_op), tg_table_name, v_entity_id, v_before, v_after
  );

  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting (best-effort helper; deployment should also use an edge WAF)
-- ---------------------------------------------------------------------------

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_limit <= 0 or p_window_seconds <= 0 then
    return false;
  end if;

  insert into public.api_rate_limits (rate_key, window_started_at, request_count)
  values (p_key, now(), 1)
  on conflict (rate_key) do update
  set request_count = case
        when public.api_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds)
          then 1
        else public.api_rate_limits.request_count + 1
      end,
      window_started_at = case
        when public.api_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds)
          then now()
        else public.api_rate_limits.window_started_at
      end
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Attach triggers
-- ---------------------------------------------------------------------------

create trigger trg_companies_updated before update on public.companies
  for each row execute function public.set_updated_at();
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_memberships_updated before update on public.company_memberships
  for each row execute function public.set_updated_at();

create trigger trg_customers_number before insert on public.customers
  for each row execute function public.before_insert_numbered_customer();
create trigger trg_customers_insert before insert on public.customers
  for each row execute function public.stamp_actor_insert();
create trigger trg_customers_update before update on public.customers
  for each row execute function public.stamp_actor_update();
create trigger trg_customers_updated before update on public.customers
  for each row execute function public.set_updated_at();

create trigger trg_services_insert before insert on public.services
  for each row execute function public.stamp_actor_insert();
create trigger trg_services_update before update on public.services
  for each row execute function public.stamp_actor_update();
create trigger trg_services_updated before update on public.services
  for each row execute function public.set_updated_at();

create trigger trg_quotations_insert before insert on public.quotations
  for each row execute function public.before_insert_quotation();
create trigger trg_quotations_update before update on public.quotations
  for each row execute function public.before_update_quotation();
create trigger trg_quotations_updated before update on public.quotations
  for each row execute function public.set_updated_at();
create trigger trg_quotation_items_protect before insert or update on public.quotation_items
  for each row execute function public.protect_quotation_item();
create trigger trg_quotation_items_after after insert or update or delete on public.quotation_items
  for each row execute function public.after_quotation_item_change();

create trigger trg_jobs_insert before insert on public.job_orders
  for each row execute function public.before_insert_job();
create trigger trg_jobs_update before update on public.job_orders
  for each row execute function public.before_update_job();
create trigger trg_jobs_updated before update on public.job_orders
  for each row execute function public.set_updated_at();
create trigger trg_jobs_history after insert on public.job_orders
  for each row execute function public.after_insert_job();
create trigger trg_job_items_protect before insert or update on public.job_items
  for each row execute function public.protect_job_item();

create trigger trg_invoices_insert before insert on public.invoices
  for each row execute function public.before_insert_invoice();
create trigger trg_invoices_update before update on public.invoices
  for each row execute function public.before_update_invoice();
create trigger trg_invoices_updated before update on public.invoices
  for each row execute function public.set_updated_at();
create trigger trg_invoice_items_protect before insert or update on public.invoice_items
  for each row execute function public.protect_invoice_item();
create trigger trg_invoice_items_after after insert or update or delete on public.invoice_items
  for each row execute function public.after_invoice_item_change();

create trigger trg_allocations_validate before insert or update on public.payment_allocations
  for each row execute function public.validate_allocation();
create trigger trg_allocations_after after insert or update or delete on public.payment_allocations
  for each row execute function public.after_allocation_change();
create trigger trg_payments_status after update on public.payments
  for each row execute function public.after_payment_status_change();

create trigger trg_materials_number before insert on public.materials
  for each row execute function public.before_insert_numbered_material();
create trigger trg_materials_insert before insert on public.materials
  for each row execute function public.before_insert_material();
create trigger trg_materials_update before update on public.materials
  for each row execute function public.before_update_material();
create trigger trg_materials_updated before update on public.materials
  for each row execute function public.set_updated_at();

create trigger trg_suppliers_number before insert on public.suppliers
  for each row execute function public.before_insert_numbered_supplier();
create trigger trg_suppliers_insert before insert on public.suppliers
  for each row execute function public.stamp_actor_insert();
create trigger trg_suppliers_update before update on public.suppliers
  for each row execute function public.stamp_actor_update();
create trigger trg_suppliers_updated before update on public.suppliers
  for each row execute function public.set_updated_at();

create trigger trg_purchase_orders_insert before insert on public.purchase_orders
  for each row execute function public.before_insert_purchase_order();
create trigger trg_purchase_orders_update before update on public.purchase_orders
  for each row execute function public.before_update_purchase_order();
create trigger trg_purchase_orders_updated before update on public.purchase_orders
  for each row execute function public.set_updated_at();
create trigger trg_purchase_order_items_protect before insert or update on public.purchase_order_items
  for each row execute function public.protect_purchase_order_item();
create trigger trg_purchase_order_items_after after insert or update or delete on public.purchase_order_items
  for each row execute function public.after_purchase_order_item_change();

create trigger trg_recipes_updated before update on public.material_recipes
  for each row execute function public.set_updated_at();

create trigger trg_expenses_insert before insert on public.expenses
  for each row execute function public.before_insert_expense();
create trigger trg_expenses_updated before update on public.expenses
  for each row execute function public.set_updated_at();

create trigger trg_artwork_insert before insert on public.artwork_files
  for each row execute function public.before_insert_artwork();

create trigger trg_outbox_updated before update on public.notification_outbox
  for each row execute function public.set_updated_at();

create trigger trg_audit_companies after insert or update or delete on public.companies
  for each row execute function public.write_audit_log();
create trigger trg_audit_memberships after insert or update or delete on public.company_memberships
  for each row execute function public.write_audit_log();
create trigger trg_audit_customers after insert or update or delete on public.customers
  for each row execute function public.write_audit_log();
create trigger trg_audit_services after insert or update or delete on public.services
  for each row execute function public.write_audit_log();
create trigger trg_audit_quotations after insert or update or delete on public.quotations
  for each row execute function public.write_audit_log();
create trigger trg_audit_jobs after insert or update or delete on public.job_orders
  for each row execute function public.write_audit_log();
create trigger trg_audit_artwork after insert or update or delete on public.artwork_files
  for each row execute function public.write_audit_log();
create trigger trg_audit_invoices after insert or update or delete on public.invoices
  for each row execute function public.write_audit_log();
create trigger trg_audit_payments after insert or update or delete on public.payments
  for each row execute function public.write_audit_log();
create trigger trg_audit_allocations after insert or update or delete on public.payment_allocations
  for each row execute function public.write_audit_log();
create trigger trg_audit_materials after insert or update or delete on public.materials
  for each row execute function public.write_audit_log();
create trigger trg_audit_stock after insert or update or delete on public.stock_movements
  for each row execute function public.write_audit_log();
create trigger trg_audit_suppliers after insert or update or delete on public.suppliers
  for each row execute function public.write_audit_log();
create trigger trg_audit_purchase_orders after insert or update or delete on public.purchase_orders
  for each row execute function public.write_audit_log();
create trigger trg_audit_expenses after insert or update or delete on public.expenses
  for each row execute function public.write_audit_log();
create trigger trg_audit_recipes after insert or update or delete on public.material_recipes
  for each row execute function public.write_audit_log();
