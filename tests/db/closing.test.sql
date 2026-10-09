-- Closing-phase tests: the 4 cases reported by the author + new operations. Rolls back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.as_user(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', '{"role":"anon"}', true); perform set_config('role', 'anon', true); end $$;
create function pg_temp.as_owner() returns void language plpgsql as $$
begin perform set_config('role', 'none', true); perform set_config('request.jwt.claims', '', true); end $$;
create function pg_temp.expect_fail(_sql text, _pattern text) returns void language plpgsql as $$
declare failed boolean := false; msg text;
begin
  begin execute _sql; exception when others then failed := true; msg := sqlerrm; end;
  if not failed then raise exception 'FAIL: expected error (%) for: %', _pattern, _sql; end if;
  if msg not ilike _pattern then raise exception 'FAIL: wrong error "%" (expected %) for: %', msg, _pattern, _sql; end if;
  raise notice 'ok - rejected: %', _pattern;
end $$;
create function pg_temp.eq(_label text, _got numeric, _want numeric) returns void language plpgsql as $$
begin
  if _got is distinct from _want then raise exception 'FAIL %: got %, want %', _label, _got, _want; end if;
  raise notice 'ok - %', _label;
end $$;
create function pg_temp.is(_label text, _got text, _want text) returns void language plpgsql as $$
begin
  if _got is distinct from _want then raise exception 'FAIL %: got %, want %', _label, _got, _want; end if;
  raise notice 'ok - %', _label;
end $$;

insert into auth.users (id, email) select u::uuid, u || '@test.local' from unnest(array[
  '11000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000002','11000000-0000-0000-0000-000000000003',
  '21000000-0000-0000-0000-000000000001']) u;
insert into public.organizations (id, name) values
  ('01000000-0000-0000-0000-0000000000a1', 'Close A'), ('01000000-0000-0000-0000-0000000000b1', 'Close B');
insert into public.memberships (organization_id, user_id, role) values
  ('01000000-0000-0000-0000-0000000000a1', '11000000-0000-0000-0000-000000000001', 'administrador'),
  ('01000000-0000-0000-0000-0000000000a1', '11000000-0000-0000-0000-000000000002', 'comercial'),
  ('01000000-0000-0000-0000-0000000000a1', '11000000-0000-0000-0000-000000000003', 'consulta'),
  ('01000000-0000-0000-0000-0000000000b1', '21000000-0000-0000-0000-000000000001', 'administrador');
insert into public.farms (id, organization_id, name, altitude_m, owner_name) values
  ('41000000-0000-0000-0000-000000000001', '01000000-0000-0000-0000-0000000000a1', 'Finca A', 1600, 'Doña A'),
  ('41000000-0000-0000-0000-000000000002', '01000000-0000-0000-0000-0000000000b1', 'Finca B', 1500, 'Don B');
insert into public.parcels (id, organization_id, farm_id, name) values
  ('42000000-0000-0000-0000-000000000001', '01000000-0000-0000-0000-0000000000a1', '41000000-0000-0000-0000-000000000001', 'Parcela A');
insert into public.customers (id, organization_id, name) values
  ('31000000-0000-0000-0000-000000000001', '01000000-0000-0000-0000-0000000000a1', 'Tostador A'),
  ('31000000-0000-0000-0000-000000000002', '01000000-0000-0000-0000-0000000000b1', 'Tostador B');
insert into public.units (organization_id, name, symbol, kg_factor) values ('01000000-0000-0000-0000-0000000000a1', 'Cajuela', 'cajuela', 12.5);
select public._seed_process_templates('01000000-0000-0000-0000-0000000000a1');

do $$
declare
  A uuid := '01000000-0000-0000-0000-0000000000a1'; B uuid := '01000000-0000-0000-0000-0000000000b1';
  admin uuid := '11000000-0000-0000-0000-000000000001'; com uuid := '11000000-0000-0000-0000-000000000002';
  cons uuid := '11000000-0000-0000-0000-000000000003'; adminB uuid := '21000000-0000-0000-0000-000000000001';
  farmA uuid := '41000000-0000-0000-0000-000000000001'; farmB uuid := '41000000-0000-0000-0000-000000000002';
  parcelA uuid := '42000000-0000-0000-0000-000000000001';
  custA uuid := '31000000-0000-0000-0000-000000000001'; custB uuid := '31000000-0000-0000-0000-000000000002';
  l public.lots; l2 public.lots; r public.reservations; r2 public.reservations; h jsonb; h2 jsonb; ph public.process_phases;
  tpl public.process_templates; tpl2 public.process_templates; n int; tok text; pub jsonb; s public.sacks; sh public.report_shares;
begin
  perform pg_temp.as_user(admin);

  -- FAIL #1 (reported): new lot in cherry/in process must not be negotiable
  l := public.create_lot(A, 'Cereza', 100, farmA, parcelA, 'Caturra', 'lavado', 'cereza');
  perform pg_temp.eq('new in-process lot: free = 0', l.qty_free_kg, 0);
  perform pg_temp.eq('new in-process lot: blocked = 100', l.qty_blocked_kg, 100);
  perform pg_temp.is('new lot commercial state', l.commercial_state, 'en_proceso');
  perform pg_temp.as_user(com);
  perform pg_temp.expect_fail(format('select public.create_reservation(%L,%L,1)', l.id, custA), '%no está liberado%');
  perform pg_temp.as_user(admin);
  -- quality approval does not release coffee still in process
  perform public.record_quality(l.id, 'aprobado', 85);
  select * into l from public.lots where id = l.id;
  perform pg_temp.eq('approval keeps in-process coffee blocked', l.qty_free_kg, 0);
  perform pg_temp.is('approval keeps state en_proceso', l.commercial_state, 'en_proceso');
  l := public.release_lot_for_sale(l.id, 'Seco y catado');
  perform pg_temp.eq('explicit release frees coffee', l.qty_free_kg, 100);
  perform pg_temp.is('released state', l.commercial_state, 'disponible');

  -- FAIL #3 (reported): price must be finite with explicit currency/unit
  perform pg_temp.as_user(com);
  perform pg_temp.expect_fail(format('select public.create_reservation(%L,%L,1,%L,%L)', l.id, custA, 'Infinity', 'USD'), '%Precio inválido%');
  perform pg_temp.expect_fail(format('select public.create_reservation(%L,%L,1,%L,%L)', l.id, custA, '-Infinity', 'USD'), '%Precio inválido%');
  perform pg_temp.expect_fail(format('select public.create_reservation(%L,%L,1,%L,%L)', l.id, custA, 'NaN', 'USD'), '%Precio inválido%');
  perform pg_temp.expect_fail(format('select public.create_reservation(%L,%L,1,%L)', l.id, custA, 5), '%moneda%');
  perform pg_temp.expect_fail(format('select public.create_reservation(%L,%L,1,5,%L,null,null,%L)', l.id, custA, 'USD', 'lb'), '%por kg%');
  perform pg_temp.expect_fail(format('select public.create_reservation(%L,%L,1)', l.id, custB), '%Cliente no encontrado%');

  -- derived commercial state stays current
  r := public.create_reservation(l.id, custA, 60, 6.0, 'USD', null, null, 'kg', 'op-res-0001');
  r2 := public.create_reservation(l.id, custA, 60, 6.0, 'USD', null, null, 'kg', 'op-res-0001');
  perform pg_temp.is('reservation op key returns same row', r2.id::text, r.id::text);
  perform pg_temp.eq('reserved counted once', (select qty_reserved_kg from public.lots where id = l.id), 60);
  perform pg_temp.is('state partly reserved = disponible', (select commercial_state from public.lots where id = l.id), 'disponible');
  r2 := public.create_reservation(l.id, custA, 40, 8.0, 'USD');
  perform pg_temp.is('state fully reserved', (select commercial_state from public.lots where id = l.id), 'reservado');
  perform public.confirm_reservation(r.id);
  perform public.confirm_reservation(r2.id);
  perform pg_temp.is('state fully committed', (select commercial_state from public.lots where id = l.id), 'comprometido');

  -- FAIL #2 (reported): delivery rejected atomically while quality-blocked
  perform pg_temp.as_user(admin);
  perform public.record_quality(l.id, 'bloqueado');
  perform pg_temp.as_user(com);
  perform pg_temp.expect_fail(format('select public.deliver_reservation(%L)', r.id), '%bloqueado por calidad%');
  select * into l from public.lots where id = l.id;
  perform pg_temp.eq('blocked delivery keeps physical kg', l.qty_current_kg, 100);
  perform pg_temp.eq('blocked delivery keeps committed kg', l.qty_committed_kg, 100);
  perform pg_temp.is('blocked delivery keeps reservation', (select status from public.reservations where id = r.id), 'confirmada');
  perform pg_temp.as_user(admin);
  perform public.record_quality(l.id, 'aprobado', 86);
  perform pg_temp.as_user(com);
  perform public.deliver_reservation(r.id, null, 'op-del-0001');
  perform public.deliver_reservation(r.id, null, 'op-del-0001'); -- safe repeat
  perform pg_temp.eq('delivery once: current', (select qty_current_kg from public.lots where id = l.id), 40);
  perform pg_temp.eq('delivery once: sale movements', (select count(*) from public.stock_movements where reference_id = r.id and movement_type = 'venta'), 1);
  perform pg_temp.eq('delivery once: audit rows', (select count(*) from public.audit_log where entity_id = r.id::text and action = 'deliver'), 1);
  perform public.deliver_reservation(r2.id);
  perform pg_temp.is('state sold', (select commercial_state from public.lots where id = l.id), 'vendido');
  perform pg_temp.expect_fail(format('select public.deliver_reservation(%L,null,%L)', r2.id, 'op-del-0001'), '%otra acción%'),
    null;
exception when others then raise;
end $$;
