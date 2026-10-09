-- 0007: evaluation spaces for the graduation committee.
-- One evaluator account, two persistent organizations isolated from the original one and from each other:
--   eval_kind = 'blank'  → base configuration only (units + process templates), zero operations.
--   eval_kind = 'sample' → fictitious but coherent data generated through the same RPCs the app uses.
-- Provisioning is atomic and idempotent per source organization (advisory lock + unique row).

alter table public.organizations add column if not exists eval_kind text
  check (eval_kind is null or eval_kind in ('blank','sample'));
comment on column public.organizations.eval_kind is 'Evaluation space kind; null for real organizations.';

create table public.evaluation_spaces (
  source_org uuid primary key references public.organizations(id) on delete cascade,
  blank_org uuid not null unique references public.organizations(id) on delete cascade,
  sample_org uuid not null unique references public.organizations(id) on delete cascade,
  evaluator_user uuid unique,
  sample_files jsonb not null default '[]',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
grant select on public.evaluation_spaces to authenticated;
grant all on public.evaluation_spaces to service_role;
alter table public.evaluation_spaces enable row level security;
create policy "source admins read" on public.evaluation_spaces for select to authenticated
  using (public.has_org_role(source_org, '{administrador}'));

create or replace function public.is_real_org_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m join public.organizations o on o.id = m.organization_id
    where m.user_id = auth.uid() and m.active and m.role = 'administrador' and not o.is_demo and o.eval_kind is null)
$$;
revoke execute on function public.is_real_org_admin() from public, anon;
grant execute on function public.is_real_org_admin() to authenticated;

