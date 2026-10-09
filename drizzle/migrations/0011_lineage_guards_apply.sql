create or replace function public._assert_no_open_phase(_lots uuid[]) returns void
language plpgsql stable security definer set search_path = public as $$
declare c text;
begin
  select l.lot_code into c from public.process_phases p join public.lots l on l.id = p.lot_id
   where p.lot_id = any(_lots) and p.status in ('running','paused') limit 1;
  if c is not null then
    raise exception 'El lote % tiene una fase abierta: ciérrala antes de transformarlo', c using errcode='55000'; end if;
end $$;
revoke all on function public._assert_no_open_phase(uuid[]) from public, anon, authenticated;

create or replace function public.merge_lots(_lots uuid[], _name text)
 returns lots language plpgsql security definer set search_path to 'public' as $function$
declare org uuid; src public.lots; total numeric := 0; merged public.lots; ids uuid[]; take numeric;
  n_state int; n_var int; n_proc int; st text; var text; proc text;
begin
  if _lots is null or array_length(_lots,1) < 2 then raise exception 'La mezcla necesita al menos 2 lotes' using errcode='22023'; end if;
  if (select count(distinct x) from unnest(_lots) x) <> array_length(_lots,1) or array_position(_lots, null) is not null then
    raise exception 'Lotes duplicados o vacíos en la mezcla' using errcode='22023'; end if;
  select array_agg(id order by id) into ids from public.lots where id = any(_lots);
  if coalesce(array_length(ids,1),0) <> array_length(_lots,1) then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform 1 from public.lots where id = any(ids) order by id for update;
  select organization_id into org from public.lots where id = ids[1];
  if exists (select 1 from public.lots where id = any(ids) and organization_id <> org) then raise exception 'Lotes de distintas organizaciones' using errcode='42501'; end if;
  perform public._require_role(org, '{administrador}');
  if coalesce(trim(_name),'') = '' then raise exception 'La mezcla necesita un nombre' using errcode='22023'; end if;
  select count(distinct physical_state), count(distinct variety), count(distinct process_type), min(physical_state), min(variety), min(process_type)
    into n_state, n_var, n_proc, st, var, proc from public.lots where id = any(ids);
  if n_state > 1 then
    raise exception 'Solo se pueden mezclar lotes con el mismo estado físico' using errcode='22023'; end if;
  perform public._assert_no_open_phase(ids);
  for src in select * from public.lots where id = any(ids) loop
    take := src.qty_current_kg - src.qty_reserved_kg - src.qty_committed_kg - src.stock_safety_kg;
    if take <= 0 then raise exception 'El lote % no tiene café libre de reservas para mezclar', src.lot_code using errcode='23514'; end if;
    if src.quality_status in ('rechazado','observado') then raise exception 'El lote % está bloqueado por calidad', src.lot_code using errcode='55000'; end if;
    total := total + take;
  end loop;
  insert into public.lots (organization_id, lot_code, friendly_name, variety, process_type, physical_state, qty_initial_kg, qty_current_kg)
  values (org, public._next_lot_code(org, 'MEZ'), trim(_name), case when n_var = 1 then var else 'Mezcla' end,
          case when n_proc = 1 then proc else 'mezcla' end, st, total, total)
  returning * into merged;
  for src in select * from public.lots where id = any(ids) loop
    take := src.qty_current_kg - src.qty_reserved_kg - src.qty_committed_kg - src.stock_safety_kg;
    insert into public.lot_links values (src.id, merged.id, 'merge', take, now());
    insert into public.stock_movements (organization_id, lot_id, movement_type, qty_kg, reference_id) values (org, src.id, 'transformacion', -take, merged.id);
    update public.lots set qty_current_kg = qty_current_kg - take,
      qty_blocked_kg = least(qty_blocked_kg, qty_current_kg - take - qty_reserved_kg - qty_committed_kg), updated_at = now() where id = src.id;
  end loop;
  insert into public.stock_movements (organization_id, lot_id, movement_type, qty_kg) values (org, merged.id, 'entrada', total);
  perform public.write_audit(org, 'lots', merged.id::text, 'merge', jsonb_build_object('sources', ids, 'kg', total));
  return merged;
end $function$;

create or replace function public.split_lot(_lot uuid, _parts jsonb)
 returns setof lots language plpgsql security definer set search_path to 'public' as $function$
