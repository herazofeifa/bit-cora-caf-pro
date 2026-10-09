create or replace function public._valid_quality_data(_d jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare k text; v jsonb; out jsonb := '{}'; sca jsonb := '{}'; allowed text[] := array['fragancia','sabor','postgusto','acidez','cuerpo','balance','uniformidad','taza_limpia','dulzor','general'];
  p numeric; s numeric;
begin
  if _d is null then return '{}'; end if;
  if jsonb_typeof(_d) <> 'object' then raise exception 'Datos de calidad inválidos' using errcode='22023'; end if;
  for k in select unnest(array['notes','cupping']) loop
    if _d ? k and jsonb_typeof(_d->k) not in ('string','null') then raise exception 'Texto de calidad inválido' using errcode='22023'; end if;
    if nullif(trim(_d->>k),'') is not null then out := out || jsonb_build_object(k, left(trim(_d->>k), 1000)); end if;
  end loop;
  if jsonb_typeof(_d->'sca') = 'object' then
    for k, v in select * from jsonb_each(_d->'sca') loop
      if not k = any(allowed) then raise exception 'Atributo SCA desconocido: %', k using errcode='22023'; end if;
      if jsonb_typeof(v) = 'null' then continue; end if;
      if jsonb_typeof(v) <> 'number' or (v::text)::numeric < 0 or (v::text)::numeric > 10 then
        raise exception 'El atributo SCA % debe estar entre 0 y 10', k using errcode='22023'; end if;
      sca := sca || jsonb_build_object(k, v);
    end loop;
    if sca <> '{}' then out := out || jsonb_build_object('sca', sca); end if;
  elsif _d ? 'sca' and jsonb_typeof(_d->'sca') not in ('null','number') then raise exception 'Atributos SCA inválidos' using errcode='22023'; end if;
  if jsonb_typeof(_d->'defects') = 'object' then
    begin p := nullif(_d->'defects'->>'primary','')::numeric; s := nullif(_d->'defects'->>'secondary','')::numeric;
    exception when others then raise exception 'Defectos inválidos' using errcode='22023'; end;
    if (p is not null and (p < 0 or p > 1000 or p <> trunc(p))) or (s is not null and (s < 0 or s > 1000 or s <> trunc(s))) then
      raise exception 'Los defectos deben ser enteros entre 0 y 1000' using errcode='22023'; end if;
    out := out || jsonb_build_object('defects', jsonb_strip_nulls(jsonb_build_object('primary', p, 'secondary', s,
      'description', nullif(left(trim(_d->'defects'->>'description'), 500), ''))));
  elsif jsonb_typeof(_d->'defects') = 'string' and nullif(trim(_d->>'defects'),'') is not null then
    out := out || jsonb_build_object('defects', jsonb_build_object('description', left(trim(_d->>'defects'), 500)));
  end if;
  return out;
end $$;

create or replace function public.record_quality(_lot uuid, _status text, _score numeric default null, _data jsonb default '{}'::jsonb)
 returns lots language plpgsql security definer set search_path to 'public' as $function$
declare l public.lots; s public.quality_samples; d jsonb;
begin
  select * into l from public.lots where id = _lot for update;
  if not found then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform public._require_role(l.organization_id, '{administrador,encargado_beneficio}');
  if _score is not null and (_score < 0 or _score > 100) then raise exception 'El puntaje SCA debe estar entre 0 y 100' using errcode='22023'; end if;
  d := public._valid_quality_data(_data);
  insert into public.quality_samples (organization_id, lot_id, status, score, data) values (l.organization_id, _lot, _status, _score, d)
    returning * into s;
  if _status in ('bloqueado','rechazado','requiere_reproceso') then
    update public.lots set qty_blocked_kg = qty_current_kg - qty_reserved_kg - qty_committed_kg,
      quality_status = case when _status = 'rechazado' then 'rechazado' else 'observado' end,
      commercial_state = 'bloqueado_calidad', updated_at = now() where id = _lot returning * into l;
  elsif _status = 'aprobado' then
    update public.lots set qty_blocked_kg = 0, quality_status = 'aprobado',
      commercial_state = case when commercial_state = 'bloqueado_calidad' then 'disponible' else commercial_state end,
      updated_at = now() where id = _lot returning * into l;
  end if;
  perform public.write_audit(l.organization_id, 'quality_samples', s.id::text, 'create', to_jsonb(s));
  return l;
end $function$;

create table public.copilot_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index copilot_usage_user_time on public.copilot_usage (user_id, created_at desc);
grant select on public.copilot_usage to authenticated;
grant all on public.copilot_usage to service_role;
alter table public.copilot_usage enable row level security;
create policy "own copilot usage" on public.copilot_usage for select to authenticated using (user_id = auth.uid());

create or replace function public.copilot_take_quota(_org uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); is_eval boolean; lim_h int; lim_d int; n_h int; n_d int;
begin
  if me is null or not public.is_org_member(_org) then raise exception 'Permiso denegado' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('copilot:' || me, 0));
  is_eval := exists (select 1 from public.memberships m join public.organizations o on o.id = m.organization_id
                     where m.user_id = me and m.active and o.eval_kind is not null);
  lim_h := case when is_eval then 20 else 60 end; lim_d := case when is_eval then 100 else 300 end;
  select count(*) filter (where created_at > now() - interval '1 hour'), count(*) into n_h, n_d
    from public.copilot_usage where user_id = me and created_at > now() - interval '1 day';
  if n_h >= lim_h or n_d >= lim_d then
    return jsonb_build_object('ok', false, 'limit_hour', lim_h, 'limit_day', lim_d, 'used_hour', n_h, 'used_day', n_d); end if;
  insert into public.copilot_usage (user_id, organization_id) values (me, _org);
  return jsonb_build_object('ok', true, 'limit_hour', lim_h, 'used_hour', n_h + 1, 'evaluator', is_eval);