-- Base configuration shared by both spaces.
create or replace function public._seed_eval_base(_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._seed_process_templates(_org);
  insert into public.units (organization_id, name, symbol, unit_type, kg_factor, is_configurable) values
    (_org, 'Kilogramo', 'kg', 'weight', 1, false), (_org, 'Cajuela', 'cajuela', 'volume', 12.5, true), (_org, 'Fanega', 'fanega', 'volume', 250, true);
end $$;

-- Sample data: every operation goes through the business RPCs (balances, genealogy, audit are real).
-- The only direct writes are time shifts (backdating) to simulate elapsed days, as noted inline.
create or replace function public._seed_eval_sample(_org uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f1 uuid; f2 uuid; p1 uuid; p2 uuid; p3 uuid; c_usd uuid; c_crc uuid; c_exp uuid;
  tl uuid; th uuid; tn uuid; ta uuid; h jsonb; ph public.process_phases;
  a uuid; a1 uuid; a2 uuid; b uuid; c uuid; d uuid; e1 uuid; e2 uuid; m public.lots;
  r public.reservations; files jsonb := '[]'; ids uuid[];
begin
  insert into public.farms (organization_id, name, region, country, owner_name, altitude_m, notes) values
    (_org, 'Finca El Mirador (ejemplo)', 'Tarrazú', 'Costa Rica', 'Familia Solís (ficticia)', 1650, 'Datos ficticios de evaluación') returning id into f1;
  insert into public.farms (organization_id, name, region, country, owner_name, altitude_m, notes) values
    (_org, 'Finca Los Robles (ejemplo)', 'Dota', 'Costa Rica', 'Cooperativa ficticia', 1800, 'Datos ficticios de evaluación') returning id into f2;
  insert into public.parcels (organization_id, farm_id, name, variety, altitude_m, area_ha) values
    (_org, f1, 'Parcela Alta', 'Caturra', 1700, 2.5) returning id into p1;
  insert into public.parcels (organization_id, farm_id, name, variety, altitude_m, area_ha) values
    (_org, f1, 'Parcela Quebrada', 'Geisha', 1620, 1.2) returning id into p2;
  insert into public.parcels (organization_id, farm_id, name, variety, altitude_m, area_ha) values
    (_org, f2, 'Parcela Robles', 'Catuaí', 1820, 3.0) returning id into p3;
  insert into public.customers (organization_id, name, type, country, contact_name) values
    (_org, 'Nordic Roasters (ficticio)', 'tostador', 'Noruega', 'Contacto ficticio') returning id into c_usd;
  insert into public.customers (organization_id, name, type, country, contact_name) values
    (_org, 'Cafetería Barva (ficticia)', 'cafeteria', 'Costa Rica', 'Contacto ficticio') returning id into c_crc;
  insert into public.customers (organization_id, name, type, country) values
    (_org, 'Exportadora Pacífico (ficticia)', 'exportador', 'Costa Rica') returning id into c_exp;

  select id into tl from public.process_templates where organization_id = _org and process_type = 'lavado' and active limit 1;
  select id into th from public.process_templates where organization_id = _org and process_type = 'honey' and active limit 1;
  select id into tn from public.process_templates where organization_id = _org and process_type = 'natural' and active limit 1;
  select id into ta from public.process_templates where organization_id = _org and process_type = 'anaerobico' and active limit 1;

  -- A: Caturra lavado, full washed cycle, approved, released, split for sale ----------------
  h := public.register_harvest(_org, jsonb_build_object('farm_id', f1, 'parcel_id', p1, 'variety', 'Caturra',
    'harvest_date', current_date - 45, 'qty', 40, 'uom', 'cajuela', 'season', '2025-2026', 'cut_type', 'corte',
    'workers', '["Ana","Luis","Marta","José"]'::jsonb, 'responsible', 'Encargado ficticio', 'initial_quality', 'madura',
    'notes', 'Jornada de la mañana'), null, 'Caturra lavado');
  a := (h->>'lot_id')::uuid;
  ph := public.start_phase(a, 'Despulpado', tl, 'Despulpado');
  perform public.close_phase(ph.id, 430, 'despulpado', 'Pulpa separada');
  ph := public.start_phase(a, 'Fermentación', tl, 'Fermentación');
  perform public.log_phase_variable(ph.id, 'ph', 4.6);
  perform public.log_phase_variable(ph.id, 'brix', 12);
  perform public.log_phase_variable(ph.id, 'temperatura', 31, null, 'Tanque al sol: fuera de rango');
  perform public.close_phase(ph.id, 425, 'fermentado', null);
  ph := public.start_phase(a, 'Lavado', tl, 'Lavado');
  perform public.close_phase(ph.id, 420, 'pergamino_humedo', null);
  ph := public.start_phase(a, 'Secado', tl, 'Secado');
  perform public.log_phase_variable(ph.id, 'humedad', 11.2);
  perform public.log_moisture(a, 11.2, 'Medidor ficticio', 'Punto de secado');
  perform public.close_phase(ph.id, 210, 'pergamino_seco', 'Secado en patio');
  perform public.record_quality(a, 'aprobado', 86, jsonb_build_object('sca', 86, 'defects', jsonb_build_object('primary', 0, 'secondary', 3),
    'notes', 'Panela, mandarina, cuerpo sedoso', 'water_activity', 0.55));
  perform public.release_lot_for_sale(a, 'Seco, catado y aprobado');
  select array_agg(id order by friendly_name) into ids from (select id, friendly_name from public.split_lot(a,
    '[{"qty_kg":120,"name":"Caturra lavado · exportación"},{"qty_kg":90,"name":"Caturra lavado · local"}]'::jsonb)) s;
  a1 := ids[1]; a2 := ids[2];
  -- reservations on A1: delivered USD, confirmed USD, active CRC, cancelled, expired
  r := public.create_reservation(a1, c_usd, 30, 6.80, 'USD', null, 'Contrato ficticio 001');
  perform public.confirm_reservation(r.id); perform public.deliver_reservation(r.id, 'Entregado en puerto (ficticio)');
  r := public.create_reservation(a1, c_usd, 25, 7.10, 'USD', null, 'Segundo embarque');
  perform public.confirm_reservation(r.id);
  perform public.create_reservation(a1, c_crc, 15, 4200, 'CRC', now() + interval '10 days', 'Reserva activa');
  r := public.create_reservation(a1, c_exp, 10, 6.50, 'USD', now() + interval '5 days');
  perform public.cancel_reservation(r.id, 'Cliente desistió');
  r := public.create_reservation(a1, c_exp, 10, 6.50, 'USD', now() + interval '1 day', 'Reserva que venció');
  update public.reservations set reserved_at = now() - interval '9 days', expires_at = now() - interval '2 days' where id = r.id; -- time shift
  perform public.expire_reservations(_org);
  perform public.create_sacks(a1, 2, 45);
  perform public.publish_lot(a1, true, 'Caturra cultivado a 1700 m en Tarrazú; proceso lavado tradicional. Datos ficticios de evaluación.',
    'Panela, mandarina, cuerpo sedoso', '{"measurements": true, "producer": true}');
  perform public.declare_lot_export(a1, now() - interval '3 days');
  -- A2: local sale in CRC + a handling loss
  r := public.create_reservation(a2, c_crc, 20, 4000, 'CRC');
  perform public.deliver_reservation(r.id, 'Retiro en beneficio');
  perform public.log_waste(a2, 2, 'manipulacion', 'Saco dañado en bodega', 'descarte');

  -- B: Geisha natural, two intakes into the same lot, drying with moisture out of range (alert) ----
  h := public.register_harvest(_org, jsonb_build_object('farm_id', f1, 'parcel_id', p2, 'variety', 'Geisha',
    'harvest_date', current_date - 12, 'qty', 300, 'uom', 'kg', 'season', '2025-2026', 'cut_type', 'corte',
    'worker_count', 3, 'responsible', 'Encargado ficticio', 'initial_quality', 'madura'), null, 'Geisha natural');
  b := (h->>'lot_id')::uuid;
  perform public.register_harvest(_org, jsonb_build_object('farm_id', f1, 'parcel_id', p2, 'variety', 'Geisha',
    'harvest_date', current_date - 11, 'qty', 8, 'uom', 'cajuela', 'season', '2025-2026', 'cut_type', 'pasilla',
    'worker_count', 2, 'responsible', 'Encargado ficticio', 'initial_quality', 'mixta'), b);
  ph := public.start_phase(b, 'Flotación y selección', tn, 'Flotación y selección');
  perform public.close_phase(ph.id, 385, 'cereza', 'Flotes retirados');
  ph := public.start_phase(b, 'Secado', tn, 'Secado');
  perform public.log_phase_variable(ph.id, 'humedad', 18, null, 'Aún húmedo');
  perform public.log_moisture(b, 18, 'Medidor ficticio');

  -- C: Catuaí honey, finished but quality-blocked ------------------------------------------
  h := public.register_harvest(_org, jsonb_build_object('farm_id', f2, 'parcel_id', p3, 'variety', 'Catuaí',
    'harvest_date', current_date - 35, 'qty', 200, 'uom', 'kg', 'season', '2025-2026', 'cut_type', 'corte',
    'worker_count', 2, 'responsible', 'Encargado ficticio', 'initial_quality', 'madura'), null, 'Catuaí honey');
  c := (h->>'lot_id')::uuid;
  ph := public.start_phase(c, 'Despulpado', th, 'Despulpado');
  perform public.log_phase_variable(ph.id, 'brix', 22);
  perform public.close_phase(ph.id, 180, 'despulpado', null);
  ph := public.start_phase(c, 'Secado', th, 'Secado');
  perform public.close_phase(ph.id, 110, 'pergamino_seco', null);
  perform public.log_moisture(c, 11.8);
  perform public.record_quality(c, 'bloqueado', 78, jsonb_build_object('sca', 78, 'defects', jsonb_build_object('primary', 6, 'secondary', 11),
    'notes', 'Fermento excesivo; requiere revisión'));

  -- D: Geisha anaerobic fermenting for 22 days (overdue process) ------------------------------
  h := public.register_harvest(_org, jsonb_build_object('farm_id', f1, 'parcel_id', p2, 'variety', 'Geisha',
    'harvest_date', current_date - 23, 'qty', 150, 'uom', 'kg', 'season', '2025-2026', 'cut_type', 'corte',
    'worker_count', 2, 'responsible', 'Encargado ficticio'), null, 'Geisha anaeróbico');
  d := (h->>'lot_id')::uuid;
  ph := public.start_phase(d, 'Fermentación anaeróbica', ta, 'Fermentación anaeróbica', 4320);
  perform public.log_phase_variable(ph.id, 'ph', 4.1);
  update public.process_phases set started_at = now() - interval '22 days' where id = ph.id; -- time shift

  -- E: two small lots merged into a blend --------------------------------------------------
  h := public.register_harvest(_org, jsonb_build_object('farm_id', f2, 'parcel_id', p3, 'variety', 'Catuaí',
    'harvest_date', current_date - 60, 'qty', 120, 'uom', 'kg', 'season', '2025-2026', 'cut_type', 'repela', 'worker_count', 1), null, 'Catuaí repela');
  e1 := (h->>'lot_id')::uuid;
  h := public.register_harvest(_org, jsonb_build_object('farm_id', f1, 'parcel_id', p1, 'variety', 'Caturra',
    'harvest_date', current_date - 58, 'qty', 80, 'uom', 'kg', 'season', '2025-2026', 'cut_type', 'repela', 'worker_count', 1), null, 'Caturra repela');
  e2 := (h->>'lot_id')::uuid;
  m := public.merge_lots(array[e1, e2], 'Blend Tarrazú-Dota');
  perform public.record_quality(m.id, 'aprobado', 82, jsonb_build_object('sca', 82, 'notes', 'Chocolate, nuez'));
  perform public.release_lot_for_sale(m.id, 'Blend aprobado');
  perform public.create_reservation(m.id, c_crc, 40, 3800, 'CRC', now() + interval '20 days');

  -- Files (objects are uploaded by the server right after provisioning). Contract stays private.
  insert into public.files (organization_id, lot_id, kind, title, storage_path, mime_type, size_bytes, public_selected) values
    (_org, a1, 'photo', 'Secado en patio (ejemplo)', _org || '/' || a1 || '/ejemplo-secado.jpg', 'image/jpeg', 1, true),
    (_org, a1, 'certificate', 'Certificado de origen (ficticio)', _org || '/' || a1 || '/certificado-ficticio.pdf', 'application/pdf', 1, true),
    (_org, a1, 'contract', 'Contrato de venta (ficticio, privado)', _org || '/' || a1 || '/contrato-ficticio.pdf', 'application/pdf', 1, false);
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'path', storage_path, 'kind', kind)), '[]') into files from public.files where organization_id = _org;
  return files;