declare l public.lots; part jsonb; q numeric; total numeric := 0; child public.lots; movable numeric;
begin
  select * into l from public.lots where id = _lot for update;
  if not found then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform public._require_role(l.organization_id, '{administrador}');
  perform public._assert_no_open_phase(array[_lot]);
  if jsonb_typeof(_parts) <> 'array' or jsonb_array_length(_parts) < 2 then
    raise exception 'La división necesita al menos 2 partes' using errcode='22023'; end if;
  for part in select * from jsonb_array_elements(_parts) loop
    begin q := (part->>'qty_kg')::numeric; exception when others then raise exception 'Cantidad inválida en una parte' using errcode='22023'; end;
    perform public._assert_qty(q, 'Parte');
    total := total + q;
  end loop;
  movable := l.qty_current_kg - l.qty_reserved_kg - l.qty_committed_kg - l.stock_safety_kg;
  if total > movable then
    raise exception 'Las partes suman % kg pero solo hay % kg libres de reservas', total, movable using errcode='23514'; end if;
  update public.lots set qty_current_kg = qty_current_kg - total,
    qty_blocked_kg = least(qty_blocked_kg, qty_current_kg - total - qty_reserved_kg - qty_committed_kg), updated_at = now() where id = _lot;
  for part in select * from jsonb_array_elements(_parts) loop
    q := (part->>'qty_kg')::numeric;
    insert into public.lots (organization_id, lot_code, friendly_name, farm_id, parcel_id, harvest_ticket_id, parent_lot_id, variety, process_type,
      physical_state, commercial_state, quality_status, sale_released, qty_initial_kg, qty_current_kg, current_moisture)
    values (l.organization_id, public._next_lot_code(l.organization_id, l.process_type),
      coalesce(nullif(trim(part->>'name'),''), l.friendly_name || ' (parte)'), l.farm_id, l.parcel_id, l.harvest_ticket_id, l.id, l.variety, l.process_type,
      l.physical_state, l.commercial_state, l.quality_status, l.sale_released, q, q, l.current_moisture)
    returning * into child;
    insert into public.lot_links values (l.id, child.id, 'split', q, now());
    insert into public.stock_movements (organization_id, lot_id, movement_type, qty_kg, reference_id) values (l.organization_id, l.id, 'transformacion', -q, child.id);
    insert into public.stock_movements (organization_id, lot_id, movement_type, qty_kg, reference_id) values (l.organization_id, child.id, 'entrada', q, l.id);
    return next child;
  end loop;
  perform public.write_audit(l.organization_id, 'lots', l.id::text, 'split', jsonb_build_object('parts', _parts));
end $function$;

create or replace function public.lot_lineage(_lot uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  with recursive anc(id, depth, path) as (
    select _lot, 0, array[_lot]
    union all
    select ll.parent_lot_id, a.depth + 1, a.path || ll.parent_lot_id
    from public.lot_links ll join anc a on ll.child_lot_id = a.id
    where a.depth < 25 and not ll.parent_lot_id = any(a.path)
  ), al as (select distinct on (id) id, depth from anc order by id, depth)
  select jsonb_build_object(
    'origins', (select coalesce(jsonb_agg(distinct jsonb_build_object('farm', f.name, 'region', f.region, 'country', f.country,
                  'parcel', pc.name, 'altitude_m', coalesce(pc.altitude_m, f.altitude_m))), '[]')
                from al join public.lots l on l.id = al.id
                join public.farms f on f.id = l.farm_id left join public.parcels pc on pc.id = l.parcel_id),
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('lot_code', l.lot_code, 'kind', ll.kind, 'qty_kg', ll.qty_kg)), '[]')
                from public.lot_links ll join public.lots l on l.id = ll.parent_lot_id where ll.child_lot_id = _lot),
    'phases', (select coalesce(jsonb_agg(jsonb_build_object('lot_code', l.lot_code, 'inherited', al.depth > 0, 'name', p.name, 'status', p.status,
                  'started_at', p.started_at, 'ended_at', p.ended_at, 'weight_in_kg', p.weight_in_kg, 'weight_out_kg', p.weight_out_kg) order by p.started_at), '[]')
               from al join public.process_phases p on p.lot_id = al.id join public.lots l on l.id = al.id),
    'measurements', (select coalesce(jsonb_agg(jsonb_build_object('lot_code', l.lot_code, 'inherited', al.depth > 0, 'label', v.value->>'label',
                  'value', v.value_number, 'unit', v.value->>'unit', 'at', v.measured_at) order by v.measured_at), '[]')
               from al join public.variable_logs v on v.lot_id = al.id join public.lots l on l.id = al.id where al.depth > 0)
  )
$$;
revoke all on function public.lot_lineage(uuid) from public, anon;
grant execute on function public.lot_lineage(uuid) to authenticated;

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
      (select jsonb_build_object('score', q.score, 'notes', q.data->>'notes', 'at', q.sampled_at) from public.quality_samples q
       where q.lot_id = l.id and q.status = 'aprobado' order by q.sampled_at desc limit 1) end,
    'files', (select coalesce(jsonb_agg(jsonb_build_object('id', fl.id, 'kind', fl.kind, 'title', fl.title, 'path', fl.storage_path, 'mime', fl.mime_type)), '[]')
              from public.files fl where fl.lot_id = l.id and fl.public_selected and fl.kind <> 'contract'),
    'exported_at', pp.exported_at, 'generated_at', now());
  return res;
end $function$;