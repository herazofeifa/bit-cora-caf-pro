-- Database integration tests for the shared operational core.
-- Runs inside one transaction and ROLLS BACK: no data is left behind.
-- LOCAL ONLY: run via tests/db/run-local.sh on a disposable database, never on a real project.
\set ON_ERROR_STOP on
begin;

create function pg_temp.as_user(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_owner() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.expect_fail(_sql text, _pattern text) returns void language plpgsql as $$
declare failed boolean := false; msg text;
begin
  begin execute _sql; exception when others then failed := true; msg := sqlerrm; end;
  if not failed then raise exception 'FAIL: expected error (%) for: %', _pattern, _sql; end if;
  if msg not ilike _pattern then raise exception 'FAIL: wrong error "%" (expected %) for: %', msg, _pattern, _sql; end if;
end $$;
create function pg_temp.eq(_label text, _got numeric, _want numeric) returns void language plpgsql as $$
begin
  if _got is distinct from _want then raise exception 'FAIL %: got %, want %', _label, _got, _want; end if;
  raise notice 'ok - %', _label;
end $$;

-- Fixtures (as table owner). auth.users here is the local stub from bootstrap.sql.
insert into auth.users (id, email) select u::uuid, u || '@test.local' from unnest(array[
  '10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001']) u;
insert into public.organizations (id, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Test A'), ('00000000-0000-0000-0000-0000000000b1', 'Test B');
insert into public.memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', 'administrador'),
  ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000002', 'comercial'),
  ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000003', 'consulta'),
  ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000004', 'encargado_beneficio'),
  ('00000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-000000000001', 'administrador');
insert into public.customers (id, organization_id, name) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'Tostador A');

do $$
declare
  A uuid := '00000000-0000-0000-0000-0000000000a1';
  admin uuid := '10000000-0000-0000-0000-000000000001';
  com uuid := '10000000-0000-0000-0000-000000000002';
  cons uuid := '10000000-0000-0000-0000-000000000003';
  enc uuid := '10000000-0000-0000-0000-000000000004';
  adminB uuid := '20000000-0000-0000-0000-000000000001';
  cust uuid := '30000000-0000-0000-0000-000000000001';
  l public.lots; l2 public.lots; r1 public.reservations; r2 public.reservations; n int; c text; before_kg numeric;
begin
  -- Lot creation: server-generated unique codes
  perform pg_temp.as_user(enc);
  l := public.create_lot(A, 'Lote prueba', 100, null, null, 'Caturra', 'lavado');
  l2 := public.create_lot(A, 'Lote prueba 2', 50, null, null, 'Catuaí', 'lavado');
  if l.lot_code = l2.lot_code then raise exception 'FAIL: duplicate lot code'; end if;
  raise notice 'ok - unique lot codes % / %', l.lot_code, l2.lot_code;
  perform pg_temp.expect_fail(format('select public.create_lot(%L, %L, %L)', A, 'x', 'NaN'), '%inválida%');
  perform pg_temp.expect_fail(format('select public.create_lot(%L, %L, %L)', A, 'x', -5), '%inválida%');

  -- Reservations: overselling rejected, derived availability
  perform pg_temp.as_user(com);
  r1 := public.create_reservation(l.id, cust, 60);
  perform pg_temp.expect_fail(format('select public.create_reservation(%L, %L, 50)', l.id, cust), '%Sobreventa%');
  select * into l from public.lots where id = l.id;
  perform pg_temp.eq('free = current - reserved', l.qty_free_kg, 40);

  -- Confirm moves reserved -> committed, only once
  perform public.confirm_reservation(r1.id);
  select * into l from public.lots where id = l.id;
  perform pg_temp.eq('reserved after confirm', l.qty_reserved_kg, 0);
  perform pg_temp.eq('committed after confirm', l.qty_committed_kg, 60);
  perform pg_temp.expect_fail(format('select public.confirm_reservation(%L)', r1.id), '%no se puede confirmar%');

  -- Cancel releases committed exactly once
  perform public.cancel_reservation(r1.id, 'cliente desistió');
  perform pg_temp.expect_fail(format('select public.cancel_reservation(%L)', r1.id), '%ya está cancelada%');
  select * into l from public.lots where id = l.id;
  perform pg_temp.eq('committed after cancel', l.qty_committed_kg, 0);
  perform pg_temp.eq('free after cancel', l.qty_free_kg, 100);

  -- Deliver: physical decreases once, sale recorded once
  r2 := public.create_reservation(l.id, cust, 30);
  perform public.confirm_reservation(r2.id);
  perform public.deliver_reservation(r2.id);
  perform pg_temp.expect_fail(format('select public.deliver_reservation(%L)', r2.id), '%no se puede entregar%');
  perform pg_temp.expect_fail(format('select public.cancel_reservation(%L)', r2.id), '%ya está entregada%');
  select * into l from public.lots where id = l.id;
  perform pg_temp.eq('current after delivery', l.qty_current_kg, 70);
  perform pg_temp.eq('sold after delivery', l.qty_sold_kg, 30);
  perform pg_temp.eq('committed after delivery', l.qty_committed_kg, 0);
  select count(*) into n from public.stock_movements where reference_id = r2.id and movement_type = 'venta';
  perform pg_temp.eq('single sale movement', n, 1);

  -- Expiration releases once
  r1 := public.create_reservation(l.id, cust, 10, null, null, now() - interval '1 day');
  perform pg_temp.eq('expired count first run', public.expire_reservations(A), 1);
  perform pg_temp.eq('expired count second run', public.expire_reservations(A), 0);
  select * into l from public.lots where id = l.id;
  perform pg_temp.eq('reserved after expiry', l.qty_reserved_kg, 0);

  -- Waste cannot consume reserved coffee
  r1 := public.create_reservation(l.id, cust, 60);
  perform pg_temp.as_user(enc);
  perform pg_temp.expect_fail(format('select public.log_waste(%L, 20, %L, %L)', l.id, 'pulpa', 'test'), '%supera%');
  perform pg_temp.expect_fail(format('select public.log_waste(%L, 5, %L, %L)', l.id, 'pulpa', ' '), '%motivo%');
  perform public.log_waste(l.id, 10, 'pulpa', 'selección');
  select * into l from public.lots where id = l.id;
  perform pg_temp.eq('current after waste', l.qty_current_kg, 60);
  perform pg_temp.eq('reserved intact after waste', l.qty_reserved_kg, 60);

  -- Negative adjustment: justified and within movable is accepted
  perform pg_temp.as_user(com);
  perform public.cancel_reservation(r1.id);
  perform pg_temp.as_user(enc);
  perform pg_temp.expect_fail(format('select public.adjust_inventory(%L, -5, %L)', l.id, ''), '%motivo%');
  perform pg_temp.expect_fail(format('select public.adjust_inventory(%L, %L, %L)', l.id, 'NaN', 'x'), '%inválido%');
  perform public.adjust_inventory(l.id, -5, 'Pesaje de control');
  select * into l from public.lots where id = l.id;
  perform pg_temp.eq('current after negative adjustment', l.qty_current_kg, 55);

  -- Quality block / approval recalculates quantities
  perform public.record_quality(l.id, 'bloqueado');
  select * into l from public.lots where id = l.id;
  perform pg_temp.eq('blocked after quality block', l.qty_blocked_kg, 55);
  perform pg_temp.eq('free after quality block', l.qty_free_kg, 0);
  perform pg_temp.as_user(com);
  perform pg_temp.expect_fail(format('select public.create_reservation(%L, %L, 1)', l.id, cust), '%Sobreventa%');
  perform pg_temp.as_user(enc);
  perform public.record_quality(l.id, 'aprobado', 86);
  select * into l from public.lots where id = l.id;
  perform pg_temp.eq('blocked after approval', l.qty_blocked_kg, 0);

  -- Split / merge: validation and mass conservation
  perform pg_temp.as_user(admin);
  perform pg_temp.expect_fail(format('select public.split_lot(%L, %L)', l.id, '[{"qty_kg":"NaN"},{"qty_kg":1}]'), '%inválida%');
  perform pg_temp.expect_fail(format('select public.split_lot(%L, %L)', l.id, '[{"qty_kg":-1},{"qty_kg":1}]'), '%inválida%');
  perform pg_temp.expect_fail(format('select public.split_lot(%L, %L)', l.id, '[{"qty_kg":50},{"qty_kg":50}]'), '%libres%');
  select sum(qty_current_kg) into before_kg from public.lots where organization_id = A;
  perform public.split_lot(l.id, '[{"qty_kg":20,"name":"A1"},{"qty_kg":15,"name":"A2"}]');
  perform pg_temp.eq('kg conserved after split', (select sum(qty_current_kg) from public.lots where organization_id = A), before_kg);
  perform pg_temp.eq('genealogy rows after split', (select count(*) from public.lot_links where parent_lot_id = l.id), 2);
  perform pg_temp.expect_fail(format('select public.merge_lots(array[%L,%L]::uuid[], %L)', l.id, l.id, 'M'), '%duplicados%');
  perform public.merge_lots(array[l.id, l2.id], 'Mezcla test');
  perform pg_temp.eq('kg conserved after merge', (select sum(qty_current_kg) from public.lots where organization_id = A), before_kg);

  -- Permissions: consulta cannot write
  perform pg_temp.as_user(cons);
  perform pg_temp.expect_fail(format('select public.create_reservation(%L, %L, 1)', l2.id, cust), '%Permiso denegado%');
  perform pg_temp.expect_fail(format('insert into public.customers (organization_id, name) values (%L, %L)', A, 'X'), '%row-level security%');
  perform pg_temp.expect_fail(format('update public.lots set qty_current_kg = 9999 where id = %L', l.id), '%permission denied%');
  perform pg_temp.eq('consulta can read own org lots', case when (select count(*) from public.lots where organization_id = A) > 0 then 1 else 0 end, 1);

  -- Isolation: org B admin sees nothing of A and cannot act on it
  perform pg_temp.as_user(adminB);
  perform pg_temp.eq('org B sees no A lots', (select count(*) from public.lots where organization_id = A), 0);
  perform pg_temp.eq('org B sees no A customers', (select count(*) from public.customers where organization_id = A), 0);
  perform pg_temp.expect_fail(format('select public.create_reservation(%L, %L, 1)', l2.id, cust), '%Permiso denegado%');

  -- Last admin cannot be demoted
  perform pg_temp.as_user(admin);
  perform pg_temp.expect_fail(format('select public.set_member_role(%L, %L, %L)', A, admin, 'consulta'), '%último administrador%');
  perform public.set_member_role(A, com, 'administrador');
  perform public.set_member_role(A, admin, 'consulta');
  raise notice 'ok - admin demoted once another admin exists';

  -- Audit: actor = auth.uid(), append-only
  perform pg_temp.as_owner();
  select count(*) into n from public.audit_log where organization_id = A and entity = 'reservations' and actor_id = com;
  if n = 0 then raise exception 'FAIL: reservation audit without actor'; end if;
  raise notice 'ok - audit rows carry the actor (% rows)', n;
  perform pg_temp.expect_fail(format('update public.audit_log set action = %L where organization_id = %L', 'x', A), '%solo de agregado%');
  perform pg_temp.expect_fail(format('delete from public.audit_log where organization_id = %L', A), '%solo de agregado%');
end $$;

\echo 'ALL DB TESTS PASSED'
rollback;
