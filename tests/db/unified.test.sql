-- Unified product rules (migration 0008). Rolls back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.as_user(_uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true); perform set_config('role', 'authenticated', true); end $$;
create function pg_temp.as_owner() returns void language plpgsql as $$
begin perform set_config('role', 'none', true); perform set_config('request.jwt.claims', '', true); end $$;
create function pg_temp.expect_fail(_sql text, _pattern text) returns void language plpgsql as $$
declare failed boolean := false; msg text;
begin
  begin execute _sql; exception when others then failed := true; msg := sqlerrm; end;
  if not failed then raise exception 'FAIL: expected error (%) for: %', _pattern, _sql; end if;
  if msg not ilike _pattern then raise exception 'FAIL: wrong error "%" (expected %)', msg, _pattern; end if;
  raise notice 'ok - rejected: %', _pattern;
end $$;
create function pg_temp.eq(_label text, _got numeric, _want numeric) returns void language plpgsql as $$
begin if _got is distinct from _want then raise exception 'FAIL %: got %, want %', _label, _got, _want; end if; raise notice 'ok - %', _label; end $$;

insert into auth.users (id, email) values ('13000000-0000-0000-0000-000000000001','u1@unified.local'), ('13000000-0000-0000-0000-000000000002','u2@unified.local');
insert into public.organizations (id, name) values ('03000000-0000-0000-0000-0000000000a1', 'Unified A');
insert into public.memberships (organization_id, user_id, role) values
  ('03000000-0000-0000-0000-0000000000a1', '13000000-0000-0000-0000-000000000001', 'administrador'),
  ('03000000-0000-0000-0000-0000000000a1', '13000000-0000-0000-0000-000000000002', 'consulta');
insert into public.customers (id, organization_id, name) values ('33000000-0000-0000-0000-000000000001', '03000000-0000-0000-0000-0000000000a1', 'Tostador');
insert into public.org_settings (organization_id, settings) values ('03000000-0000-0000-0000-0000000000a1', '{"low_stock_kg": 100, "moisture_min": 10, "moisture_max": 12}');

do $$
declare A uuid := '03000000-0000-0000-0000-0000000000a1'; admin uuid := '13000000-0000-0000-0000-000000000001'; cons uuid := '13000000-0000-0000-0000-000000000002';
  cust uuid := '33000000-0000-0000-0000-000000000001'; l public.lots; r public.reservations; n int;
begin
  perform pg_temp.as_user(admin);
  l := public.create_lot(A, 'Stock', 300);
  l := public.release_lot_for_sale(l.id, 'listo');
  select count(*) into n from public.alerts where lot_id = l.id and kind = 'stock_bajo' and resolved_at is null;
  perform pg_temp.eq('no low-stock alert with 300 kg free (threshold 100)', n, 0);
  r := public.create_reservation(l.id, cust, 250, 6, 'USD');
  select count(*) into n from public.alerts where lot_id = l.id and kind = 'stock_bajo' and resolved_at is null;
  perform pg_temp.eq('low-stock alert when free drops to 50 kg', n, 1);
  perform public.adjust_inventory(l.id, 10, 'recuento');
  select count(*) into n from public.alerts where lot_id = l.id and kind = 'stock_bajo';
  perform pg_temp.eq('no duplicate low-stock alert while still below', n, 1);
  perform public.cancel_reservation(r.id, 'prueba');
  select count(*) into n from public.alerts where lot_id = l.id and kind = 'stock_bajo' and resolved_at is null;
  perform pg_temp.eq('low-stock alert auto-resolves when stock recovers', n, 0);

  r := public.create_reservation(l.id, cust, 20, 6, 'USD', now() + interval '5 days');
  r := public.set_reservation_terms(r.id, current_date + 30, 'Pago 30 días');
  perform pg_temp.eq('agreed delivery date stored separately from expiry', (r.agreed_delivery_date - current_date), 30);
  perform pg_temp.expect_fail(format('select public.set_reservation_terms(%L, %L, null)', r.id, current_date - 5), '%antes de la reserva%');

  perform public.log_moisture(l.id, 9.2);
  select count(*) into n from public.alerts where lot_id = l.id and kind = 'humedad';
  perform pg_temp.eq('moisture below configured minimum raises alert', n, 1);
  perform public.log_moisture(l.id, 11);
  select count(*) into n from public.alerts where lot_id = l.id and kind = 'humedad';
  perform pg_temp.eq('moisture inside range raises no alert', n, 1);

  perform public.set_lot_location(l.id, 'Bodega 2');
  select count(*) into n from public.audit_log where entity_id = l.id::text and action = 'location';
  perform pg_temp.eq('location change audited', n, 1);

  perform pg_temp.as_user(cons);
  perform pg_temp.expect_fail(format('select public.set_reservation_terms(%L, null, null)', r.id), '%ermiso%');
  perform pg_temp.expect_fail(format('select public.resolve_alert(%L)', (select id from public.alerts where lot_id = l.id limit 1)), '%ermiso%');
  perform pg_temp.as_user(admin);
  perform public.resolve_alert((select id from public.alerts where lot_id = l.id and kind = 'humedad'));
  select count(*) into n from public.alerts where lot_id = l.id and kind = 'humedad' and resolved_at is not null and resolved_by = admin;
  perform pg_temp.eq('admin resolves alert with actor recorded', n, 1);
  perform pg_temp.as_owner();
end $$;
rollback;