end $$;
revoke all on function public.copilot_take_quota(uuid) from public, anon;
grant execute on function public.copilot_take_quota(uuid) to authenticated;

create or replace function public.register_harvest(_org uuid, _data jsonb, _target_lot uuid default null::uuid, _lot_name text default null::text, _op_key text default null::text)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare t public.harvest_tickets; l public.lots; prev jsonb; q numeric; factor numeric; client_factor numeric; uom text; kg numeric;
  farm uuid; parcel uuid; wc int; res jsonb; u public.units;
begin
  perform public._require_role(_org, '{administrador,encargado_beneficio,productor}');
  prev := public._op_get(_org, _op_key, 'register_harvest', md5(jsonb_build_array(_org,_data,_target_lot,_lot_name)::text));
  if prev is not null then return prev; end if;
  if jsonb_typeof(_data) <> 'object' then raise exception 'Datos de cosecha inválidos' using errcode='22023'; end if;
  begin
    q := (_data->>'qty')::numeric;
    client_factor := nullif(_data->>'kg_factor','')::numeric;
    farm := (_data->>'farm_id')::uuid; parcel := nullif(_data->>'parcel_id','')::uuid;
    wc := nullif(_data->>'worker_count','')::int;
  exception when others then raise exception 'Datos de cosecha inválidos' using errcode='22023'; end;
  perform public._assert_qty(q, 'Cantidad cosechada');
  uom := coalesce(nullif(trim(_data->>'uom'),''), 'kg');
  if uom = 'kg' then factor := 1;
  else
    select * into u from public.units where organization_id = _org and symbol = uom limit 1;
    if not found then raise exception 'Configure el peso en kg de la unidad % (no está configurada en esta organización)', uom using errcode='22023'; end if;
    factor := u.kg_factor;
  end if;
  if factor is null or factor = 'NaN'::numeric or factor <= 0 or factor > 10000 then
    raise exception 'Configure el peso en kg de la unidad %', uom using errcode='22023'; end if;
  if client_factor is not null and client_factor <> factor then
    raise exception 'La equivalencia de % la define la organización (% kg); no se acepta otra desde el formulario', uom, factor using errcode='42501'; end if;
  kg := round(q * factor, 3);
  perform public._assert_qty(kg, 'Cantidad en kg');
  if farm is null or not exists (select 1 from public.farms where id = farm and organization_id = _org) then
    raise exception 'Referencia inválida: finca' using errcode='42501'; end if;
  if parcel is not null and not exists (select 1 from public.parcels where id = parcel and farm_id = farm and organization_id = _org) then
    raise exception 'Referencia inválida: parcela no pertenece a la finca' using errcode='42501'; end if;
  if coalesce(_data->>'harvest_date','') = '' then raise exception 'Indique la fecha de cosecha' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(_data->'workers','[]'::jsonb)) <> 'array' then raise exception 'Lista de trabajadores inválida' using errcode='22023'; end if;

  insert into public.harvest_tickets (organization_id, kind, farm_id, parcel_id, producer_name, harvest_date, variety,
    qty_original, uom_original, qty_kg, conversion_factor_to_kg, season, cut_type, worker_count, workers, responsible, initial_quality, notes)
  values (_org, coalesce(nullif(_data->>'kind',''),'harvest'), farm, parcel, nullif(_data->>'producer_name',''), (_data->>'harvest_date')::date,
    nullif(_data->>'variety',''), q, uom, kg, factor, nullif(_data->>'season',''), nullif(_data->>'cut_type',''),
    coalesce(wc, jsonb_array_length(coalesce(_data->'workers','[]'::jsonb))), coalesce(_data->'workers','[]'::jsonb),
    nullif(_data->>'responsible',''), nullif(_data->>'initial_quality',''), nullif(_data->>'notes',''))
  returning * into t;

  if _target_lot is not null then
    select * into l from public.lots where id = _target_lot for update;
    if not found or l.organization_id <> _org then raise exception 'Referencia inválida: lote' using errcode='42501'; end if;
    if l.physical_state <> 'cereza' or l.sale_released then
      raise exception 'Solo se puede sumar cosecha a un lote en cereza que sigue en proceso' using errcode='55000'; end if;
    update public.lots set qty_initial_kg = qty_initial_kg + kg, qty_current_kg = qty_current_kg + kg, updated_at = now()
      where id = _target_lot returning * into l;
    insert into public.stock_movements (organization_id, lot_id, movement_type, qty_kg, reason, reference_id)
      values (_org, l.id, 'entrada', kg, 'Cosecha sumada a lote existente', t.id);
    perform public.write_audit(_org, 'lots', l.id::text, 'harvest_added', jsonb_build_object('ticket', t.id, 'kg', kg));
  else
    l := public.create_lot(_org, coalesce(nullif(trim(_lot_name),''), 'Cosecha ' || to_char(t.harvest_date, 'DD/MM/YYYY')), kg,
      farm, parcel, coalesce(t.variety,''), coalesce(nullif(_data->>'process_type',''),'lavado'), 'cereza', t.id);
  end if;
  update public.harvest_tickets set lot_id = l.id where id = t.id;
  perform public.write_audit(_org, 'harvest_tickets', t.id::text, 'create', to_jsonb(t));
  res := jsonb_build_object('ticket_id', t.id, 'lot_id', l.id, 'lot_code', l.lot_code, 'qty_kg', kg, 'added_to_existing', _target_lot is not null);
  perform public._op_put(_org, _op_key, 'register_harvest', res);
  return res;
