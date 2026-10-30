-- Row Level Security. Every tenant-owned table is protected for SELECT,
-- INSERT, UPDATE and DELETE independently. Sensitive write paths additionally
-- have no direct policy and are reachable only through checked RPCs.

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.job_orders enable row level security;
alter table public.job_items enable row level security;
alter table public.job_status_history enable row level security;
alter table public.artwork_files enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.materials enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.material_recipes enable row level security;
alter table public.expenses enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.audit_logs enable row level security;
alter table public.document_counters enable row level security;
alter table public.api_rate_limits enable row level security;

-- ---------------------------------------------------------------------------
-- Tenancy, identity and administration
-- ---------------------------------------------------------------------------

create policy companies_select on public.companies
  for select to authenticated
  using (public.is_company_member(id));

create policy companies_update on public.companies
  for update to authenticated
  using (public.has_company_permission(id, 'settings.manage'))
  with check (public.has_company_permission(id, 'settings.manage'));

create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_select_colleagues on public.profiles
  for select to authenticated
  using (public.shares_company_with(id));

create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy memberships_select on public.company_memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_company_permission(company_id, 'staff.view')
  );

create policy invitations_select on public.invitations
  for select to authenticated
  using (public.has_company_permission(company_id, 'staff.view'));

-- ---------------------------------------------------------------------------
-- Company-owned tables with direct CRUD policies
-- ---------------------------------------------------------------------------

do $$
declare
  v_table text;
  v_view text;
  v_insert text;
  v_update text;
  v_delete text;
  v_delete_condition text;
  r record;
begin
  for r in
    select * from (values
      ('customers', 'customers.view', 'customers.manage', 'customers.manage', null::text, null::text),
      ('services', 'services.view', 'services.manage', 'services.manage', null::text, null::text),
      ('quotations', 'quotations.view', 'quotations.manage', 'quotations.manage', 'quotations.manage', 'status = ''draft'''),
      ('quotation_items', 'quotations.view', 'quotations.manage', 'quotations.manage', 'quotations.manage', null::text),
      ('job_orders', 'jobs.view', 'jobs.manage', 'jobs.manage', null::text, null::text),
      ('job_items', 'jobs.view', 'jobs.manage', 'jobs.manage', 'jobs.manage', null::text),
      ('job_status_history', 'jobs.view', null::text, null::text, null::text, null::text),
      ('artwork_files', 'artwork.view', 'artwork.manage', null::text, null::text, null::text),
      ('invoices', 'invoices.view', 'invoices.manage', 'invoices.manage', null::text, null::text),
      ('invoice_items', 'invoices.view', 'invoices.manage', 'invoices.manage', 'invoices.manage', null::text),
      ('payments', 'payments.view', null::text, null::text, null::text, null::text),
      ('payment_allocations', 'payments.view', null::text, null::text, null::text, null::text),
      ('materials', 'inventory.view', 'inventory.manage', 'inventory.manage', null::text, null::text),
      ('material_recipes', 'inventory.view', 'inventory.manage', 'inventory.manage', 'inventory.manage', null::text),
      ('suppliers', 'suppliers.view', 'suppliers.manage', 'suppliers.manage', null::text, null::text),
      ('purchase_orders', 'purchases.view', 'purchases.manage', 'purchases.manage', 'purchases.manage', 'status = ''draft'''),
      ('purchase_order_items', 'purchases.view', 'purchases.manage', 'purchases.manage', 'purchases.manage', null::text),
      ('stock_movements', 'inventory.view', null::text, null::text, null::text, null::text),
      ('expenses', 'expenses.view', 'expenses.manage', 'expenses.manage', null::text, null::text)
    ) as t(tbl, view_perm, insert_perm, update_perm, delete_perm, delete_condition)
  loop
    v_table := r.tbl;
    v_view := r.view_perm;
    v_insert := r.insert_perm;
    v_update := r.update_perm;
    v_delete := r.delete_perm;
    v_delete_condition := r.delete_condition;

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_company_member(company_id) and public.has_company_permission(company_id, %L))',
      v_table || '_select', v_table, v_view
    );

    if v_insert is not null then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (public.is_company_member(company_id) and public.has_company_permission(company_id, %L))',
        v_table || '_insert', v_table, v_insert
      );
    end if;

    if v_update is not null then
      execute format(
        'create policy %I on public.%I for update to authenticated using (public.is_company_member(company_id) and public.has_company_permission(company_id, %L)) with check (public.is_company_member(company_id) and public.has_company_permission(company_id, %L))',
        v_table || '_update', v_table, v_update, v_update
      );
    end if;

    if v_delete is not null then
      execute format(
        'create policy %I on public.%I for delete to authenticated using (public.is_company_member(company_id) and public.has_company_permission(company_id, %L)%s)',
        v_table || '_delete', v_table, v_delete,
        case when v_delete_condition is null then '' else ' and ' || v_delete_condition end
      );
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notifications and audit
-- ---------------------------------------------------------------------------

