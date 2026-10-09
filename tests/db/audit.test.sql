-- Independent-audit fixes (migration 0006). Rolls back.
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

insert into auth.users (id, email) select u::uuid, u || '@audit.local' from unnest(array[
  '12000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000002',
  '22000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000002']) u;
insert into public.organizations (id, name) values
  ('02000000-0000-0000-0000-0000000000a1', 'Audit A'), ('02000000-0000-0000-0000-0000000000b1', 'Audit B');
insert into public.memberships (organization_id, user_id, role) values
  ('02000000-0000-0000-0000-0000000000a1', '12000000-0000-0000-0000-000000000001', 'administrador'),
  ('02000000-0000-0000-0000-0000000000a1', '12000000-0000-0000-0000-000000000002', 'comercial'),
  ('02000000-0000-0000-0000-0000000000b1', '22000000-0000-0000-0000-000000000001', 'administrador'),
  ('02000000-0000-0000-0000-0000000000b1', '22000000-0000-0000-0000-000000000002', 'consulta');
-- legacy global admin mirror for B's admin: must NOT grant cross-org visibility any more
insert into public.user_roles (user_id, role) values ('22000000-0000-0000-0000-000000000001', 'administrador');
insert into public.customers (id, organization_id, name) values ('32000000-0000-0000-0000-000000000001', '02000000-0000-0000-0000-0000000000a1', 'Tostador');

do $$
declare
  A uuid := '02000000-0000-0000-0000-0000000000a1';
  admin uuid := '12000000-0000-0000-0000-000000000001'; com uuid := '12000000-0000-0000-0000-000000000002';
  adminB uuid := '22000000-0000-0000-0000-000000000001'; consB uuid := '22000000-0000-0000-0000-000000000002';
  cust uuid := '32000000-0000-0000-0000-000000000001';
  l public.lots; l2 public.lots; r public.reservations; r2 public.reservations; tok text; pub jsonb; h jsonb;
