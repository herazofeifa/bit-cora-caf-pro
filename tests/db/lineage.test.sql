-- Merge/split guards and inherited provenance (migration lineage_guards). Rolls back.
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

insert into auth.users (id, email) values ('14000000-0000-0000-0000-000000000001','u1@lineage.local');
insert into public.organizations (id, name) values ('04000000-0000-0000-0000-0000000000a1', 'Lineage A');
insert into public.memberships (organization_id, user_id, role) values ('04000000-0000-0000-0000-0000000000a1', '14000000-0000-0000-0000-000000000001', 'administrador');
insert into public.farms (id, organization_id, name, region, country, owner_name) values
  ('24000000-0000-0000-0000-000000000001', '04000000-0000-0000-0000-0000000000a1', 'Finca Norte', 'Tarrazú', 'Costa Rica', 'Ana'),
  ('24000000-0000-0000-0000-000000000002', '04000000-0000-0000-0000-0000000000a1', 'Finca Sur', 'Dota', 'Costa Rica', 'Luis');

do $$
declare A uuid := '04000000-0000-0000-0000-0000000000a1'; F1 uuid := '24000000-0000-0000-0000-000000000001'; F2 uuid := '24000000-0000-0000-0000-000000000002';
  la public.lots; lb public.lots; c public.lots; m public.lots; ph public.process_phases; n int; v jsonb; tok text; kids uuid[];
begin
  perform pg_temp.as_user('14000000-0000-0000-0000-000000000001');
  la := public.create_lot(A, 'Verde A', 20, F1, null, 'Caturra', 'lavado', 'verde');
  lb := public.create_lot(A, 'Húmedo B', 20, F2, null, 'Caturra', 'lavado', 'pergamino_humedo');
  perform pg_temp.expect_fail(format('select public.merge_lots(array[%L,%L]::uuid[], %L)', la.id, lb.id, 'X'), '%mismo estado físico%');
  select count(*) into n from public.lots where organization_id = A; perform pg_temp.eq('rejected merge creates no lot', n, 2);
  select qty_current_kg into n from public.lots where id = la.id; perform pg_temp.eq('rejected merge leaves source untouched', n, 20);

  c := public.create_lot(A, 'Verde C', 30, F2, null, 'Geisha', 'natural', 'verde');
  ph := public.start_phase(c.id, 'Reposo', null, null, null, null);
  perform pg_temp.expect_fail(format('select public.merge_lots(array[%L,%L]::uuid[], %L)', la.id, c.id, 'X'), '%fase abierta%');
  perform pg_temp.expect_fail(format('select public.split_lot(%L, %L::jsonb)', c.id, '[{"qty_kg":10},{"qty_kg":10}]'), '%fase abierta%');
  ph := public.close_phase(ph.id, 30, null, null, null);

  m := public.merge_lots(array[la.id, c.id], 'Blend Norte-Sur');
  perform pg_temp.eq('different variety/process merge allowed with same state', m.qty_current_kg, 50);
  if m.variety <> 'Mezcla' or m.process_type <> 'mezcla' or m.physical_state <> 'verde' then raise exception 'FAIL blend labels %/%/%', m.variety, m.process_type, m.physical_state; end if;
  raise notice 'ok - blend keeps shared state, labels mixed variety/process';

  v := public.lot_lineage(m.id);
  perform pg_temp.eq('internal lineage lists two origins', jsonb_array_length(v->'origins'), 2);
  perform pg_temp.eq('internal lineage inherits source phase', jsonb_array_length(v->'phases'), 1);
  perform pg_temp.eq('internal lineage lists two sources', jsonb_array_length(v->'sources'), 2);

  insert into public.lot_public_profiles (lot_id, organization_id, is_public) values (m.id, A, true) returning public_token into tok;
  v := public.public_lot_view(tok);
  perform pg_temp.eq('public blend shows two origins', jsonb_array_length(v->'origins'), 2);
  if v->'farm' <> 'null'::jsonb and v->>'farm' is not null then raise exception 'FAIL blend attributed to one farm: %', v->'farm'; end if;
  raise notice 'ok - blend not attributed to a single farm';
  perform pg_temp.eq('public blend inherits phases', jsonb_array_length(v->'phases'), 1);
  if v::text ~* '(price|customer|reserv|audit|organization_id|"id")' then raise exception 'FAIL private key in public view: %', v; end if;
  raise notice 'ok - no private keys in public view';

  select array_agg(id) into kids from public.split_lot(c.id, '[{"qty_kg":5},{"qty_kg":5}]');
  insert into public.lot_public_profiles (lot_id, organization_id, is_public, visibility) values (kids[1], A, true, '{"farm": false, "producer": false}') returning public_token into tok;
  v := public.public_lot_view(tok);
  perform pg_temp.eq('split child inherits parent phase publicly', jsonb_array_length(v->'phases'), 1);
  if (v->'phases'->0->>'inherited')::boolean is not true then raise exception 'FAIL inherited flag'; end if;
  if v::text ~ '(Finca Sur|Luis)' then raise exception 'FAIL hidden farm/producer leaked: %', v; end if;
  raise notice 'ok - farm/producer hidden when publication hides them';
end $$;
rollback;
