create or replace function public._seed_eval_base(_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._seed_process_templates(_org);
  insert into public.units (organization_id, name, symbol, unit_type, kg_factor, is_configurable) values
    (_org, 'Kilogramo', 'kg', 'weight', 1, false), (_org, 'Cajuela', 'cajuela', 'volume', 12.5, true), (_org, 'Fanega', 'fanega', 'volume', 250, true);
  -- Explicit, persisted base configuration (editable in Ajustes). Sack weight is a demo value, configurable.
  insert into public.org_settings (organization_id, settings) values (_org, jsonb_build_object(
    'low_stock_kg', 100, 'moisture_min', 10, 'moisture_max', 12, 'moisture_ideal', 11,
    'default_sack_kg', 46, 'default_sack_kg_note', 'Peso de saco de demostración; configurable en Ajustes',
    'public_show_producer', true))
  on conflict (organization_id) do nothing;
end $$;
revoke execute on function public._seed_eval_base(uuid) from public, anon, authenticated;

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
    -- Own approved sample first; otherwise the latest approved sample of a source lot, flagged as inherited with its lot code.
    'quality', case when coalesce((vis->>'quality')::boolean, true) then
      (select jsonb_build_object('score', q.score, 'notes', q.data->>'notes', 'cupping', q.data->>'cupping', 'at', q.sampled_at,
         'inherited', q.lot_id <> l.id, 'source_lot_code', case when q.lot_id <> l.id then sl.lot_code end,
         'sca', case when jsonb_typeof(q.data->'sca') = 'object' then q.data->'sca' end,
         'defects', case when jsonb_typeof(q.data->'defects') = 'object' then jsonb_build_object('primary', q.data->'defects'->'primary', 'secondary', q.data->'defects'->'secondary') end)
       from public.quality_samples q join public.lots sl on sl.id = q.lot_id
       where q.lot_id = any(anc) and q.status = 'aprobado'
       order by (q.lot_id = l.id) desc, q.sampled_at desc limit 1) end,
    'files', (select coalesce(jsonb_agg(jsonb_build_object('id', fl.id, 'kind', fl.kind, 'title', fl.title, 'path', fl.storage_path, 'mime', fl.mime_type)), '[]')
              from public.files fl where fl.lot_id = l.id and fl.public_selected and fl.kind <> 'contract'),
    'exported_at', pp.exported_at, 'generated_at', now());
  return res;
end $function$;