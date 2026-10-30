-- Read models. Views use security_invoker so the caller's RLS policies and
-- permissions continue to apply.

create or replace view public.invoice_balances
with (security_invoker = true)
as
select
  i.id,
  i.company_id,
  i.customer_id,
  i.invoice_number,
  i.status,
  i.issue_date,
  i.due_date,
  i.total_minor,
  i.amount_paid_minor as paid_minor,
  (i.total_minor - i.amount_paid_minor) as outstanding_minor
from public.invoices i;

create or replace view public.payment_balances
with (security_invoker = true)
as
select
  p.id,
  p.company_id,
  p.customer_id,
  p.payment_reference,
  p.payment_method,
  p.payment_date,
  p.status,
  p.amount_minor,
  coalesce(sum(a.amount_minor) filter (where a.status = 'recorded'), 0)::bigint as allocated_minor,
  (p.amount_minor - coalesce(sum(a.amount_minor) filter (where a.status = 'recorded'), 0))::bigint as unallocated_minor
from public.payments p
left join public.payment_allocations a on a.payment_id = p.id
group by p.id;

create or replace view public.customer_balances
with (security_invoker = true)
as
select
  c.id as customer_id,
  c.company_id,
  c.name,
  c.customer_code,
  coalesce(sum(i.total_minor) filter (where i.status <> 'void'), 0)::bigint as invoiced_minor,
  coalesce(sum(i.amount_paid_minor) filter (where i.status <> 'void'), 0)::bigint as paid_minor,
  coalesce(sum(i.total_minor - i.amount_paid_minor) filter (where i.status <> 'void'), 0)::bigint as outstanding_minor
from public.customers c
left join public.invoices i on i.customer_id = c.id and i.company_id = c.company_id
group by c.id, c.company_id, c.name, c.customer_code;

create or replace view public.material_valuation
with (security_invoker = true)
as
select
  m.id,
  m.company_id,
  m.material_code,
  m.name,
  m.unit,
  m.quantity_on_hand,
  m.reorder_level,
  m.average_unit_cost_minor,
  round(m.quantity_on_hand * m.average_unit_cost_minor)::bigint as stock_value_minor,
  (m.quantity_on_hand <= m.reorder_level and m.active) as is_low_stock
from public.materials m;

create or replace view public.job_profitability
with (security_invoker = true)
as
select
  j.id as job_order_id,
  j.company_id,
  j.job_number,
  j.title,
  j.status,
  j.customer_id,
  coalesce(rev.revenue_minor, 0)::bigint as revenue_minor,
  coalesce(mat.material_cost_minor, 0)::bigint as material_cost_minor,
  (coalesce(rev.revenue_minor, 0) - coalesce(mat.material_cost_minor, 0))::bigint as gross_profit_minor,
  case
    when coalesce(rev.revenue_minor, 0) > 0
      then round(
        ((coalesce(rev.revenue_minor, 0) - coalesce(mat.material_cost_minor, 0))::numeric
         / rev.revenue_minor::numeric) * 100,
        2
      )
    else null
  end as gross_margin_percent
from public.job_orders j
left join (
  select job_order_id, sum(total_minor)::bigint as revenue_minor
  from public.invoices
  where job_order_id is not null and status <> 'void'
  group by job_order_id
) rev on rev.job_order_id = j.id
left join (
  select reference_id as job_order_id,
         sum(round(abs(quantity_delta) * coalesce(unit_cost_minor, 0)))::bigint as material_cost_minor
  from public.stock_movements
  where movement_type = 'consumption' and reference_type = 'job_order'
  group by reference_id
) mat on mat.job_order_id = j.id;

grant select on public.invoice_balances to authenticated;
grant select on public.payment_balances to authenticated;
grant select on public.customer_balances to authenticated;
grant select on public.material_valuation to authenticated;
grant select on public.job_profitability to authenticated;