create policy notifications_select on public.notifications
  for select to authenticated
  using (
    channel = 'in_app'
    and public.has_company_permission(company_id, 'notifications.view')
    and (recipient_user_id is null or recipient_user_id = auth.uid())
  );

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.has_company_permission(company_id, 'audit.view'));

-- No policies are created on notification_outbox, document_counters,
-- api_rate_limits, payments, payment_allocations or stock_movements for
-- INSERT/UPDATE/DELETE. Those paths are available only through checked
-- SECURITY DEFINER functions or trusted server-side service-role workers.

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

grant execute on function public.is_service_role() to authenticated;
grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.has_company_role(uuid, text[]) to authenticated;
grant execute on function public.has_company_permission(uuid, text) to authenticated;
grant execute on function public.shares_company_with(uuid) to authenticated;
grant execute on function public.assignable_permissions() to authenticated;
grant execute on function public.next_document_number(uuid, text) to authenticated;
grant execute on function public.active_invoice_paid(uuid) to authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

grant execute on function public.create_company(text, text, text) to authenticated;
grant execute on function public.create_invitation(uuid, text, text, text[], text, timestamptz) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.set_member_role(uuid, text, text[]) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;
grant execute on function public.convert_quotation_to_job(uuid, text, date, text) to authenticated;
grant execute on function public.transition_job_status(uuid, text, text, text) to authenticated;
grant execute on function public.consume_job_materials(uuid, jsonb, text, text) to authenticated;
grant execute on function public.adjust_stock(uuid, numeric, text, text, text, bigint) to authenticated;
grant execute on function public.receive_purchase_order(uuid, jsonb, text) to authenticated;
grant execute on function public.record_payment(uuid, uuid, bigint, text, date, text, text, text, text, jsonb) to authenticated;
grant execute on function public.reverse_payment(uuid, text) to authenticated;
grant execute on function public.void_invoice(uuid, text) to authenticated;
grant execute on function public.review_artwork(uuid, text, text) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated;

-- Internal helpers must not be reachable directly by application users.
revoke execute on function public.queue_notification(uuid, text, text, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.queue_low_stock_notification(uuid) from public, anon, authenticated;

-- Scheduled work is callable only by a trusted worker (service role).
revoke execute on function public.expire_quotations() from public, anon, authenticated;
revoke execute on function public.enqueue_overdue_invoice_notifications() from public, anon, authenticated;
revoke execute on function public.enqueue_due_job_notifications() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.expire_quotations() to service_role';
    execute 'grant execute on function public.enqueue_overdue_invoice_notifications() to service_role';
    execute 'grant execute on function public.enqueue_due_job_notifications() to service_role';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Private storage buckets and tenant-aware object policies
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'artwork', 'artwork', false, 26214400,
      array['application/pdf', 'image/png', 'image/jpeg', 'image/tiff', 'image/webp']
    )
    on conflict (id) do nothing;

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'receipts', 'receipts', false, 10485760,
      array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
    )
    on conflict (id) do nothing;

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'company-assets', 'company-assets', false, 5242880,
      array['image/png', 'image/jpeg', 'image/webp']
    )
    on conflict (id) do nothing;
  end if;

  if to_regclass('storage.objects') is not null
     and to_regprocedure('storage.foldername(text)') is not null then
    execute $policy$
      create policy printflow_artwork_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'artwork'
        and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and public.is_company_member(((storage.foldername(name))[1])::uuid)
        and public.has_company_permission(((storage.foldername(name))[1])::uuid, 'artwork.view')
      )
    $policy$;

    execute $policy$
      create policy printflow_artwork_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'artwork'
        and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and public.is_company_member(((storage.foldername(name))[1])::uuid)
        and public.has_company_permission(((storage.foldername(name))[1])::uuid, 'artwork.manage')
      )
    $policy$;

    execute $policy$
      create policy printflow_artwork_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'artwork'
        and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and public.is_company_member(((storage.foldername(name))[1])::uuid)
        and public.has_company_permission(((storage.foldername(name))[1])::uuid, 'artwork.manage')
      )
    $policy$;

    execute $policy$
      create policy printflow_receipts_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'receipts'
        and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and public.is_company_member(((storage.foldername(name))[1])::uuid)
        and public.has_company_permission(((storage.foldername(name))[1])::uuid, 'expenses.view')
      )
    $policy$;

    execute $policy$
      create policy printflow_receipts_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'receipts'
        and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and public.is_company_member(((storage.foldername(name))[1])::uuid)
        and public.has_company_permission(((storage.foldername(name))[1])::uuid, 'expenses.manage')
      )
    $policy$;

    execute $policy$
      create policy printflow_company_assets_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'company-assets'
        and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and public.is_company_member(((storage.foldername(name))[1])::uuid)
      )
    $policy$;

    execute $policy$
      create policy printflow_company_assets_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'company-assets'
        and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and public.has_company_permission(((storage.foldername(name))[1])::uuid, 'settings.manage')
      )
    $policy$;
  end if;
end;
$$;
