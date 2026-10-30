-- PrintFlow schema — multi-tenant printing business management
-- All money is stored as integer minor units (kobo). Quantities use numeric(14,3).
-- Every tenant-owned row carries company_id and uses composite foreign keys so a
-- row from one company can never reference a row from another company.

-- ---------------------------------------------------------------------------
-- Identity and tenancy
-- ---------------------------------------------------------------------------

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  legal_name text,
  email text,
  phone text,
  address text,
  logo_path text,
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Africa/Lagos',
  tax_settings jsonb not null default '{"default_rate":0,"prices_include_tax":false,"tax_label":"VAT"}'::jsonb
    check (jsonb_typeof(tax_settings) = 'object'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint companies_slug_unique unique (slug)
);

create table if not exists public.profiles (
  id uuid primary key,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'staff' check (role in ('owner', 'admin', 'staff')),
  permissions text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  invited_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_memberships_unique unique (company_id, user_id)
);

create unique index if not exists company_memberships_one_owner
  on public.company_memberships (company_id)
  where role = 'owner' and status = 'active';
create index if not exists company_memberships_user_idx
  on public.company_memberships (user_id, status);
create index if not exists company_memberships_company_idx
  on public.company_memberships (company_id, status);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null check (email = lower(email) and email like '%_@_%._%'),
  role text not null default 'staff' check (role in ('admin', 'staff')),
  permissions text[] not null default '{}',
  token_hash text not null unique,
  expires_at timestamptz not null,
  invited_by uuid not null,
  accepted_by uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invitations_company_idx on public.invitations (company_id, created_at desc);
create unique index if not exists invitations_pending_email
  on public.invitations (company_id, email)
  where accepted_at is null and revoked_at is null;

-- ---------------------------------------------------------------------------
-- Customers and services
-- ---------------------------------------------------------------------------

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_code text not null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  phone text not null check (char_length(trim(phone)) between 5 and 40),
  email text,
  address text,
  notes text,
  archived_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_company_id_unique unique (id, company_id),
  constraint customers_code_unique unique (company_id, customer_code)
);
create index if not exists customers_company_name_idx on public.customers (company_id, lower(name));
create index if not exists customers_company_phone_idx on public.customers (company_id, phone);
create index if not exists customers_company_email_idx on public.customers (company_id, lower(email));
create index if not exists customers_company_archived_idx on public.customers (company_id, archived_at);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text,
  category text not null default 'general',
  default_unit text not null default 'piece',
  default_unit_price_minor bigint not null default 0 check (default_unit_price_minor >= 0),
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_company_id_unique unique (id, company_id),
  constraint services_company_name_unique unique (company_id, name)
);
create index if not exists services_company_active_idx on public.services (company_id, active);