end $function$;

create or replace function public.public_lot_view(_token text) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $function$
declare pp public.lot_public_profiles; l public.lots; vis jsonb; res jsonb; origins jsonb; n_orig int; anc uuid[];
  show_farm boolean; show_parcel boolean; show_prod boolean;
begin
  if _token is null or _token !~ '^[a-f0-9]{32}$' then return null; end if;
  select * into pp from public.lot_public_profiles where public_token = _token and is_public;
  if not found then return null; end if;
  select * into l from public.lots where id = pp.lot_id;
  vis := coalesce(pp.visibility, '{}');
  show_farm := coalesce((vis->>'farm')::boolean, true); show_parcel := coalesce((vis->>'parcel')::boolean, true);
  show_prod := coalesce((vis->>'producer')::boolean, true);
  with recursive r(id, depth, path) as (
      select l.id, 0, array[l.id]
      union all
      select ll.parent_lot_id, r.depth + 1, r.path || ll.parent_lot_id from public.lot_links ll join r on ll.child_lot_id = r.id
      where r.depth < 25 and not ll.parent_lot_id = any(r.path))
  select array_agg(distinct id) into anc from r;
  select coalesce(jsonb_agg(o), '[]'), count(*) into origins, n_orig from (
    select distinct jsonb_build_object(
      'farm', case when show_farm then f.name end, 'region', case when show_farm then f.region end, 'country', f.country,
      'altitude_m', case when show_farm or show_parcel then coalesce(case when show_parcel then pc.altitude_m end, f.altitude_m) end,
      'parcel', case when show_parcel then pc.name end, 'producer', case when show_prod then f.owner_name end) o
    from public.lots x join public.farms f on f.id = x.farm_id left join public.parcels pc on pc.id = x.parcel_id where x.id = any(anc)) s;
  res := jsonb_build_object(
    'lot_code', l.lot_code, 'name', l.friendly_name, 'variety', nullif(l.variety,''), 'process', l.process_type,
    'physical_state', l.physical_state, 'story', pp.short_story, 'tasting_notes', pp.tasting_notes,
    'is_blend', exists (select 1 from public.lot_links where child_lot_id = l.id and kind = 'merge'),
    'origins', origins,
    'farm', case when n_orig = 1 and show_farm then (select jsonb_build_object('name', origins->0->>'farm', 'region', origins->0->>'region',
              'country', origins->0->>'country', 'altitude_m', (origins->0->>'altitude_m')::numeric)) end,
    'parcel', case when n_orig = 1 and show_parcel and origins->0->>'parcel' is not null then
              jsonb_build_object('name', origins->0->>'parcel', 'altitude_m', (origins->0->>'altitude_m')::numeric) end,
    'producer', case when n_orig = 1 and show_prod then origins->0->>'producer' end,
    'harvest', (select jsonb_build_object('first', min(t.harvest_date), 'last', max(t.harvest_date), 'season', max(t.season))
                from public.harvest_tickets t join public.lots x on (t.lot_id = x.id or t.id = x.harvest_ticket_id) where x.id = any(anc)),
    'phases', (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'started_at', p.started_at, 'ended_at', p.ended_at, 'inherited', p.lot_id <> l.id)
                order by p.started_at), '[]') from public.process_phases p where p.lot_id = any(anc)),
    'measurements', case when coalesce((vis->>'measurements')::boolean, false) then
      (select coalesce(jsonb_agg(jsonb_build_object('label', v.value->>'label', 'value', v.value_number, 'unit', v.value->>'unit', 'at', v.measured_at) order by v.measured_at), '[]')
       from public.variable_logs v where v.lot_id = any(anc)) end,
    'moisture', case when coalesce((vis->>'moisture')::boolean, true) then l.current_moisture end,
    'quality', case when coalesce((vis->>'quality')::boolean, true) then
      (select jsonb_build_object('score', q.score, 'notes', q.data->>'notes', 'cupping', q.data->>'cupping', 'at', q.sampled_at,
         'sca', case when jsonb_typeof(q.data->'sca') = 'object' then q.data->'sca' end,
         'defects', case when jsonb_typeof(q.data->'defects') = 'object' then jsonb_build_object('primary', q.data->'defects'->'primary', 'secondary', q.data->'defects'->'secondary') end)
       from public.quality_samples q
       where q.lot_id = l.id and q.status = 'aprobado' order by q.sampled_at desc limit 1) end,
    'files', (select coalesce(jsonb_agg(jsonb_build_object('id', fl.id, 'kind', fl.kind, 'title', fl.title, 'path', fl.storage_path, 'mime', fl.mime_type)), '[]')
              from public.files fl where fl.lot_id = l.id and fl.public_selected and fl.kind <> 'contract'),
    'exported_at', pp.exported_at, 'generated_at', now());
  return res;
end $function$;