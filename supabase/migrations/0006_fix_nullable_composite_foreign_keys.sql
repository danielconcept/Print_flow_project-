-- Preserve tenant ownership when an optional related record is deleted.
-- PostgreSQL 15+ supports a column list for ON DELETE SET NULL.

alter table public.quotation_items
  drop constraint if exists quotation_items_service_fk;
alter table public.quotation_items
  add constraint quotation_items_service_fk
  foreign key (service_id, company_id)
  references public.services (id, company_id) on delete set null (service_id);

alter table public.job_orders
  drop constraint if exists job_orders_quotation_fk;
alter table public.job_orders
  add constraint job_orders_quotation_fk
  foreign key (quotation_id, company_id)
  references public.quotations (id, company_id) on delete set null (quotation_id);

alter table public.job_items
  drop constraint if exists job_items_service_fk;
alter table public.job_items
  add constraint job_items_service_fk
  foreign key (service_id, company_id)
  references public.services (id, company_id) on delete set null (service_id);

alter table public.invoices
  drop constraint if exists invoices_job_fk;
alter table public.invoices
  add constraint invoices_job_fk
  foreign key (job_order_id, company_id)
  references public.job_orders (id, company_id) on delete set null (job_order_id);

alter table public.invoices
  drop constraint if exists invoices_quotation_fk;
alter table public.invoices
  add constraint invoices_quotation_fk
  foreign key (quotation_id, company_id)
  references public.quotations (id, company_id) on delete set null (quotation_id);

alter table public.invoice_items
  drop constraint if exists invoice_items_service_fk;
alter table public.invoice_items
  add constraint invoice_items_service_fk
  foreign key (service_id, company_id)
  references public.services (id, company_id) on delete set null (service_id);

alter table public.expenses
  drop constraint if exists expenses_supplier_fk;
alter table public.expenses
  add constraint expenses_supplier_fk
  foreign key (supplier_id, company_id)
  references public.suppliers (id, company_id) on delete set null (supplier_id);

alter table public.notifications
  drop constraint if exists notifications_customer_fk;
alter table public.notifications
  add constraint notifications_customer_fk
  foreign key (customer_id, company_id)
  references public.customers (id, company_id) on delete set null (customer_id);
