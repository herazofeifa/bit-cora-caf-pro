-- Structured quality data, server-side unit conversion, copilot quota. Rolls back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.as_user(_uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true); perform set_config('role', 'authenticated', true); end $$;
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

insert into auth.users (id, email) values ('15000000-0000-0000-0000-000000000001','u1@qh.local');
insert into public.organizations (id, name) values ('05000000-0000-0000-0000-0000000000a1', 'QH A');
insert into public.memberships (organization_id, user_id, role) values ('05000000-0000-0000-0000-0000000000a1', '15000000-0000-0000-0000-000000000001', 'administrador');
insert into public.farms (id, organization_id, name, country) values ('25000000-0000-0000-0000-000000000001', '05000000-0000-0000-0000-0000000000a1', 'Finca QH', 'Costa Rica');
insert into public.units (organization_id, name, symbol, unit_type, kg_factor, is_configurable) values ('05000000-0000-0000-0000-0000000000a1', 'Cajuela', 'cajuela', 'volumen', 12.5, true);

do $$
declare A uuid := '05000000-0000-0000-0000-0000000000a1'; F uuid := '25000000-0000-0000-0000-000000000001';
  r jsonb; l public.lots; s public.quality_samples; tok text; v jsonb; q jsonb;
begin
  perform pg_temp.as_user('15000000-0000-0000-0000-000000000001');
  -- 3) unit conversion
  r := public.register_harvest(A, jsonb_build_object('qty', 2, 'uom', 'cajuela', 'farm_id', F, 'harvest_date', '2026-10-01'), null, null, 'qh-1');
  perform pg_temp.eq('2 cajuelas use the server factor 12.5 → 25 kg', (r->>'qty_kg')::numeric, 25);
  perform pg_temp.expect_fail(format('select public.register_harvest(%L, %L::jsonb, null, null, %L)', A,
    jsonb_build_object('qty', 2, 'uom', 'cajuela', 'kg_factor', 50, 'farm_id', F, 'harvest_date', '2026-10-01'), 'qh-2'), '%la define la organización%');
  select count(*) into tok from public.harvest_tickets where organization_id = A;
  perform pg_temp.eq('fraudulent factor creates no ticket', tok::numeric, 1);
  r := public.register_harvest(A, jsonb_build_object('qty', 1, 'uom', 'cajuela', 'kg_factor', 12.5, 'farm_id', F, 'harvest_date', '2026-10-01'), null, null, 'qh-3');
  perform pg_temp.eq('matching client factor accepted', (r->>'qty_kg')::numeric, 12.5);
  perform pg_temp.expect_fail(format('select public.register_harvest(%L, %L::jsonb, null, null, %L)', A,
    jsonb_build_object('qty', 1, 'uom', 'lata', 'kg_factor', 9, 'farm_id', F, 'harvest_date', '2026-10-01'), 'qh-4'), '%no está configurada%');

  -- 1) structured quality
  l := public.create_lot(A, 'Q', 100, F, null, 'Geisha', 'lavado', 'verde');
  l := public.record_quality(l.id, 'aprobado', 87.5, '{"sca": {"acidez": 8.25, "cuerpo": 7.75}, "defects": {"primary": 0, "secondary": 3, "description": "quebrados"}, "cupping": "jazmín", "notes": "ok"}');
  select * into s from public.quality_samples where lot_id = l.id;
  perform pg_temp.eq('SCA acidity stored', (s.data->'sca'->>'acidez')::numeric, 8.25);
  perform pg_temp.eq('secondary defects stored', (s.data->'defects'->>'secondary')::numeric, 3);
  perform pg_temp.expect_fail(format('select public.record_quality(%L, %L, 80, %L::jsonb)', l.id, 'aprobado', '{"sca": {"acidez": 11}}'), '%entre 0 y 10%');
  perform pg_temp.expect_fail(format('select public.record_quality(%L, %L, 80, %L::jsonb)', l.id, 'aprobado', '{"sca": {"hack": 5}}'), '%desconocido%');
  perform pg_temp.expect_fail(format('select public.record_quality(%L, %L, 80, %L::jsonb)', l.id, 'aprobado', '{"defects": {"primary": -1}}'), '%enteros%');
  perform pg_temp.expect_fail(format('select public.record_quality(%L, %L, 120, null)', l.id, 'aprobado'), '%entre 0 y 100%');
  insert into public.lot_public_profiles (lot_id, organization_id, is_public) values (l.id, A, true) returning public_token into tok;
  v := public.public_lot_view(tok);
  perform pg_temp.eq('public sheet shows SCA attribute', (v->'quality'->'sca'->>'cuerpo')::numeric, 7.75);
  perform pg_temp.eq('public sheet shows defects', (v->'quality'->'defects'->>'secondary')::numeric, 3);
  update public.lot_public_profiles set visibility = '{"quality": false}' where lot_id = l.id;
  v := public.public_lot_view(tok);
  if v->'quality' is not null and v->'quality' <> 'null'::jsonb then raise exception 'FAIL quality shown when hidden'; end if;
  raise notice 'ok - quality hidden when publication hides it';

  -- 5) copilot quota (admin of a real org: 60/hour)
  for i in 1..60 loop q := public.copilot_take_quota(A); end loop;
  perform pg_temp.eq('60th request allowed', (q->>'used_hour')::numeric, 60);
  q := public.copilot_take_quota(A);
  if (q->>'ok')::boolean then raise exception 'FAIL quota not enforced'; end if;
  raise notice 'ok - 61st request in the hour rejected';
end $$;
rollback;