begin
  -- 1. Idempotency: same key + same payload → same row; different payload/actor → rejected
  perform pg_temp.as_user(admin);
  l := public.create_lot(A, 'Idem', 50, _op_key => 'key-create-lot-1');
  l2 := public.create_lot(A, 'Idem', 50, _op_key => 'key-create-lot-1');
  perform pg_temp.is('create_lot same key+payload returns same lot', l2.id::text, l.id::text);
  perform pg_temp.expect_fail(format('select public.create_lot(%L, %L, 60, _op_key => %L)', A, 'Idem', 'key-create-lot-1'), '%datos distintos%');
  perform pg_temp.expect_fail(format('select public.create_lot(%L, %L, 50, _op_key => %L)', A, 'Otro', 'key-create-lot-1'), '%datos distintos%');
  perform pg_temp.eq('only one lot created for the key', (select count(*) from public.lots where organization_id = A and friendly_name = 'Idem'), 1);
  perform pg_temp.as_user(com);
  perform pg_temp.expect_fail(format('select public.create_lot(%L, %L, 50, _op_key => %L)', A, 'Idem', 'key-create-lot-1'), '%otro usuario%');

  perform pg_temp.as_user(admin);
  l := public.release_lot_for_sale(l.id, 'listo');
  perform pg_temp.as_user(com);
  r := public.create_reservation(l.id, cust, 10, 5, 'USD', _op_key => 'key-res-1');
  r2 := public.create_reservation(l.id, cust, 10, 5, 'USD', _op_key => 'key-res-1');
  perform pg_temp.is('reservation retry same payload', r2.id::text, r.id::text);
  perform pg_temp.expect_fail(format('select public.create_reservation(%L,%L,12,5,%L,_op_key=>%L)', l.id, cust, 'USD', 'key-res-1'), '%datos distintos%');
  perform pg_temp.expect_fail(format('select public.create_reservation(%L,%L,10,6,%L,_op_key=>%L)', l.id, cust, 'USD', 'key-res-1'), '%datos distintos%');
  perform pg_temp.eq('reserved once', (select qty_reserved_kg from public.lots where id = l.id), 10);
  perform public.deliver_reservation(r.id, 'ok', 'key-deliver-1');
  perform public.deliver_reservation(r.id, 'ok', 'key-deliver-1');
  perform pg_temp.expect_fail(format('select public.deliver_reservation(%L, %L, %L)', r.id, 'otra nota', 'key-deliver-1'), '%datos distintos%');
  perform pg_temp.eq('delivered once (sale movements)', (select count(*) from public.stock_movements where reference_id = r.id and movement_type = 'venta'), 1);
  perform pg_temp.eq('stock reduced once', (select qty_current_kg from public.lots where id = l.id), 40);

  perform pg_temp.as_user(admin);
  h := public.register_harvest(A, '{"kind":"recibo","harvest_date":"2026-01-10","qty":20,"uom":"kg"}'::jsonb, null, 'Cosecha idem', 'key-harvest-1');
  perform pg_temp.is('harvest retry same payload', (public.register_harvest(A, '{"kind":"recibo","harvest_date":"2026-01-10","qty":20,"uom":"kg"}'::jsonb, null, 'Cosecha idem', 'key-harvest-1'))->>'lot_id', h->>'lot_id');
  perform pg_temp.expect_fail(format('select public.register_harvest(%L, %L::jsonb, null, %L, %L)', A,
    '{"kind":"recibo","harvest_date":"2026-01-10","qty":25,"uom":"kg"}', 'Cosecha idem', 'key-harvest-1'), '%datos distintos%');

  -- 3. Expiry: past dates rejected; expired reservations cannot be confirmed/delivered
  perform pg_temp.as_user(com);
  perform pg_temp.expect_fail(format('select public.create_reservation(%L,%L,5,null,null,%L)', l.id, cust, now() - interval '1 minute'), '%vencimiento ya pasó%');
  r := public.create_reservation(l.id, cust, 5, null, null, now() + interval '1 day');
  r2 := public.create_reservation(l.id, cust, 5, null, null, now() + interval '1 day');
  perform pg_temp.as_owner();
  update public.reservations set expires_at = now() - interval '1 hour' where id in (r.id, r2.id);
  perform pg_temp.as_user(com);
  perform pg_temp.expect_fail(format('select public.confirm_reservation(%L)', r.id), '%venció%');
  perform pg_temp.expect_fail(format('select public.deliver_reservation(%L)', r2.id), '%venció%');
  perform pg_temp.is('expired reservation still reservada (no partial state)', (select status from public.reservations where id = r2.id), 'reservada');
  perform pg_temp.eq('expired kg still held until expiry job', (select qty_reserved_kg from public.lots where id = l.id), 10);
  perform pg_temp.eq('expire releases both once', public.expire_reservations(A), 2);
  perform pg_temp.eq('second expire releases nothing', public.expire_reservations(A), 0);
  perform pg_temp.eq('reserved back to 0', (select qty_reserved_kg from public.lots where id = l.id), 0);

  -- 2. exported_at only when declared
  perform pg_temp.as_user(admin);
  select public_token into tok from public.publish_lot(l.id, true, 'Historia', 'Floral');
  perform pg_temp.as_anon();
  pub := public.public_lot_view(tok);
  perform pg_temp.is('exported_at null when undeclared', pub->>'exported_at', null);
  perform pg_temp.is('generated_at present', (pub->>'generated_at' is not null)::text, 'true');
  perform pg_temp.as_user(admin);
  perform pg_temp.expect_fail(format('select public.declare_lot_export(%L, %L)', l.id, now() + interval '2 days'), '%futura%');
  perform public.declare_lot_export(l.id, '2026-03-01T12:00:00Z');
  perform pg_temp.as_anon();
  pub := public.public_lot_view(tok);
  perform pg_temp.is('exported_at = declared date', (pub->>'exported_at')::timestamptz::text, '2026-03-01 12:00:00+00');
  perform pg_temp.as_user(consB);
  perform pg_temp.expect_fail(format('select public.declare_lot_export(%L, now())', l.id), '%Permiso denegado%');

  -- 4. profiles / user_roles visibility
  perform pg_temp.as_user(adminB);
  perform pg_temp.eq('global-admin mirror of org B sees no org A profiles',
    (select count(*) from public.profiles where id in (admin, com)), 0);
  perform pg_temp.eq('org B admin sees own team profiles', (select count(*) from public.profiles where id in (adminB, consB)), 2);
  perform pg_temp.eq('org B admin sees no org A roles', (select count(*) from public.user_roles where user_id in (admin, com)), 0);
  perform pg_temp.as_user(consB);
  perform pg_temp.eq('non-admin sees only own profile', (select count(*) from public.profiles where id in (adminB, consB)), 1);
  perform pg_temp.as_user(admin);
  perform pg_temp.eq('org A admin sees own team', (select count(*) from public.profiles where id in (admin, com)), 2);
  perform pg_temp.eq('org A admin does not see org B', (select count(*) from public.profiles where id in (adminB, consB)), 0);
end $$;

\echo 'ALL AUDIT TESTS PASSED'
rollback;
