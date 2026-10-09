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
  perform pg_temp.expect_fail(format('select public.create_reservation(%L,%L,1,null,null,null,null,%L,%L)', l.id, custA, 'kg', 'op-del-0001'), '%otra acción%');

  -- FAIL #4 (reported): references from another organization are rejected everywhere
  perform pg_temp.as_user(admin);
  perform pg_temp.expect_fail(format('select public.create_lot(%L,%L,10,%L)', A, 'x', farmB), '%Referencia inválida%');
  perform pg_temp.expect_fail(format('select public.create_lot(%L,%L,10,%L,%L)', A, 'x', farmA, gen_random_uuid()), '%Referencia inválida%');
  perform pg_temp.expect_fail(format('select public.register_harvest(%L,%L)', A, jsonb_build_object('farm_id', farmB, 'qty', 5, 'harvest_date', current_date)), '%Referencia inválida%');
  perform pg_temp.as_owner();
  perform pg_temp.expect_fail(format('insert into public.lots (organization_id, lot_code, friendly_name, farm_id, qty_initial_kg, qty_current_kg) values (%L,%L,%L,%L,1,1)', A, 'X-1', 'x', farmB), '%no pertenece%');
  perform pg_temp.expect_fail(format('insert into public.reservations (organization_id, lot_id, customer_id, qty_kg) values (%L,%L,%L,1)', A, l.id, custB), '%no pertenece%');

  -- Lot creation idempotent by key
  perform pg_temp.as_user(admin);
  l := public.create_lot(A, 'Idem', 10, null, null, '', 'lavado', 'cereza', null, 'op-lot-0001');
  l2 := public.create_lot(A, 'Idem', 10, null, null, '', 'lavado', 'cereza', null, 'op-lot-0001');
  perform pg_temp.is('create_lot op key returns same lot', l2.id::text, l.id::text);
  perform pg_temp.eq('create_lot op key: one entry movement', (select count(*) from public.stock_movements where lot_id = l.id and movement_type = 'entrada'), 1);

  -- Harvest: ticket + new lot in one transaction, unit conversion, workers
  h := public.register_harvest(A, jsonb_build_object('farm_id', farmA, 'parcel_id', parcelA, 'variety', 'Geisha', 'harvest_date', current_date,
    'qty', 40, 'uom', 'cajuela', 'season', '2025-2026', 'cut_type', 'corte', 'workers', '["Ana","Luis"]', 'responsible', 'Carlos',
    'initial_quality', 'madura'), null, 'Geisha', 'op-harv-0001');
  perform pg_temp.eq('harvest kg = 40 cajuelas × 12.5', (h->>'qty_kg')::numeric, 500);
  perform pg_temp.eq('harvest worker count derived', (select worker_count from public.harvest_tickets where id = (h->>'ticket_id')::uuid), 2);
  perform pg_temp.is('ticket linked to lot', (select lot_id::text from public.harvest_tickets where id = (h->>'ticket_id')::uuid), h->>'lot_id');
  h2 := public.register_harvest(A, jsonb_build_object('farm_id', farmA, 'qty', 40, 'uom', 'cajuela', 'harvest_date', current_date), null, 'Geisha', 'op-harv-0001');
  perform pg_temp.is('harvest op key: same result', h2->>'ticket_id', h->>'ticket_id');
  perform pg_temp.eq('harvest op key: one ticket', (select count(*) from public.harvest_tickets where organization_id = A), 1);
  -- add to existing lot
  h2 := public.register_harvest(A, jsonb_build_object('farm_id', farmA, 'qty', 100, 'uom', 'kg', 'harvest_date', current_date), (h->>'lot_id')::uuid);
  perform pg_temp.eq('existing lot receives the intake', (select qty_current_kg from public.lots where id = (h->>'lot_id')::uuid), 600);
  perform pg_temp.expect_fail(format('select public.register_harvest(%L,%L)', A, jsonb_build_object('farm_id', farmA, 'qty', 3, 'uom', 'saco', 'harvest_date', current_date)), '%Configure el peso%');
  perform pg_temp.expect_fail(format('select public.register_harvest(%L,%L)', A, jsonb_build_object('farm_id', farmA, 'qty', 'Infinity', 'harvest_date', current_date)), '%inválida%');
  perform pg_temp.eq('failed harvests leave no orphan ticket', (select count(*) from public.harvest_tickets where organization_id = A), 2);

  -- Process: template phase with ranges, alert, close by measured weight → automatic waste
  select * into tpl from public.process_templates where organization_id = A and process_type = 'lavado';
  ph := public.start_phase((h->>'lot_id')::uuid, 'Fermentación', tpl.id, 'Fermentación');
  perform pg_temp.expect_fail(format('select public.start_phase(%L,%L)', h->>'lot_id', 'Otra'), '%fase en curso%');
  perform public.log_phase_variable(ph.id, 'ph', 4.5);
  perform public.log_phase_variable(ph.id, 'temperatura', 33);
  perform pg_temp.expect_fail(format('select public.log_phase_variable(%L,%L,%L)', ph.id, 'ph', 'NaN'), '%inválido%');
  perform pg_temp.eq('out-of-range creates one alert', (select count(*) from public.alerts where phase_id = ph.id), 1);
  perform pg_temp.expect_fail(format('select public.close_phase(%L, 700)', ph.id), '%supera el peso actual%');
  perform public.close_phase(ph.id, 560, 'fermentado', null, 'op-close-0001');
  perform public.close_phase(ph.id, 560, 'fermentado', null, 'op-close-0001');
  perform pg_temp.eq('close: waste = measured difference', (select sum(qty_kg) from public.waste_logs where lot_id = (h->>'lot_id')::uuid), 40);
  perform pg_temp.eq('close: lot weight = measured', (select qty_current_kg from public.lots where id = (h->>'lot_id')::uuid), 560);
  perform pg_temp.is('close: physical state', (select physical_state from public.lots where id = (h->>'lot_id')::uuid), 'fermentado');
  perform pg_temp.expect_fail(format('select public.close_phase(%L, 500)', ph.id), '%ya está cerrada%');
  -- templates are versioned
  tpl2 := public.save_process_template(A, tpl.id, 'Lavado', 'lavado', 'v2', '[{"name":"Fermentación","variables":[{"key":"ph","min":4,"max":5}]}]');
  perform pg_temp.eq('template version incremented', tpl2.version, 2);
  perform pg_temp.is('old version inactive', (select active::text from public.process_templates where id = tpl.id), 'false');
  -- overdue (>20 days fermenting)
  ph := public.start_phase((h->>'lot_id')::uuid, 'Fermentación larga', null, null, 60);
  perform pg_temp.as_owner();
  update public.process_phases set started_at = now() - interval '21 days' where id = ph.id;
  perform pg_temp.as_user(admin);
  perform pg_temp.eq('overdue phases listed', (select count(*) from public.overdue_phases(A)), 1);

  -- consulta cannot write new operations
  perform pg_temp.as_user(cons);
  perform pg_temp.expect_fail(format('select public.register_harvest(%L,%L)', A, jsonb_build_object('farm_id', farmA, 'qty', 1, 'harvest_date', current_date)), '%Permiso denegado%');
  perform pg_temp.expect_fail(format('select public.close_phase(%L, 1)', ph.id), '%Permiso denegado%');
  perform pg_temp.expect_fail(format('insert into public.process_phases (organization_id, lot_id, name) values (%L,%L,%L)', A, h->>'lot_id', 'x'), '%permission denied%');

  -- Public QR: private and unknown are indistinguishable (NULL → 404); published shows limited projection
  perform pg_temp.as_user(com);
  select public_token into tok from public.publish_lot((h->>'lot_id')::uuid, false);
  perform pg_temp.as_anon();
  perform pg_temp.is('anon: unpublished lot → null', public.public_lot_view(tok)::text, null);
  perform pg_temp.is('anon: unknown token → null', public.public_lot_view(md5('nope'))::text, null);
  perform pg_temp.expect_fail('select count(*) from public.lots', '%permission denied%');
  perform pg_temp.as_user(com);
  perform public.publish_lot((h->>'lot_id')::uuid, true, 'Historia', 'Floral');
  perform pg_temp.as_anon();
  pub := public.public_lot_view(tok);
  perform pg_temp.is('anon: published lot code', pub->>'lot_code', (select lot_code from public.lots where id = (h->>'lot_id')::uuid));
  perform pg_temp.is('anon: farm altitude', pub->'farm'->>'altitude_m', '1600');
  if pub ? 'qty_current_kg' or pub::text ilike '%Tostador%' or pub::text ilike '%reserv%' then raise exception 'FAIL: private data in public view'; end if;
  raise notice 'ok - public view has no stock/customer/reservation data';
  -- sacks
  perform pg_temp.as_user(com);
  select * into s from public.create_sacks((h->>'lot_id')::uuid, 3, 46) limit 1;
  perform pg_temp.eq('3 sacks created', (select count(*) from public.sacks where lot_id = (h->>'lot_id')::uuid), 3);
  perform pg_temp.expect_fail(format('select public.create_sacks(%L, 20, 46)', h->>'lot_id'), '%más kg%');
  perform pg_temp.as_anon();
  perform pg_temp.eq('anon: sack page shows its lot', (public.public_sack_view(s.sack_token)->'sack'->>'seq')::numeric, 1);
  perform pg_temp.as_user(com);
  perform public.publish_lot((h->>'lot_id')::uuid, false);
  perform pg_temp.as_anon();
  perform pg_temp.is('anon: sack of unpublished lot → null', public.public_sack_view(s.sack_token)::text, null);
  -- cross-org: org B cannot publish or read A's lots
  perform pg_temp.as_user(adminB);
  perform pg_temp.expect_fail(format('select public.publish_lot(%L, true)', h->>'lot_id'), '%Permiso denegado%');
  perform pg_temp.eq('org B sees no A sacks', (select count(*) from public.sacks where organization_id = A), 0);
  perform pg_temp.eq('org B sales summary of A is empty', (select count(*) from public.sales_summary(A, now() - interval '1 year', now() + interval '1 day')), 0);

  -- Weighted price: (60×6 + 40×8) / 100 = 6.8 USD/kg
  perform pg_temp.as_user(com);
  perform pg_temp.eq('weighted price per delivered kg', (select weighted_price_per_kg from public.sales_summary(A, now() - interval '1 day', now() + interval '1 day') where currency = 'USD'), 6.8);

  -- Report snapshots: expiring, revocable
  sh := public.publish_report_snapshot(A, 'Resumen', '{"kg": 100}', 7);
  perform pg_temp.as_anon();
  perform pg_temp.is('anon: snapshot visible', public.public_report_snapshot(sh.token)->>'title', 'Resumen');
  perform pg_temp.as_user(com);
  perform public.revoke_report_snapshot(sh.id);
  perform pg_temp.as_anon();
  perform pg_temp.is('anon: revoked snapshot → null', public.public_report_snapshot(sh.token)::text, null);

  -- Files: contracts can never be public; path must be inside the org folder
  perform pg_temp.as_user(com);
  perform pg_temp.expect_fail(format('insert into public.files (organization_id, kind, title, storage_path, mime_type, size_bytes, public_selected, uploaded_by) values (%L,%L,%L,%L,%L,10,true,%L)', A, 'contract', 'c', A || '/c.pdf', 'application/pdf', com), '%files_contract_never_public%');
  perform pg_temp.expect_fail(format('insert into public.files (organization_id, kind, title, storage_path, mime_type, size_bytes, uploaded_by) values (%L,%L,%L,%L,%L,10,%L)', A, 'photo', 'p', B || '/p.jpg', 'image/jpeg', com), '%files_path_in_org%');
  perform pg_temp.expect_fail(format('insert into public.files (organization_id, kind, title, storage_path, mime_type, size_bytes, uploaded_by) values (%L,%L,%L,%L,%L,%s,%L)', A, 'photo', 'p', A || '/p.exe', 'application/x-msdownload', 10, com), '%mime_type%');
  insert into public.files (organization_id, kind, title, storage_path, mime_type, size_bytes, uploaded_by) values (A, 'photo', 'Secado', A || '/f/1.jpg', 'image/jpeg', 1000, com);
  perform pg_temp.as_user(adminB);
  perform pg_temp.eq('org B sees no A files', (select count(*) from public.files where organization_id = A), 0);

  -- Demo environment is a separate org and does not touch A
  perform pg_temp.as_user(admin);
  n := (select count(*) from public.lots where organization_id = A);
  perform public.create_demo_environment();
  perform pg_temp.eq('demo leaves org A lots untouched', (select count(*) from public.lots where organization_id = A), n);
  perform pg_temp.eq('demo org created', (select count(*) from public.my_memberships() where is_demo), 1);
  perform pg_temp.as_user(cons);
  perform pg_temp.expect_fail('select public.create_demo_environment()', '%Permiso denegado%');
end $$;

\echo 'ALL CLOSING TESTS PASSED'
rollback;
