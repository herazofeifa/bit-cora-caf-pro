-- Evaluation spaces (migration 0007). Rolls back.
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

insert into auth.users (id, email) select u::uuid, u || '@eval.local' from unnest(array[
  '13000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000002','13000000-0000-0000-0000-000000000003']) u;
insert into public.organizations (id, name) values ('03000000-0000-0000-0000-0000000000a1', 'Original');
insert into public.memberships (organization_id, user_id, role) values
  ('03000000-0000-0000-0000-0000000000a1', '13000000-0000-0000-0000-000000000001', 'administrador'),
  ('03000000-0000-0000-0000-0000000000a1', '13000000-0000-0000-0000-000000000003', 'comercial');
insert into public.customers (organization_id, name) values ('03000000-0000-0000-0000-0000000000a1', 'Cliente real');

do $$
declare
  SRC uuid := '03000000-0000-0000-0000-0000000000a1';
  author uuid := '13000000-0000-0000-0000-000000000001'; ev uuid := '13000000-0000-0000-0000-000000000002';
  com uuid := '13000000-0000-0000-0000-000000000003';
  res jsonb; res2 jsonb; BL uuid; SA uuid; n numeric; t text; l public.lots; pub jsonb;
begin
  perform pg_temp.as_user(com);
  perform pg_temp.expect_fail(format('select public.provision_evaluation(%L)', SRC), '%Permiso denegado%');
  perform pg_temp.as_user(author);
  res := public.provision_evaluation(SRC, ev);
  BL := (res->>'blank_org')::uuid; SA := (res->>'sample_org')::uuid;
  perform pg_temp.is('created first time', res->>'created', 'true');
  res2 := public.provision_evaluation(SRC, ev);
  perform pg_temp.is('idempotent: same blank org', res2->>'blank_org', BL::text);
  perform pg_temp.is('idempotent: not recreated', res2->>'created', 'false');
  perform pg_temp.eq('exactly two evaluation orgs', (select count(*) from public.organizations where eval_kind is not null), 2);
  perform pg_temp.expect_fail(format('select public.provision_evaluation(%L, %L)', SRC, com), '%Ya existe%');
  perform pg_temp.eq('author not member of eval orgs', (select count(*) from public.memberships where user_id = author and organization_id in (BL, SA)), 0);

  perform pg_temp.as_user(ev);
  perform pg_temp.eq('evaluator sees exactly 2 environments', (select count(*) from public.my_memberships()), 2);
  perform pg_temp.eq('evaluator: zero original customers', (select count(*) from public.customers where organization_id = SRC), 0);
  perform pg_temp.eq('evaluator: no original org row', (select count(*) from public.organizations where id = SRC), 0);
  perform pg_temp.eq('evaluator: sees no original team profiles', (select count(*) from public.profiles where id in (author, com)), 0);
  perform pg_temp.expect_fail(format('select public.set_member_role(%L,%L,%L)', SA, ev, 'consulta'), '%no permiten gestionar%');
  perform pg_temp.expect_fail('select public.create_demo_environment()', '%Permiso denegado%');
  perform pg_temp.expect_fail(format('select public.provision_evaluation(%L)', SA), '%Permiso denegado%');

  -- Blank: zero operations, base config present
  perform pg_temp.eq('blank: 0 harvests', (select count(*) from public.harvest_tickets where organization_id = BL), 0);
  perform pg_temp.eq('blank: 0 lots', (select count(*) from public.lots where organization_id = BL), 0);
  perform pg_temp.eq('blank: 0 movements', (select count(*) from public.stock_movements where organization_id = BL), 0);
  perform pg_temp.eq('blank: 0 phases', (select count(*) from public.process_phases where organization_id = BL), 0);
  perform pg_temp.eq('blank: 0 customers', (select count(*) from public.customers where organization_id = BL), 0);
  perform pg_temp.eq('blank: 0 reservations', (select count(*) from public.reservations where organization_id = BL), 0);
  perform pg_temp.eq('blank: 0 quality samples', (select count(*) from public.quality_samples where organization_id = BL), 0);
  perform pg_temp.eq('blank: 0 farms', (select count(*) from public.farms where organization_id = BL), 0);
  perform pg_temp.eq('blank: 4 templates', (select count(*) from public.process_templates where organization_id = BL), 4);
  perform pg_temp.eq('blank: 3 units', (select count(*) from public.units where organization_id = BL), 3);

  -- Sample: coverage
  perform pg_temp.eq('sample: harvest tickets', (select count(*) from public.harvest_tickets where organization_id = SA), 7);
  perform pg_temp.eq('sample: every reservation status present',
    (select count(distinct status) from public.reservations where organization_id = SA), 5);
  perform pg_temp.eq('sample: USD and CRC', (select count(distinct currency) from public.reservations where organization_id = SA), 2);
  perform pg_temp.eq('sample: split links', (select count(*) from public.lot_links l join public.lots x on x.id = l.child_lot_id where x.organization_id = SA and l.kind = 'split'), 2);
  perform pg_temp.eq('sample: merge links', (select count(*) from public.lot_links l join public.lots x on x.id = l.child_lot_id where x.organization_id = SA and l.kind = 'merge'), 2);
  perform pg_temp.is('sample: has quality-blocked lot', (select bool_or(commercial_state = 'bloqueado_calidad')::text from public.lots where organization_id = SA), 'true');
  perform pg_temp.is('sample: has in-process lot', (select bool_or(commercial_state = 'en_proceso')::text from public.lots where organization_id = SA), 'true');
  perform pg_temp.eq('sample: out-of-range alerts', (select count(*) from public.alerts where organization_id = SA) >= 2 and true, 1);
  perform pg_temp.eq('sample: overdue process', (select count(*) from public.overdue_phases(SA) where elapsed_days > 20), 1);
  perform pg_temp.is('sample: automatic waste from weight difference', (select (count(*) >= 5)::text from public.waste_logs where organization_id = SA), 'true');
  perform pg_temp.eq('sample: sacks', (select count(*) from public.sacks where organization_id = SA), 2);
  perform pg_temp.eq('sample: public lots', (select count(*) from public.lot_public_profiles where organization_id = SA and is_public), 1);
  perform pg_temp.eq('sample: contract never public', (select count(*) from public.files where organization_id = SA and kind = 'contract' and public_selected), 0);
  -- balances: every lot satisfies current = initial + entries - exits from its movements, never negative
  for l in select * from public.lots where organization_id = SA loop
    if l.qty_current_kg < 0 or l.qty_reserved_kg < 0 or l.qty_committed_kg < 0 or l.qty_free_kg < 0 then
      raise exception 'FAIL negative balance in %', l.lot_code; end if;
    n := (select coalesce(sum(qty_kg),0) from public.reservations where lot_id = l.id and status = 'reservada');
    if n <> l.qty_reserved_kg then raise exception 'FAIL reserved mismatch % (% vs %)', l.lot_code, n, l.qty_reserved_kg; end if;
    n := (select coalesce(sum(qty_kg),0) from public.reservations where lot_id = l.id and status = 'confirmada');
    if n <> l.qty_committed_kg then raise exception 'FAIL committed mismatch %', l.lot_code; end if;
    n := (select coalesce(sum(qty_kg),0) from public.reservations where lot_id = l.id and status = 'entregada');
    if n <> l.qty_sold_kg then raise exception 'FAIL sold mismatch %', l.lot_code; end if;
  end loop;
  raise notice 'ok - sample balances: reserved/committed/sold match reservations, no negatives';
  select * into l from public.lots where organization_id = SA and friendly_name = 'Caturra lavado · exportación';
  perform pg_temp.eq('A1 current = 120 - 30 sold', l.qty_current_kg, 90);
  perform pg_temp.eq('A1 reserved (active only)', l.qty_reserved_kg, 15);
  perform pg_temp.eq('A1 committed', l.qty_committed_kg, 25);
  perform pg_temp.eq('A1 free', l.qty_free_kg, 50);
  perform pg_temp.eq('washed lot weight chain 500→210 (split 120+90)',
    (select qty_initial_kg from public.lots where organization_id = SA and friendly_name = 'Caturra lavado'), 500);
  perform pg_temp.eq('washed parent emptied by split', (select qty_current_kg from public.lots where organization_id = SA and friendly_name = 'Caturra lavado'), 0);
  perform pg_temp.eq('Geisha natural received 300 + 8×12.5', (select qty_initial_kg from public.lots where organization_id = SA and friendly_name = 'Geisha natural'), 400);
  perform pg_temp.eq('blend = 120 + 80', (select qty_initial_kg from public.lots where organization_id = SA and friendly_name = 'Blend Tarrazú-Dota'), 200);
  perform pg_temp.eq('weighted USD price per delivered kg', (select weighted_price_per_kg from public.sales_summary(SA, now() - interval '1 year', now() + interval '1 day') where currency = 'USD'), 6.8);
  perform pg_temp.eq('weighted CRC price per delivered kg', (select weighted_price_per_kg from public.sales_summary(SA, now() - interval '1 year', now() + interval '1 day') where currency = 'CRC'), 4000);

  -- Public page of A1 works anonymously with declared export and no private data
  select public_token into t from public.lot_public_profiles where organization_id = SA and is_public;
  perform pg_temp.as_anon();
  pub := public.public_lot_view(t);
  perform pg_temp.is('public sample page has exported_at', (pub->>'exported_at' is not null)::text, 'true');
  perform pg_temp.is('public sample page hides contract', (pub->'files')::text like '%contract%' and true or false, 'false');
  perform pg_temp.is('public page has no customers/prices', (pub::text ~* 'Nordic|precio|price')::text, 'false');

  -- evaluator can operate in both spaces
  perform pg_temp.as_user(ev);
  l := public.create_lot(BL, 'Mi primer lote', 50);
  perform pg_temp.eq('evaluator creates lot in blank', (select count(*) from public.lots where organization_id = BL), 1);
  perform pg_temp.eq('blank lot does not leak into sample', (select count(*) from public.lots where organization_id = SA and friendly_name = 'Mi primer lote'), 0);
  perform pg_temp.expect_fail(format('select public.create_lot(%L, %L, 10)', SRC, 'x'), '%Permiso denegado%');
end $$;

\echo 'ALL EVALUATION TESTS PASSED'
rollback;