end $$;

-- Atomic + idempotent provisioning. Caller: administrator of a real (non-demo) source organization.
create or replace function public.provision_evaluation(_source_org uuid, _evaluator uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare es public.evaluation_spaces; blank uuid; sample uuid; files jsonb; created boolean := false; me uuid := auth.uid();
begin
  if me is null or not public.has_org_role(_source_org, '{administrador}')
     or exists (select 1 from public.organizations where id = _source_org and (is_demo or eval_kind is not null)) then
    raise exception 'Permiso denegado' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('eval:' || _source_org, 0));
  select * into es from public.evaluation_spaces where source_org = _source_org;
  if not found then
    insert into public.organizations (name, region, is_demo, eval_kind) values ('Bitácora Café Pro en blanco', 'Evaluación', true, 'blank') returning id into blank;
    insert into public.organizations (name, region, is_demo, eval_kind) values ('Bitácora Café Pro con datos de ejemplo', 'Evaluación', true, 'sample') returning id into sample;
    -- temporary memberships so the business RPCs run with the author as actor; removed below
    insert into public.memberships (organization_id, user_id, role) values (blank, me, 'administrador'), (sample, me, 'administrador');
    perform public._seed_eval_base(blank);
    perform public._seed_eval_base(sample);
    files := public._seed_eval_sample(sample);
    delete from public.memberships where user_id = me and organization_id in (blank, sample);
    insert into public.evaluation_spaces (source_org, blank_org, sample_org, sample_files) values (_source_org, blank, sample, files) returning * into es;
    created := true;
    perform public.write_audit(_source_org, 'evaluation_spaces', _source_org::text, 'provision', jsonb_build_object('blank', blank, 'sample', sample));
  end if;
  if _evaluator is not null then
    if es.evaluator_user is not null and es.evaluator_user <> _evaluator then
      raise exception 'Ya existe una cuenta evaluadora para estos entornos' using errcode='23505'; end if;
    if _evaluator = me or exists (select 1 from public.memberships where user_id = _evaluator and organization_id not in (es.blank_org, es.sample_org)) then
      raise exception 'La cuenta evaluadora no puede pertenecer a otra organización' using errcode='42501'; end if;
    insert into public.memberships (organization_id, user_id, role) values (es.blank_org, _evaluator, 'administrador'), (es.sample_org, _evaluator, 'administrador')
      on conflict do nothing;
    update public.evaluation_spaces set evaluator_user = _evaluator where source_org = _source_org returning * into es;
    perform public.write_audit(_source_org, 'evaluation_spaces', _evaluator::text, 'assign_evaluator', null);
  end if;
  return jsonb_build_object('blank_org', es.blank_org, 'sample_org', es.sample_org, 'created', created,
    'evaluator_user', es.evaluator_user, 'sample_files', es.sample_files);