-- ---------------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------------

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null,
  quotation_number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')),
  issue_date date not null default current_date,
  valid_until date,
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  item_discount_minor bigint not null default 0 check (item_discount_minor >= 0),
  order_discount_minor bigint not null default 0 check (order_discount_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  notes text,
  terms text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotations_company_id_unique unique (id, company_id),
  constraint quotations_number_unique unique (company_id, quotation_number),
  constraint quotations_customer_fk foreign key (customer_id, company_id)
    references public.customers (id, company_id) on delete restrict,
  constraint quotations_terms_valid check (valid_until is null or valid_until >= issue_date)
);
create index if not exists quotations_company_status_idx on public.quotations (company_id, status, issue_date desc);
create index if not exists quotations_company_customer_idx on public.quotations (company_id, customer_id);
create index if not exists quotations_company_number_idx on public.quotations (company_id, quotation_number);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quotation_id uuid not null,
  service_id uuid,
  description text not null check (char_length(trim(description)) between 1 and 500),
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null default 'piece',
  unit_price_minor bigint not null default 0 check (unit_price_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_rate numeric(7,4) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  line_total_minor bigint not null default 0 check (line_total_minor >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint quotation_items_quotation_fk foreign key (quotation_id, company_id)
    references public.quotations (id, company_id) on delete cascade,
  constraint quotation_items_service_fk foreign key (service_id, company_id)
    references public.services (id, company_id) on delete set null
);
create index if not exists quotation_items_quotation_idx on public.quotation_items (quotation_id, position);

-- ---------------------------------------------------------------------------
-- Jobs and artwork
-- ---------------------------------------------------------------------------

create table if not exists public.job_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null,
  quotation_id uuid,
  job_number text not null,
  title text not null check (char_length(trim(title)) between 2 and 180),
  description text,
  status text not null default 'received'
    check (status in ('received', 'in_design', 'in_production', 'ready', 'delivered', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_date date,
  design_required boolean not null default false,
  design_approval_required boolean not null default false,
  assigned_to uuid,
  production_started_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  delivery_notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_orders_company_id_unique unique (id, company_id),
  constraint job_orders_number_unique unique (company_id, job_number),
  constraint job_orders_customer_fk foreign key (customer_id, company_id)
    references public.customers (id, company_id) on delete restrict,
  constraint job_orders_quotation_fk foreign key (quotation_id, company_id)
    references public.quotations (id, company_id) on delete set null
);
create index if not exists job_orders_company_status_idx on public.job_orders (company_id, status, due_date);
create index if not exists job_orders_company_customer_idx on public.job_orders (company_id, customer_id);
create index if not exists job_orders_company_due_idx on public.job_orders (company_id, due_date);
create index if not exists job_orders_company_priority_idx on public.job_orders (company_id, priority);
create index if not exists job_orders_assigned_idx on public.job_orders (company_id, assigned_to);

create table if not exists public.job_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_order_id uuid not null,
  service_id uuid,
  description text not null check (char_length(trim(description)) between 1 and 500),
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null default 'piece',
  dimensions jsonb check (dimensions is null or jsonb_typeof(dimensions) = 'object'),
  unit_price_minor bigint not null default 0 check (unit_price_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  line_total_minor bigint not null default 0 check (line_total_minor >= 0),
  production_notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint job_items_job_fk foreign key (job_order_id, company_id)
    references public.job_orders (id, company_id) on delete cascade,
  constraint job_items_service_fk foreign key (service_id, company_id)
    references public.services (id, company_id) on delete set null
);
create index if not exists job_items_job_idx on public.job_items (job_order_id, position);

create table if not exists public.job_status_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_order_id uuid not null,
  previous_status text,
  new_status text not null,
  changed_by uuid,
  note text,
  created_at timestamptz not null default now(),
  constraint job_status_history_job_fk foreign key (job_order_id, company_id)
    references public.job_orders (id, company_id) on delete cascade
);
create index if not exists job_status_history_job_idx on public.job_status_history (job_order_id, created_at);

create table if not exists public.artwork_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_order_id uuid not null,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 26214400),
  version_number integer not null check (version_number > 0),
  uploaded_by uuid not null,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'awaiting_approval', 'approved', 'revision_required')),
  approved_by uuid,
  approved_at timestamptz,
  approval_note text,
  created_at timestamptz not null default now(),
  constraint artwork_files_job_fk foreign key (job_order_id, company_id)
    references public.job_orders (id, company_id) on delete cascade,
  constraint artwork_files_version_unique unique (job_order_id, version_number)
);
create index if not exists artwork_files_job_idx on public.artwork_files (job_order_id, version_number desc);
create index if not exists artwork_files_company_status_idx on public.artwork_files (company_id, approval_status);

