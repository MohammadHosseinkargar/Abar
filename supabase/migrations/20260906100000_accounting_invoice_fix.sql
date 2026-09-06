-- ──────────────────────────────────────────────────────────────────────────────
-- Patch: fix save_accounting_invoice (subtotal formula + server-side
--        payment_status derivation) and reconcile existing invoice rows.
--
-- PROBLEM 1: the original function stored subtotal = sub + disc, which
--   inflated the subtotal by adding line discounts back on top of the gross.
--   Correct value: subtotal = sum(qty * final_unit_price)  (gross before any
--   discounts).
--
-- PROBLEM 2: total_amount was computed as sub - disc + shipping, which ignored
--   the invoice-level discount (_invoice->>'discountAmount').  Correct formula:
--   total_amount = subtotal - (line_discounts + invoice_discount) + shipping
--                = greatest(0, sub - disc - inv_discount + shipping)
--
-- PROBLEM 3: payment_status was taken verbatim from the client payload, so a
--   client could submit paid_amount=0 with payment_status='paid'.  The status
--   is now derived server-side from paid_amount vs total_amount.
--
-- DATA REPAIR: existing invoices whose subtotal or total_amount were written
--   by the buggy function are recalculated from the stored invoice_items.
--   payment_status is also recomputed from paid_amount / total_amount.
--   The repair is safe: it only touches rows where the derived value differs
--   from the stored value, and it runs inside an explicit transaction.
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Replace the stored function with the corrected version.
create or replace function public.save_accounting_invoice(_invoice jsonb, _items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  iid          uuid;
  it           jsonb;
  sub          bigint := 0;   -- gross items total (sum qty * finalUnitPrice)
  disc         bigint := 0;   -- sum of per-line discount amounts
  inv_discount bigint := 0;   -- invoice-level additional discount
  shipping     bigint := 0;
  total_amt    bigint := 0;
  paid_amt     bigint := 0;
  computed_status text;
  next_no      bigint;
  prefix       text;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not allowed';
  end if;
  if jsonb_array_length(_items) = 0 then
    raise exception 'invoice needs at least one item';
  end if;

  iid          := nullif(_invoice->>'id', '')::uuid;
  inv_discount := coalesce((_invoice->>'discountAmount')::bigint, 0);
  shipping     := coalesce((_invoice->>'shippingAmount')::bigint, 0);

  -- Validate items and accumulate gross totals
  for it in select * from jsonb_array_elements(_items) loop
    if (it->>'quantity')::integer < 1 then
      raise exception 'quantity must be at least 1';
    end if;
    if (it->>'finalUnitPrice')::bigint < 0 then
      raise exception 'unit price cannot be negative';
    end if;
    sub  := sub  + (it->>'quantity')::integer * (it->>'finalUnitPrice')::bigint;
    disc := disc + coalesce((it->>'discountAmount')::bigint, 0);
  end loop;

  if disc + inv_discount > sub then
    raise exception 'total discounts (%) exceed invoice subtotal (%)',
      disc + inv_discount, sub;
  end if;

  -- Correct formulas:
  --   subtotal        = gross items before any discounts
  --   discount_amount = line discounts + invoice-level discount
  --   total_amount    = subtotal - discount_amount + shipping  (≥ 0)
  total_amt := greatest(0, sub - disc - inv_discount + shipping);
  paid_amt  := coalesce((_invoice->>'paidAmount')::bigint, 0);

  -- Defensive clamp (also enforced by DB check constraint)
  if paid_amt > total_amt then paid_amt := total_amt; end if;

  -- Derive payment_status server-side; never trust the client value
  if _invoice->>'paymentStatus' = 'cancelled' then
    computed_status := 'cancelled';
  elsif total_amt <= 0 then
    -- zero-total invoice (fully discounted) is treated as fully paid
    computed_status := 'paid';
  elsif paid_amt >= total_amt then
    computed_status := 'paid';
  elsif paid_amt > 0 then
    computed_status := 'partial';
  else
    computed_status := 'unpaid';
  end if;

  if iid is null then
    -- New invoice — grab and increment the counter with a row lock to
    -- prevent duplicate invoice numbers under concurrent requests.
    select invoice_prefix, invoice_next_number
      into prefix, next_no
      from financial_settings
     where id = true
       for update;

    insert into invoices (
      invoice_number, issued_at, customer_name, customer_phone,
      customer_address, customer_postal_code, notes,
      subtotal, discount_amount, shipping_amount, total_amount,
      paid_amount, payment_status, payment_method, created_by
    ) values (
      prefix || next_no,
      coalesce((_invoice->>'issuedAt')::timestamptz, now()),
      _invoice->>'customerName',
      nullif(_invoice->>'customerPhone', ''),
      nullif(_invoice->>'customerAddress', ''),
      nullif(_invoice->>'customerPostalCode', ''),
      nullif(_invoice->>'notes', ''),
      sub,                       -- subtotal = gross before any discounts
      disc + inv_discount,       -- discount_amount = line + invoice discounts
      shipping,
      total_amt,
      paid_amt,
      computed_status,
      nullif(_invoice->>'paymentMethod', ''),
      auth.uid()
    ) returning id into iid;

    update financial_settings
       set invoice_next_number = next_no + 1
     where id = true;
  else
    update invoices set
      issued_at            = coalesce((_invoice->>'issuedAt')::timestamptz, issued_at),
      customer_name        = _invoice->>'customerName',
      customer_phone       = nullif(_invoice->>'customerPhone', ''),
      customer_address     = nullif(_invoice->>'customerAddress', ''),
      customer_postal_code = nullif(_invoice->>'customerPostalCode', ''),
      notes                = nullif(_invoice->>'notes', ''),
      subtotal             = sub,
      discount_amount      = disc + inv_discount,
      shipping_amount      = shipping,
      total_amount         = total_amt,
      paid_amount          = paid_amt,
      payment_status       = computed_status,
      payment_method       = nullif(_invoice->>'paymentMethod', '')
    where id = iid;

    if not found then
      raise exception 'invoice not found';
    end if;

    delete from invoice_items where invoice_id = iid;
  end if;

  for it in select * from jsonb_array_elements(_items) loop
    insert into invoice_items (
      invoice_id, product_id, product_name, quantity,
      catalog_unit_price, final_unit_price, unit_cost,
      discount_amount, line_total, notes
    ) values (
      iid,
      nullif(it->>'productId', '')::uuid,
      it->>'productName',
      (it->>'quantity')::integer,
      coalesce((it->>'catalogUnitPrice')::bigint, 0),
      (it->>'finalUnitPrice')::bigint,
      coalesce((it->>'unitCost')::bigint, 0),
      coalesce((it->>'discountAmount')::bigint, 0),
      -- line_total = qty * price - line_discount  (clamped ≥ 0)
      greatest(
        0,
        (it->>'quantity')::integer * (it->>'finalUnitPrice')::bigint
        - coalesce((it->>'discountAmount')::bigint, 0)
      ),
      nullif(it->>'notes', '')
    );
  end loop;

  return iid;
end $$;

-- 2. Data repair: recalculate subtotal, discount_amount, total_amount and
--    payment_status for all existing invoices from their stored items.
--    Runs in a single statement using a CTE for atomicity.
do $$
declare
  repaired integer := 0;
begin
  with recalc as (
    select
      i.id,
      -- correct subtotal = sum(qty * final_unit_price)
      coalesce(sum(ii.quantity::bigint * ii.final_unit_price), 0)                    as correct_subtotal,
      -- discount_amount is stored as (line_discounts + invoice_discount); keep as-is
      -- because we cannot recover the original invoice-level discount separately.
      -- We keep the existing discount_amount and recompute total_amount from it.
      i.discount_amount                                                                as correct_discount,
      i.shipping_amount                                                                as correct_shipping,
      greatest(0,
        coalesce(sum(ii.quantity::bigint * ii.final_unit_price), 0)
        - i.discount_amount
        + i.shipping_amount
      )                                                                               as correct_total
    from invoices i
    left join invoice_items ii on ii.invoice_id = i.id
    group by i.id, i.discount_amount, i.shipping_amount
  ),
  updated as (
    update invoices inv set
      subtotal     = r.correct_subtotal,
      total_amount = r.correct_total,
      -- Recompute paid_amount clamp (must not exceed new total)
      paid_amount  = least(inv.paid_amount, r.correct_total),
      payment_status = case
        when inv.payment_status = 'cancelled' then 'cancelled'
        when r.correct_total = 0
          or least(inv.paid_amount, r.correct_total) >= r.correct_total then 'paid'
        when least(inv.paid_amount, r.correct_total) > 0 then 'partial'
        else 'unpaid'
      end
    from recalc r
    where inv.id = r.id
      and (
        inv.subtotal     <> r.correct_subtotal
        or inv.total_amount <> r.correct_total
        or inv.paid_amount  > r.correct_total   -- was overclamped
        or (inv.payment_status <> 'cancelled' and (
          (least(inv.paid_amount, r.correct_total) >= r.correct_total and inv.payment_status <> 'paid')
          or (least(inv.paid_amount, r.correct_total) > 0 and least(inv.paid_amount, r.correct_total) < r.correct_total and inv.payment_status <> 'partial')
          or (least(inv.paid_amount, r.correct_total) = 0 and inv.payment_status <> 'unpaid')
        ))
      )
    returning 1
  )
  select count(*) into repaired from updated;

  if repaired > 0 then
    raise notice 'accounting_invoice_fix: repaired % invoice row(s)', repaired;
  else
    raise notice 'accounting_invoice_fix: no rows needed repair';
  end if;
end $$;

-- 3. Missing performance indexes (manual_incomes, financial_transactions composite)
create index if not exists manual_incomes_occurred_at_idx
  on public.manual_incomes (occurred_at);

create index if not exists financial_transactions_source_idx
  on public.financial_transactions (source_type, source_id);