end $$;

revoke execute on function public._seed_eval_base(uuid) from public, anon, authenticated;
revoke execute on function public._seed_eval_sample(uuid) from public, anon, authenticated;
revoke execute on function public.provision_evaluation(uuid, uuid) from public, anon;
grant execute on function public.provision_evaluation(uuid, uuid) to authenticated;

-- Evaluation spaces cannot manage members, and demo creation requires a real-org admin.
do $patch$
declare def text;
begin
  def := pg_get_functiondef('public.set_member_role(uuid,uuid,public.app_role,boolean)'::regprocedure);
  def := replace(def, 'perform public._require_role(_org, ''{administrador}'');',
    'perform public._require_role(_org, ''{administrador}'');
  if exists (select 1 from public.organizations where id = _org and eval_kind is not null) then
    raise exception ''Los entornos de evaluación no permiten gestionar el equipo'' using errcode=''42501''; end if;');
  if position('eval_kind' in def) = 0 then raise exception 'patch: set_member_role anchor missing'; end if;
  execute def;

  def := pg_get_functiondef('public.create_demo_environment()'::regprocedure);
  def := replace(def, 'if auth.uid() is null or not exists (select 1 from public.memberships where user_id = auth.uid() and role = ''administrador'' and active) then',
    'if auth.uid() is null or not public.is_real_org_admin() then');
  if position('is_real_org_admin' in def) = 0 then raise exception 'patch: create_demo_environment anchor missing'; end if;
  execute def;
end $patch$;

-- my_memberships exposes eval_kind so the UI can show the environment chooser.
drop function public.my_memberships();
create function public.my_memberships()
returns table (organization_id uuid, organization_name text, role public.app_role, is_demo boolean, eval_kind text)
language sql stable security definer set search_path = public as $$
  select m.organization_id, o.name, m.role, o.is_demo, o.eval_kind from public.memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid() and m.active order by o.is_demo, o.eval_kind nulls first, m.created_at
$$;
revoke execute on function public.my_memberships() from public, anon;
grant execute on function public.my_memberships() to authenticated;