-- ---------------------------------------------------------------------------
-- Invoices and payments
-- ---------------------------------------------------------------------------

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null,
  job_order_id uuid,
  quotation_id uuid,
  invoice_number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void')),
  issue_date date not null default current_date,
  due_date date,
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  item_discount_minor bigint not null default 0 check (item_discount_minor >= 0),
  order_discount_minor bigint not null default 0 check (order_discount_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  amount_paid_minor bigint not null default 0 check (amount_paid_minor >= 0),
  void_reason text,
  voided_at timestamptz,
  voided_by uuid,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_company_id_unique unique (id, company_id),
  constraint invoices_number_unique unique (company_id, invoice_number),
  constraint invoices_customer_fk foreign key (customer_id, company_id)
    references public.customers (id, company_id) on delete restrict,
  constraint invoices_job_fk foreign key (job_order_id, company_id)
    references public.job_orders (id, company_id) on delete set null,
  constraint invoices_quotation_fk foreign key (quotation_id, company_id)
    references public.quotations (id, company_id) on delete set null,
  constraint invoices_amount_paid_within_total check (amount_paid_minor <= total_minor)
);
create index if not exists invoices_company_status_idx on public.invoices (company_id, status, due_date);
create index if not exists invoices_company_customer_idx on public.invoices (company_id, customer_id);
create index if not exists invoices_company_issue_idx on public.invoices (company_id, issue_date desc);
create index if not exists invoices_company_number_idx on public.invoices (company_id, invoice_number);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_id uuid not null,
  service_id uuid,
  description text not null check (char_length(trim(description)) between 1 and 500),
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null default 'piece',
  unit_price_minor bigint not null default 0 check (unit_price_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_rate numeric(7,4) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  line_total_minor bigint not null default 0 check (line_total_minor >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint invoice_items_invoice_fk foreign key (invoice_id, company_id)
    references public.invoices (id, company_id) on delete cascade,
  constraint invoice_items_service_fk foreign key (service_id, company_id)
    references public.services (id, company_id) on delete set null
);
create index if not exists invoice_items_invoice_idx on public.invoice_items (invoice_id, position);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null,
  payment_reference text not null,
  amount_minor bigint not null check (amount_minor > 0),
  payment_method text not null check (char_length(trim(payment_method)) between 2 and 40),
  payment_date date not null default current_date,
  external_reference text,
  notes text,
  recorded_by uuid not null,
  status text not null default 'recorded' check (status in ('recorded', 'reversed')),
  idempotency_key text not null,
  reversed_at timestamptz,
  reversed_by uuid,
  reversal_reason text,
  created_at timestamptz not null default now(),
  constraint payments_company_id_unique unique (id, company_id),
  constraint payments_reference_unique unique (company_id, payment_reference),
  constraint payments_idempotency_unique unique (company_id, idempotency_key),
  constraint payments_customer_fk foreign key (customer_id, company_id)
    references public.customers (id, company_id) on delete restrict
);
create index if not exists payments_company_date_idx on public.payments (company_id, payment_date desc);
create index if not exists payments_company_customer_idx on public.payments (company_id, customer_id);
create index if not exists payments_company_status_idx on public.payments (company_id, status);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payment_id uuid not null,
  invoice_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'recorded' check (status in ('recorded', 'reversed')),
  reversed_at timestamptz,
  reversed_by uuid,
  created_at timestamptz not null default now(),
  constraint payment_allocations_payment_fk foreign key (payment_id, company_id)
    references public.payments (id, company_id) on delete cascade,
  constraint payment_allocations_invoice_fk foreign key (invoice_id, company_id)
    references public.invoices (id, company_id) on delete restrict,
  constraint payment_allocations_unique unique (payment_id, invoice_id)
);
create index if not exists payment_allocations_invoice_idx on public.payment_allocations (invoice_id, status);
create index if not exists payment_allocations_company_idx on public.payment_allocations (company_id);

-- ---------------------------------------------------------------------------
-- Inventory and suppliers
-- ---------------------------------------------------------------------------

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  material_code text not null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  category text not null default 'general',
  unit text not null default 'piece',
  quantity_on_hand numeric(14,3) not null default 0 check (quantity_on_hand >= 0),
  reorder_level numeric(14,3) not null default 0 check (reorder_level >= 0),
  average_unit_cost_minor bigint not null default 0 check (average_unit_cost_minor >= 0),
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint materials_company_id_unique unique (id, company_id),
  constraint materials_code_unique unique (company_id, material_code)
);
create index if not exists materials_company_active_idx on public.materials (company_id, active);
create index if not exists materials_company_name_idx on public.materials (company_id, lower(name));
create index if not exists materials_low_stock_idx on public.materials (company_id) where active;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_code text not null,
  name text not null check (char_length(trim(name)) between 2 and 160),
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_company_id_unique unique (id, company_id),
  constraint suppliers_code_unique unique (company_id, supplier_code)
);
create index if not exists suppliers_company_name_idx on public.suppliers (company_id, lower(name));

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  supplier_id uuid not null,
  purchase_order_number text not null,
  status text not null default 'draft'
    check (status in ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  order_date date not null default current_date,
  expected_date date,
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_orders_company_id_unique unique (id, company_id),
  constraint purchase_orders_number_unique unique (company_id, purchase_order_number),
  constraint purchase_orders_supplier_fk foreign key (supplier_id, company_id)
    references public.suppliers (id, company_id) on delete restrict
);
create index if not exists purchase_orders_company_status_idx on public.purchase_orders (company_id, status, order_date desc);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  purchase_order_id uuid not null,
  material_id uuid not null,
  quantity_ordered numeric(14,3) not null check (quantity_ordered > 0),
  quantity_received numeric(14,3) not null default 0 check (quantity_received >= 0),
  unit_cost_minor bigint not null default 0 check (unit_cost_minor >= 0),
  line_total_minor bigint not null default 0 check (line_total_minor >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint purchase_order_items_po_fk foreign key (purchase_order_id, company_id)
    references public.purchase_orders (id, company_id) on delete cascade,
  constraint purchase_order_items_material_fk foreign key (material_id, company_id)
    references public.materials (id, company_id) on delete restrict,
  constraint purchase_order_items_received_limit check (quantity_received <= quantity_ordered)
);
create index if not exists purchase_order_items_po_idx on public.purchase_order_items (purchase_order_id, position);
create index if not exists purchase_order_items_material_idx on public.purchase_order_items (material_id);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  material_id uuid not null,
  movement_type text not null
    check (movement_type in ('opening', 'purchase_receipt', 'consumption', 'adjustment', 'waste', 'reversal', 'return')),
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  unit_cost_minor bigint check (unit_cost_minor is null or unit_cost_minor >= 0),
  reference_type text,
  reference_id uuid,
  note text,
  performed_by uuid,
  idempotency_key text,
  created_at timestamptz not null default now(),
  constraint stock_movements_material_fk foreign key (material_id, company_id)
    references public.materials (id, company_id) on delete restrict
);
create index if not exists stock_movements_company_date_idx on public.stock_movements (company_id, created_at desc);
create index if not exists stock_movements_material_idx on public.stock_movements (material_id, created_at desc);
create index if not exists stock_movements_reference_idx on public.stock_movements (company_id, reference_type, reference_id);
create unique index if not exists stock_movements_idempotency_unique
  on public.stock_movements (company_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.material_recipes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service_id uuid not null,
  material_id uuid not null,
  quantity_per_output_unit numeric(14,4) not null check (quantity_per_output_unit > 0),
  waste_percentage numeric(6,2) not null default 0 check (waste_percentage >= 0 and waste_percentage <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_recipes_service_fk foreign key (service_id, company_id)
    references public.services (id, company_id) on delete cascade,
  constraint material_recipes_material_fk foreign key (material_id, company_id)
    references public.materials (id, company_id) on delete restrict,
  constraint material_recipes_unique unique (service_id, material_id)
);
create index if not exists material_recipes_service_idx on public.material_recipes (service_id) where active;

-- ---------------------------------------------------------------------------
-- Expenses, notifications, audit, counters
-- ---------------------------------------------------------------------------

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  expense_number text not null,
  category text not null check (char_length(trim(category)) between 2 and 60),
  description text not null check (char_length(trim(description)) between 2 and 300),
  amount_minor bigint not null check (amount_minor > 0),
  expense_date date not null default current_date,
  payment_method text,
  supplier_id uuid,
  receipt_path text,
  notes text,
  recorded_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_company_id_unique unique (id, company_id),
  constraint expenses_number_unique unique (company_id, expense_number),
  constraint expenses_supplier_fk foreign key (supplier_id, company_id)
    references public.suppliers (id, company_id) on delete set null
);
create index if not exists expenses_company_date_idx on public.expenses (company_id, expense_date desc);
create index if not exists expenses_company_category_idx on public.expenses (company_id, category);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  recipient_user_id uuid,
  customer_id uuid,
  event_type text not null,
  channel text not null check (channel in ('in_app', 'email', 'whatsapp')),
  destination text,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'not_configured', 'skipped')),
  provider_reference text,
  error_message text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  dedupe_key text,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_customer_fk foreign key (customer_id, company_id)
    references public.customers (id, company_id) on delete set null
);
create unique index if not exists notifications_dedupe_unique
  on public.notifications (company_id, dedupe_key)
  where dedupe_key is not null;
create index if not exists notifications_company_created_idx on public.notifications (company_id, created_at desc);
create index if not exists notifications_recipient_idx on public.notifications (recipient_user_id, read_at);

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'not_configured', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_outbox_unique unique (notification_id, channel)
);
create index if not exists notification_outbox_pending_idx
  on public.notification_outbox (status, next_attempt_at) where status = 'pending';

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_company_created_idx on public.audit_logs (company_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (company_id, entity_type, entity_id);

create table if not exists public.document_counters (
  company_id uuid not null references public.companies(id) on delete cascade,
  doc_type text not null,
  next_value integer not null default 1 check (next_value > 0),
  updated_at timestamptz not null default now(),
  primary key (company_id, doc_type)
);

create table if not exists public.api_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
);
