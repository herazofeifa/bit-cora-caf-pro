-- 0004: sale-release gate, delivery quality gate, finite prices, cross-org reference checks,
-- idempotent operations, harvest-in-one-transaction, versioned process templates/phases,
-- files metadata, public QR projections (lot + sack), report snapshots, demo environment.

-- ===== Idempotency keys =====
create table public.operation_keys (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  op_key text not null check (length(op_key) between 8 and 200),
  operation text not null,
  result jsonb not null,
  actor_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (organization_id, op_key)
);
grant select on public.operation_keys to authenticated;
grant all on public.operation_keys to service_role;
alter table public.operation_keys enable row level security;
create policy "members read" on public.operation_keys for select to authenticated using (public.is_org_member(organization_id));

create or replace function public._op_get(_org uuid, _key text, _op text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k public.operation_keys;
begin
  if _key is null then return null; end if;
  if length(_key) < 8 or length(_key) > 200 then raise exception 'Clave de operación inválida' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(_org::text || ':' || _key, 0));
  select * into k from public.operation_keys where organization_id = _org and op_key = _key;
  if not found then return null; end if;
  if k.operation <> _op then raise exception 'La clave de operación ya se usó para otra acción' using errcode='23505'; end if;
  return k.result;
end $$;
create or replace function public._op_put(_org uuid, _key text, _op text, _result jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.operation_keys (organization_id, op_key, operation, result) select _org, _key, _op, _result where _key is not null
$$;

-- ===== Cross-organization reference guard (generic trigger) =====
-- args: 'column:table' pairs. Every referenced row must belong to NEW.organization_id.
create or replace function public._same_org_refs()
returns trigger language plpgsql security definer set search_path = public as $$
declare a text; col text; tbl text; v text; o uuid;
begin
  foreach a in array tg_argv loop
    col := split_part(a, ':', 1); tbl := split_part(a, ':', 2);
    v := to_jsonb(new) ->> col;
    if v is not null then
      execute format('select organization_id from public.%I where id = $1', tbl) into o using v::uuid;
      if o is null or o <> new.organization_id then
        raise exception 'Referencia inválida: % no pertenece a esta organización', col using errcode='42501';
      end if;
    end if;
  end loop;
  return new;
end $$;
create trigger same_org_refs before insert or update on public.parcels for each row execute function public._same_org_refs('farm_id:farms');
create trigger same_org_refs before insert or update on public.harvest_tickets for each row execute function public._same_org_refs('farm_id:farms','parcel_id:parcels');
create trigger same_org_refs before insert or update on public.lots for each row execute function public._same_org_refs('farm_id:farms','parcel_id:parcels','harvest_ticket_id:harvest_tickets','parent_lot_id:lots');
create trigger same_org_refs before insert or update on public.reservations for each row execute function public._same_org_refs('lot_id:lots','customer_id:customers');
create trigger same_org_refs before insert or update on public.process_phases for each row execute function public._same_org_refs('lot_id:lots');
create trigger same_org_refs before insert or update on public.variable_logs for each row execute function public._same_org_refs('lot_id:lots','phase_id:process_phases','variable_id:variable_definitions');
create trigger same_org_refs before insert or update on public.moisture_logs for each row execute function public._same_org_refs('lot_id:lots');
create trigger same_org_refs before insert or update on public.waste_logs for each row execute function public._same_org_refs('lot_id:lots');
create trigger same_org_refs before insert or update on public.quality_samples for each row execute function public._same_org_refs('lot_id:lots');
create trigger same_org_refs before insert or update on public.stock_movements for each row execute function public._same_org_refs('lot_id:lots');
create trigger same_org_refs before insert or update on public.lot_public_profiles for each row execute function public._same_org_refs('lot_id:lots');

-- ===== Commercial state is derived; coffee is not negotiable until explicitly released =====
alter table public.lots add column sale_released boolean not null default false;
alter table public.lots add column sale_released_at timestamptz;

create or replace function public._lots_derive_state()
returns trigger language plpgsql as $$
declare free numeric;
begin
  if new.commercial_state = 'descartado' then
    null;
  elsif new.quality_status in ('rechazado','observado') then
    new.commercial_state := 'bloqueado_calidad';
  elsif not new.sale_released then
    if new.commercial_state not in ('bloqueado_humedad','bloqueado_revision') then new.commercial_state := 'en_proceso'; end if;
  elsif new.commercial_state in ('en_proceso','bloqueado_calidad') then
    new.commercial_state := 'disponible';
  end if;

  if new.commercial_state in ('en_proceso','bloqueado_calidad','bloqueado_humedad','bloqueado_revision','descartado') then
    new.qty_blocked_kg := greatest(0, new.qty_current_kg - new.qty_reserved_kg - new.qty_committed_kg);
  else
    new.qty_blocked_kg := least(new.qty_blocked_kg, greatest(0, new.qty_current_kg - new.qty_reserved_kg - new.qty_committed_kg));
    free := new.qty_current_kg - new.qty_reserved_kg - new.qty_committed_kg - new.qty_blocked_kg - new.stock_safety_kg;
    new.commercial_state := case
      when new.qty_current_kg = 0 and new.qty_sold_kg > 0 then 'vendido'
      when free <= 0 and new.qty_committed_kg > 0 then 'comprometido'
      when free <= 0 and new.qty_reserved_kg > 0 then 'reservado'
      when new.qty_sold_kg > 0 then 'vendido_parcial'
      else 'disponible' end;
  end if;
  return new;
end $$;
create trigger lots_derive_state before insert or update on public.lots for each row execute function public._lots_derive_state();
update public.lots set updated_at = updated_at; -- backfill: recompute state/blocked for existing rows

create or replace function public.release_lot_for_sale(_lot uuid, _reason text default null)
returns public.lots language plpgsql security definer set search_path = public as $$
declare l public.lots;
begin
  select * into l from public.lots where id = _lot for update;
  if not found then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform public._require_role(l.organization_id, '{administrador,encargado_beneficio}');
  if l.quality_status in ('rechazado','observado') then raise exception 'El lote está bloqueado por calidad' using errcode='55000'; end if;
  if l.sale_released then return l; end if;
  if l.qty_current_kg <= 0 then raise exception 'El lote no tiene café para liberar' using errcode='55000'; end if;
  update public.lots set sale_released = true, sale_released_at = now(), commercial_state = 'disponible', qty_blocked_kg = 0, updated_at = now()
    where id = _lot returning * into l;
  perform public.write_audit(l.organization_id, 'lots', _lot::text, 'release_for_sale', jsonb_build_object('reason', _reason, 'free_kg', l.qty_free_kg));
  return l;
end $$;

-- ===== create_lot: references validated, idempotent =====
drop function public.create_lot(uuid, text, numeric, uuid, uuid, text, text, text, uuid);
create or replace function public.create_lot(_org uuid, _friendly_name text, _qty_kg numeric,
  _farm_id uuid default null, _parcel_id uuid default null, _variety text default '',
  _process_type text default 'lavado', _physical_state text default 'cereza', _harvest_ticket_id uuid default null,
  _op_key text default null)
returns public.lots language plpgsql security definer set search_path = public as $$
declare l public.lots; prev jsonb;
begin
  perform public._require_role(_org, '{administrador,encargado_beneficio,productor}');
  prev := public._op_get(_org, _op_key, 'create_lot');
  if prev is not null then select * into l from public.lots where id = (prev->>'id')::uuid; return l; end if;
  perform public._assert_qty(_qty_kg, 'Cantidad del lote');
  if coalesce(trim(_friendly_name),'') = '' then raise exception 'El lote necesita un nombre' using errcode='22023'; end if;
  if _farm_id is not null and not exists (select 1 from public.farms where id = _farm_id and organization_id = _org) then
    raise exception 'Referencia inválida: finca de otra organización' using errcode='42501'; end if;
  if _parcel_id is not null and not exists (select 1 from public.parcels where id = _parcel_id and organization_id = _org
      and (_farm_id is null or farm_id = _farm_id)) then
    raise exception 'Referencia inválida: parcela no pertenece a la finca u organización' using errcode='42501'; end if;
  if _harvest_ticket_id is not null and not exists (select 1 from public.harvest_tickets where id = _harvest_ticket_id and organization_id = _org) then
    raise exception 'Referencia inválida: recibo de otra organización' using errcode='42501'; end if;
  insert into public.lots (organization_id, lot_code, friendly_name, farm_id, parcel_id, harvest_ticket_id, variety,
    process_type, physical_state, qty_initial_kg, qty_current_kg)
  values (_org, public._next_lot_code(_org, _process_type), trim(_friendly_name), _farm_id, _parcel_id, _harvest_ticket_id,
    coalesce(_variety,''), coalesce(_process_type,'lavado'), coalesce(_physical_state,'cereza'), _qty_kg, _qty_kg)
  returning * into l;
  insert into public.stock_movements (organization_id, lot_id, movement_type, qty_kg, reason, reference_id)
    values (_org, l.id, 'entrada', _qty_kg, 'Creación de lote', _harvest_ticket_id);
  perform public.write_audit(_org, 'lots', l.id::text, 'create', to_jsonb(l));
  perform public._op_put(_org, _op_key, 'create_lot', jsonb_build_object('id', l.id));
  return l;
end $$;

-- ===== Reservations: finite price with explicit currency and unit, idempotent =====
alter table public.reservations add column price_unit text not null default 'kg' check (price_unit = 'kg');
alter table public.reservations add constraint reservations_price_finite check (price is null or (price >= 0 and price < 1000000000));
alter table public.reservations add constraint reservations_currency_when_price check (price is null or currency ~ '^[A-Z]{3}$');
drop function public.create_reservation(uuid, uuid, numeric, numeric, text, timestamptz, text);
create or replace function public.create_reservation(_lot uuid, _customer uuid, _qty numeric,
  _price numeric default null, _currency text default null, _expires_at timestamptz default null, _notes text default null,
  _price_unit text default 'kg', _op_key text default null)
returns public.reservations language plpgsql security definer set search_path = public as $$
declare l public.lots; r public.reservations; prev jsonb;
begin
  select * into l from public.lots where id = _lot for update;
  if not found then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform public._require_role(l.organization_id, '{administrador,comercial}');
  prev := public._op_get(l.organization_id, _op_key, 'create_reservation');
  if prev is not null then select * into r from public.reservations where id = (prev->>'id')::uuid; return r; end if;
  perform public._assert_qty(_qty, 'Cantidad a reservar');
  if _price is not null then
    if _price = 'NaN'::numeric or _price < 0 or _price >= 1000000000 then raise exception 'Precio inválido' using errcode='22023'; end if;
    if _currency is null or _currency !~ '^[A-Z]{3}$' then raise exception 'Indique la moneda (USD, CRC…)' using errcode='22023'; end if;
  end if;
  if coalesce(_price_unit,'') <> 'kg' then raise exception 'El precio debe expresarse por kg' using errcode='22023'; end if;
  if not exists (select 1 from public.customers where id = _customer and organization_id = l.organization_id) then
    raise exception 'Cliente no encontrado' using errcode='P0002'; end if;
  if not l.sale_released or l.commercial_state = 'bloqueado_calidad' then
    raise exception 'Sobreventa: el lote no está liberado para la venta (0 kg libres)' using errcode='23514'; end if;
  if _qty > l.qty_free_kg then
    raise exception 'Sobreventa: solo hay % kg libres', l.qty_free_kg using errcode='23514'; end if;
  update public.lots set qty_reserved_kg = qty_reserved_kg + _qty, updated_at = now() where id = _lot;
  insert into public.reservations (organization_id, lot_id, customer_id, qty_kg, price, currency, price_unit, expires_at, notes)
    values (l.organization_id, _lot, _customer, _qty, _price, _currency, 'kg', _expires_at, _notes) returning * into r;
  insert into public.stock_movements (organization_id, lot_id, movement_type, qty_kg, reference_id) values (l.organization_id, _lot, 'reserva', _qty, r.id);
  perform public.write_audit(l.organization_id, 'reservations', r.id::text, 'create', to_jsonb(r));
  perform public._op_put(l.organization_id, _op_key, 'create_reservation', jsonb_build_object('id', r.id));
  return r;
end $$;

-- ===== Delivery: rejected atomically when the lot is quality-blocked; idempotent by key =====
drop function public.deliver_reservation(uuid, text);
create or replace function public.deliver_reservation(_id uuid, _notes text default null, _op_key text default null)
returns public.reservations language plpgsql security definer set search_path = public as $$
declare r public.reservations; l public.lots; prev jsonb;
begin
  r := public._lock_reservation(_id);
  perform public._require_role(r.organization_id, '{administrador,comercial}');
  prev := public._op_get(r.organization_id, _op_key, 'deliver_reservation');
  if prev is not null then return r; end if;
  select * into l from public.lots where id = r.lot_id;
  if l.commercial_state = 'bloqueado_calidad' or l.quality_status in ('rechazado','observado') then
    raise exception 'No se puede entregar: el lote % está bloqueado por calidad', l.lot_code using errcode='55000'; end if;
  if r.status = 'confirmada' then
    update public.lots set qty_committed_kg = qty_committed_kg - r.qty_kg, qty_current_kg = qty_current_kg - r.qty_kg,
      qty_sold_kg = qty_sold_kg + r.qty_kg, updated_at = now() where id = r.lot_id;
  elsif r.status = 'reservada' then
    update public.lots set qty_reserved_kg = qty_reserved_kg - r.qty_kg, qty_current_kg = qty_current_kg - r.qty_kg,
      qty_sold_kg = qty_sold_kg + r.qty_kg, updated_at = now() where id = r.lot_id;
  else
    raise exception 'La reserva está %, no se puede entregar', r.status using errcode='55000';
  end if;
  update public.reservations set status = 'entregada', delivered_at = now(),
    notes = coalesce(notes || E'\n', '') || coalesce(_notes, '') where id = _id returning * into r;
  insert into public.stock_movements (organization_id, lot_id, movement_type, qty_kg, reference_id) values (r.organization_id, r.lot_id, 'venta', -r.qty_kg, r.id);
  perform public.write_audit(r.organization_id, 'reservations', _id::text, 'deliver', jsonb_build_object('kg', r.qty_kg, 'price', r.price, 'currency', r.currency));
  perform public._op_put(r.organization_id, _op_key, 'deliver_reservation', jsonb_build_object('id', r.id));
  return r;
end $$;

-- ===== Split / merge: can operate on in-process coffee, never on reserved/committed =====
create or replace function public.split_lot(_lot uuid, _parts jsonb)
returns setof public.lots language plpgsql security definer set search_path = public as $$
declare l public.lots; part jsonb; q numeric; total numeric := 0; child public.lots; movable numeric;
begin
  select * into l from public.lots where id = _lot for update;
  if not found then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform public._require_role(l.organization_id, '{administrador}');
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
end $$;

create or replace function public.merge_lots(_lots uuid[], _name text)
returns public.lots language plpgsql security definer set search_path = public as $$
declare org uuid; src public.lots; total numeric := 0; merged public.lots; ids uuid[]; take numeric;
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
  for src in select * from public.lots where id = any(ids) loop
    take := src.qty_current_kg - src.qty_reserved_kg - src.qty_committed_kg - src.stock_safety_kg;
    if take <= 0 then raise exception 'El lote % no tiene café libre de reservas para mezclar', src.lot_code using errcode='23514'; end if;
    if src.quality_status in ('rechazado','observado') then raise exception 'El lote % está bloqueado por calidad', src.lot_code using errcode='55000'; end if;
    total := total + take;
  end loop;
  select * into src from public.lots where id = ids[1];
  insert into public.lots (organization_id, lot_code, friendly_name, variety, process_type, physical_state, qty_initial_kg, qty_current_kg)
  values (org, public._next_lot_code(org, 'MEZ'), trim(_name), 'Mezcla', src.process_type, src.physical_state, total, total)
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
end $$;

-- ===== Harvest: ticket + new or existing lot in one transaction =====
alter table public.harvest_tickets
  add column season text,
  add column cut_type text check (cut_type is null or cut_type in ('corte','pasilla','repela','otro')),
  add column worker_count int check (worker_count is null or worker_count between 0 and 1000),
  add column workers jsonb not null default '[]'::jsonb,
  add column responsible text,
  add column initial_quality text,
  add column lot_id uuid references public.lots(id),
  add column notes text;
create trigger same_org_refs_lot before insert or update on public.harvest_tickets for each row execute function public._same_org_refs('lot_id:lots');

create or replace function public.register_harvest(_org uuid, _data jsonb, _target_lot uuid default null,
  _lot_name text default null, _op_key text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.harvest_tickets; l public.lots; prev jsonb; q numeric; factor numeric; uom text; kg numeric;
  farm uuid; parcel uuid; wc int; res jsonb;
begin
  perform public._require_role(_org, '{administrador,encargado_beneficio,productor}');
  prev := public._op_get(_org, _op_key, 'register_harvest');
  if prev is not null then return prev; end if;
  if jsonb_typeof(_data) <> 'object' then raise exception 'Datos de cosecha inválidos' using errcode='22023'; end if;
  begin
    q := (_data->>'qty')::numeric;
    factor := nullif(_data->>'kg_factor','')::numeric;
    farm := (_data->>'farm_id')::uuid; parcel := nullif(_data->>'parcel_id','')::uuid;
    wc := nullif(_data->>'worker_count','')::int;
  exception when others then raise exception 'Datos de cosecha inválidos' using errcode='22023'; end;
  perform public._assert_qty(q, 'Cantidad cosechada');
  uom := coalesce(nullif(trim(_data->>'uom'),''), 'kg');
  if uom = 'kg' then factor := 1;
  elsif factor is null then select kg_factor into factor from public.units where organization_id = _org and symbol = uom;
  end if;
  if factor is null or factor = 'NaN'::numeric or factor <= 0 or factor > 10000 then
    raise exception 'Configure el peso en kg de la unidad %', uom using errcode='22023'; end if;
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
end $$;

-- ===== Versioned process templates =====
alter table public.process_templates
  add column version int not null default 1,
  add column root_id uuid,
  add column is_custom boolean not null default false,
  add column active boolean not null default true,
  add column created_by uuid default auth.uid();
alter table public.process_templates add constraint process_templates_phases_array check (jsonb_typeof(phases) = 'array');

create or replace function public._seed_process_templates(_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.process_templates where organization_id = _org and not is_custom) then return; end if;
  insert into public.process_templates (organization_id, name, process_type, description, phases) values
  (_org, 'Lavado', 'lavado', 'Despulpado, fermentación en agua, lavado y secado', '[
    {"name":"Despulpado","expected_minutes":240,"variables":[]},
    {"name":"Fermentación","expected_minutes":2160,"variables":[{"key":"ph","label":"pH","unit":"pH","min":3.8,"max":5.5},{"key":"temperatura","label":"Temperatura","unit":"°C","min":15,"max":28},{"key":"brix","label":"Brix","unit":"°Bx","min":4,"max":20}]},
    {"name":"Lavado","expected_minutes":180,"variables":[]},
    {"name":"Secado","expected_minutes":20160,"variables":[{"key":"humedad","label":"Humedad","unit":"%","min":10,"max":12},{"key":"temperatura","label":"Temperatura","unit":"°C","min":20,"max":40}]}]'),
  (_org, 'Honey', 'honey', 'Despulpado conservando mucílago y secado', '[
    {"name":"Despulpado","expected_minutes":240,"variables":[{"key":"brix","label":"Brix","unit":"°Bx","min":15,"max":28}]},
    {"name":"Secado","expected_minutes":25920,"variables":[{"key":"humedad","label":"Humedad","unit":"%","min":10,"max":12},{"key":"temperatura","label":"Temperatura","unit":"°C","min":20,"max":40}]}]'),
  (_org, 'Natural', 'natural', 'Secado de la cereza entera', '[
    {"name":"Flotación y selección","expected_minutes":120,"variables":[]},
    {"name":"Secado","expected_minutes":30240,"variables":[{"key":"humedad","label":"Humedad","unit":"%","min":10,"max":12},{"key":"temperatura","label":"Temperatura","unit":"°C","min":20,"max":40}]}]'),
  (_org, 'Anaeróbico', 'anaerobico', 'Fermentación en tanque cerrado y secado', '[
    {"name":"Fermentación anaeróbica","expected_minutes":4320,"variables":[{"key":"ph","label":"pH","unit":"pH","min":3.5,"max":5.0},{"key":"temperatura","label":"Temperatura","unit":"°C","min":15,"max":25},{"key":"brix","label":"Brix","unit":"°Bx","min":4,"max":22}]},
    {"name":"Secado","expected_minutes":25920,"variables":[{"key":"humedad","label":"Humedad","unit":"%","min":10,"max":12}]}]');
  update public.process_templates set root_id = id where organization_id = _org and root_id is null;
end $$;
select public._seed_process_templates(id) from public.organizations; -- backfill: default templates for existing organizations

create or replace function public.save_process_template(_org uuid, _template uuid, _name text, _process_type text, _description text, _phases jsonb)
returns public.process_templates language plpgsql security definer set search_path = public as $$
declare old public.process_templates; t public.process_templates; p jsonb; v jsonb;
begin
  perform public._require_role(_org, '{administrador,encargado_beneficio}');
  if coalesce(trim(_name),'') = '' then raise exception 'La plantilla necesita un nombre' using errcode='22023'; end if;
  if jsonb_typeof(_phases) <> 'array' or jsonb_array_length(_phases) = 0 then raise exception 'La plantilla necesita al menos una fase' using errcode='22023'; end if;
  for p in select * from jsonb_array_elements(_phases) loop
    if coalesce(trim(p->>'name'),'') = '' then raise exception 'Cada fase necesita un nombre' using errcode='22023'; end if;
    for v in select * from jsonb_array_elements(coalesce(p->'variables','[]')) loop
      if coalesce(v->>'key','') !~ '^[a-z0-9_]{1,40}$' then raise exception 'Clave de variable inválida' using errcode='22023'; end if;
      if (v ? 'min') and (v ? 'max') and (v->>'min')::numeric > (v->>'max')::numeric then raise exception 'Rango inválido en %', v->>'key' using errcode='22023'; end if;
    end loop;
  end loop;
  if _template is not null then
    select * into old from public.process_templates where id = _template and organization_id = _org for update;
    if not found then raise exception 'Plantilla no encontrada' using errcode='P0002'; end if;
    update public.process_templates set active = false where coalesce(root_id, id) = coalesce(old.root_id, old.id) and organization_id = _org;
  end if;
  insert into public.process_templates (organization_id, name, process_type, description, phases, version, root_id, is_custom, active)
  values (_org, trim(_name), coalesce(nullif(_process_type,''),'personalizado'), _description, _phases,
    coalesce(old.version, 0) + 1, coalesce(old.root_id, old.id), coalesce(old.is_custom, true), true)
  returning * into t;
  if t.root_id is null then update public.process_templates set root_id = id where id = t.id returning * into t; end if;
  return t;
end $$;

-- ===== Process phases: real instances with operator, timestamps, weights =====
alter table public.process_phases
  add column template_id uuid references public.process_templates(id),
  add column template_version int,
  add column phase_key text,
  add column weight_in_kg numeric check (weight_in_kg is null or (weight_in_kg >= 0 and weight_in_kg < 10000000)),
  add column weight_out_kg numeric check (weight_out_kg is null or (weight_out_kg >= 0 and weight_out_kg < 10000000)),
  add column physical_state_after text,
  add column operator_id uuid default auth.uid(),
  add column closed_by uuid,
  add column variables jsonb not null default '[]'::jsonb;
create unique index process_phases_one_running on public.process_phases(lot_id) where status in ('running','paused');
create trigger same_org_refs_tpl before insert or update on public.process_phases for each row execute function public._same_org_refs('template_id:process_templates');

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete cascade,
  phase_id uuid references public.process_phases(id) on delete cascade,
  kind text not null, severity text not null default 'warning' check (severity in ('info','warning','critical')),
  message text not null,
  created_at timestamptz not null default now(), resolved_at timestamptz, resolved_by uuid
);
grant select on public.alerts to authenticated;
grant all on public.alerts to service_role;
alter table public.alerts enable row level security;
create policy "members read" on public.alerts for select to authenticated using (public.is_org_member(organization_id));
create trigger same_org_refs before insert or update on public.alerts for each row execute function public._same_org_refs('lot_id:lots','phase_id:process_phases');

-- previous direct-write policy on phases/variable_logs is replaced by functions
drop policy if exists "role insert" on public.process_phases;
drop policy if exists "role update" on public.process_phases;
drop policy if exists "role insert" on public.variable_logs;
drop policy if exists "role update" on public.variable_logs;
revoke insert, update on public.process_phases, public.variable_logs from authenticated;

create or replace function public.start_phase(_lot uuid, _name text, _template uuid default null, _phase_key text default null,
  _expected_minutes int default null, _op_key text default null)
returns public.process_phases language plpgsql security definer set search_path = public as $$
declare l public.lots; t public.process_templates; p public.process_phases; prev jsonb; vars jsonb := '[]'; ph jsonb; n int;
begin
  select * into l from public.lots where id = _lot for update;
  if not found then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform public._require_role(l.organization_id, '{administrador,encargado_beneficio}');
  prev := public._op_get(l.organization_id, _op_key, 'start_phase');
  if prev is not null then select * into p from public.process_phases where id = (prev->>'id')::uuid; return p; end if;
  if exists (select 1 from public.process_phases where lot_id = _lot and status in ('running','paused')) then
    raise exception 'El lote ya tiene una fase en curso; ciérrela primero' using errcode='55000'; end if;
  if _template is not null then
    select * into t from public.process_templates where id = _template and organization_id = l.organization_id;
    if not found then raise exception 'Referencia inválida: plantilla' using errcode='42501'; end if;
    select e into ph from jsonb_array_elements(t.phases) e where e->>'name' = coalesce(_phase_key, _name) limit 1;
    vars := coalesce(ph->'variables', '[]');
  end if;
  if _expected_minutes is not null and (_expected_minutes < 0 or _expected_minutes > 525600) then raise exception 'Duración inválida' using errcode='22023'; end if;
  select count(*) into n from public.process_phases where lot_id = _lot;
  insert into public.process_phases (organization_id, lot_id, name, order_index, status, started_at, expected_minutes,
    template_id, template_version, phase_key, weight_in_kg, variables, operator_id, responsible_user_id)
  values (l.organization_id, _lot, coalesce(nullif(trim(_name),''), 'Fase'), n, 'running', now(),
    coalesce(_expected_minutes, nullif(ph->>'expected_minutes','')::int), _template, t.version, coalesce(_phase_key, _name),
    l.qty_current_kg, vars, auth.uid(), auth.uid())
  returning * into p;
  perform public.write_audit(l.organization_id, 'process_phases', p.id::text, 'start', to_jsonb(p));
  perform public._op_put(l.organization_id, _op_key, 'start_phase', jsonb_build_object('id', p.id));
  return p;
end $$;

create or replace function public.log_phase_variable(_phase uuid, _key text, _value numeric, _unit text default null, _notes text default null, _op_key text default null)
returns public.variable_logs language plpgsql security definer set search_path = public as $$
declare p public.process_phases; v jsonb; vl public.variable_logs; inrange boolean := true; prev jsonb; mn numeric; mx numeric;
begin
  select * into p from public.process_phases where id = _phase;
  if not found then raise exception 'Fase no encontrada' using errcode='P0002'; end if;
  perform public._require_role(p.organization_id, '{administrador,encargado_beneficio}');
  prev := public._op_get(p.organization_id, _op_key, 'log_phase_variable');
  if prev is not null then select * into vl from public.variable_logs where id = (prev->>'id')::uuid; return vl; end if;
  if p.status = 'finished' then raise exception 'La fase ya está cerrada' using errcode='55000'; end if;
  if coalesce(_key,'') !~ '^[a-z0-9_]{1,40}$' then raise exception 'Variable inválida' using errcode='22023'; end if;
  if _value is null or _value = 'NaN'::numeric or abs(_value) >= 1000000 then raise exception 'Valor inválido' using errcode='22023'; end if;
  select e into v from jsonb_array_elements(p.variables) e where e->>'key' = _key limit 1;
  mn := nullif(v->>'min','')::numeric; mx := nullif(v->>'max','')::numeric;
  if (mn is not null and _value < mn) or (mx is not null and _value > mx) then inrange := false; end if;
  if _key = 'humedad' and (_value <= 0 or _value > 100) then raise exception 'Humedad inválida' using errcode='22023'; end if;
  insert into public.variable_logs (organization_id, lot_id, phase_id, value_number, value, notes)
  values (p.organization_id, p.lot_id, p.id, _value,
    jsonb_build_object('key', _key, 'label', coalesce(v->>'label', _key), 'unit', coalesce(_unit, v->>'unit'), 'min', mn, 'max', mx, 'in_range', inrange), _notes)
  returning * into vl;
  if _key = 'humedad' then
    insert into public.moisture_logs (organization_id, lot_id, moisture_pct, notes) values (p.organization_id, p.lot_id, _value, _notes);
    update public.lots set current_moisture = _value, updated_at = now() where id = p.lot_id;
  end if;
  if not inrange then
    insert into public.alerts (organization_id, lot_id, phase_id, kind, severity, message)
    values (p.organization_id, p.lot_id, p.id, 'variable_fuera_de_rango', 'warning',
      format('%s = %s %s fuera de rango (%s–%s) en %s', coalesce(v->>'label', _key), _value, coalesce(_unit, v->>'unit', ''), coalesce(mn::text,'–'), coalesce(mx::text,'–'), p.name));
  end if;
  perform public.write_audit(p.organization_id, 'variable_logs', vl.id::text, 'create', to_jsonb(vl));
  perform public._op_put(p.organization_id, _op_key, 'log_phase_variable', jsonb_build_object('id', vl.id));
  return vl;
end $$;

-- Closing a phase: measured output weight; the difference is recorded as real process waste.
create or replace function public.close_phase(_phase uuid, _weight_out_kg numeric, _physical_state text default null,
  _notes text default null, _op_key text default null)
returns public.process_phases language plpgsql security definer set search_path = public as $$
declare p public.process_phases; l public.lots; diff numeric; w public.waste_logs; prev jsonb; movable numeric;
begin
  select * into p from public.process_phases where id = _phase;
  if not found then raise exception 'Fase no encontrada' using errcode='P0002'; end if;
  select * into l from public.lots where id = p.lot_id for update;
  select * into p from public.process_phases where id = _phase for update;
  perform public._require_role(p.organization_id, '{administrador,encargado_beneficio}');
  prev := public._op_get(p.organization_id, _op_key, 'close_phase');
  if prev is not null then return p; end if;
  if p.status = 'finished' then raise exception 'La fase ya está cerrada' using errcode='55000'; end if;
  if _weight_out_kg is null or _weight_out_kg = 'NaN'::numeric or _weight_out_kg < 0 or _weight_out_kg >= 10000000 then
    raise exception 'Peso de salida inválido' using errcode='22023'; end if;
  if _physical_state is not null and _physical_state not in ('cereza','despulpado','fermentado','lavado','mucilago','pergamino_humedo','pergamino_seco','oro','tostado','descarte') then
    raise exception 'Estado físico inválido' using errcode='22023'; end if;
  if _weight_out_kg > l.qty_current_kg then
    raise exception 'El peso de salida (% kg) supera el peso actual del lote (% kg); use un ajuste justificado', _weight_out_kg, l.qty_current_kg using errcode='23514'; end if;
  diff := l.qty_current_kg - _weight_out_kg;
  movable := l.qty_current_kg - l.qty_reserved_kg - l.qty_committed_kg;
  if diff > movable then raise exception 'La diferencia (% kg) consumiría café reservado o comprometido', diff using errcode='23514'; end if;
  if diff > 0 then
    update public.lots set qty_current_kg = _weight_out_kg,
      qty_blocked_kg = least(qty_blocked_kg, _weight_out_kg - qty_reserved_kg - qty_committed_kg), updated_at = now() where id = l.id;
    insert into public.waste_logs (organization_id, lot_id, waste_type, destination, qty_kg, reason, notes)
      values (p.organization_id, l.id, 'proceso', 'descarte', diff, format('Diferencia de pesaje al cerrar %s (%s → %s kg)', p.name, l.qty_current_kg, _weight_out_kg), _notes)
      returning * into w;
    insert into public.stock_movements (organization_id, lot_id, movement_type, qty_kg, reason, reference_id)
      values (p.organization_id, l.id, 'merma', -diff, 'Cierre de fase ' || p.name, w.id);
  end if;
  if _physical_state is not null then update public.lots set physical_state = _physical_state, updated_at = now() where id = l.id; end if;
  update public.process_phases set status = 'finished', ended_at = now(), weight_out_kg = _weight_out_kg,
    physical_state_after = _physical_state, closed_by = auth.uid(), notes = coalesce(_notes, notes) where id = _phase returning * into p;
  perform public.write_audit(p.organization_id, 'process_phases', p.id::text, 'close', jsonb_build_object('weight_in', p.weight_in_kg, 'weight_out', _weight_out_kg, 'waste_kg', diff, 'state', _physical_state));
  perform public._op_put(p.organization_id, _op_key, 'close_phase', jsonb_build_object('id', p.id));
  return p;
end $$;

-- Phases overdue vs expected duration, or fermenting more than 20 days.
create or replace function public.overdue_phases(_org uuid)
returns table (phase_id uuid, lot_id uuid, lot_code text, phase_name text, started_at timestamptz, elapsed_days numeric, expected_minutes int, reason text)
language sql stable security definer set search_path = public as $$
  select p.id, l.id, l.lot_code, p.name, p.started_at, round(extract(epoch from now() - p.started_at)/86400.0, 1), p.expected_minutes,
    case when p.name ilike '%ferment%' and now() - p.started_at > interval '20 days' then 'Fermentando más de 20 días'
         else 'Supera la duración esperada' end
  from public.process_phases p join public.lots l on l.id = p.lot_id
  where p.organization_id = _org and public.is_org_member(_org) and p.status in ('running','paused')
    and ((p.expected_minutes is not null and now() - p.started_at > make_interval(mins => p.expected_minutes))
      or (p.name ilike '%ferment%' and now() - p.started_at > interval '20 days'))
  order by p.started_at
$$;

-- ===== Files (photos per phase, documents, certificates, contracts) =====
create table public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lot_id uuid references public.lots(id) on delete cascade,
  phase_id uuid references public.process_phases(id) on delete set null,
  kind text not null check (kind in ('photo','document','certificate','contract')),
  title text not null check (length(trim(title)) between 1 and 200),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  public_selected boolean not null default false,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint files_contract_never_public check (not (kind = 'contract' and public_selected)),
  constraint files_path_in_org check (split_part(storage_path, '/', 1) = organization_id::text)
);
grant select, insert, update, delete on public.files to authenticated;
grant all on public.files to service_role;
alter table public.files enable row level security;
create policy "members read" on public.files for select to authenticated using (public.is_org_member(organization_id));
create policy "role insert" on public.files for insert to authenticated
  with check (public.has_org_role(organization_id, '{administrador,encargado_beneficio,comercial,productor}') and uploaded_by = auth.uid());
create policy "role update" on public.files for update to authenticated
  using (public.has_org_role(organization_id, '{administrador,comercial}')) with check (public.has_org_role(organization_id, '{administrador,comercial}'));
create policy "admin delete" on public.files for delete to authenticated using (public.has_org_role(organization_id, '{administrador}'));
create trigger same_org_refs before insert or update on public.files for each row execute function public._same_org_refs('lot_id:lots','phase_id:process_phases');
create trigger audit_files after insert or update or delete on public.files for each row execute function public.audit_row();

create or replace function public._org_from_path(_name text)
returns uuid language plpgsql immutable as $$
begin return split_part(_name, '/', 1)::uuid; exception when others then return null; end $$;

-- Storage policies for the private bucket "lot-files" (path: <org_id>/<...>)
create policy "lot-files members read" on storage.objects for select to authenticated
  using (bucket_id = 'lot-files' and public.is_org_member(public._org_from_path(name)));
create policy "lot-files role upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'lot-files' and public.has_org_role(public._org_from_path(name), '{administrador,encargado_beneficio,comercial,productor}'));
create policy "lot-files admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'lot-files' and public.has_org_role(public._org_from_path(name), '{administrador}'));

-- ===== Public traceability (QR) =====
alter table public.lot_public_profiles
  add column public_token text not null default replace(gen_random_uuid()::text, '-', ''),
  add column published_at timestamptz;
alter table public.lot_public_profiles add constraint lot_public_profiles_token_unique unique (public_token);

create table public.sacks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  seq int not null check (seq > 0),
  sack_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  weight_kg numeric check (weight_kg is null or (weight_kg > 0 and weight_kg < 1000)),
  created_at timestamptz not null default now(), created_by uuid default auth.uid(),
  unique (lot_id, seq)
);
grant select on public.sacks to authenticated;
grant all on public.sacks to service_role;
alter table public.sacks enable row level security;
create policy "members read" on public.sacks for select to authenticated using (public.is_org_member(organization_id));
create trigger same_org_refs before insert or update on public.sacks for each row execute function public._same_org_refs('lot_id:lots');

create or replace function public.create_sacks(_lot uuid, _count int, _weight_kg numeric default null)
returns setof public.sacks language plpgsql security definer set search_path = public as $$
declare l public.lots; start int; i int; s public.sacks;
begin
  select * into l from public.lots where id = _lot for update;
  if not found then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform public._require_role(l.organization_id, '{administrador,encargado_beneficio,comercial}');
  if _count is null or _count < 1 or _count > 500 then raise exception 'Cantidad de sacos inválida (1–500)' using errcode='22023'; end if;
  if _weight_kg is not null and (_weight_kg = 'NaN'::numeric or _weight_kg <= 0 or _weight_kg >= 1000) then raise exception 'Peso por saco inválido' using errcode='22023'; end if;
  if _weight_kg is not null and _count * _weight_kg + (select coalesce(sum(weight_kg),0) from public.sacks where lot_id = _lot)
       > l.qty_current_kg + l.qty_sold_kg then
    raise exception 'Los sacos suman más kg que el lote' using errcode='23514'; end if;
  select coalesce(max(seq),0) into start from public.sacks where lot_id = _lot;
  for i in 1.._count loop
    insert into public.sacks (organization_id, lot_id, seq, weight_kg) values (l.organization_id, _lot, start + i, _weight_kg) returning * into s;
    return next s;
  end loop;
  perform public.write_audit(l.organization_id, 'sacks', _lot::text, 'create', jsonb_build_object('count', _count, 'weight_kg', _weight_kg));
end $$;

create or replace function public.publish_lot(_lot uuid, _is_public boolean, _short_story text default null,
  _tasting_notes text default null, _visibility jsonb default null)
returns public.lot_public_profiles language plpgsql security definer set search_path = public as $$
declare l public.lots; p public.lot_public_profiles;
begin
  select * into l from public.lots where id = _lot;
  if not found then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform public._require_role(l.organization_id, '{administrador,comercial}');
  insert into public.lot_public_profiles (lot_id, organization_id, is_public, short_story, tasting_notes, visibility, published_at)
  values (_lot, l.organization_id, coalesce(_is_public,false), _short_story, _tasting_notes, coalesce(_visibility,'{}'), case when _is_public then now() end)
  on conflict (lot_id) do update set is_public = coalesce(_is_public,false),
    short_story = coalesce(excluded.short_story, lot_public_profiles.short_story),
    tasting_notes = coalesce(excluded.tasting_notes, lot_public_profiles.tasting_notes),
    visibility = coalesce(_visibility, lot_public_profiles.visibility),
    published_at = case when _is_public then coalesce(lot_public_profiles.published_at, now()) else null end, updated_at = now()
  returning * into p;
  perform public.write_audit(l.organization_id, 'lot_public_profiles', _lot::text, case when _is_public then 'publish' else 'unpublish' end, to_jsonb(p));
  return p;
end $$;

-- Limited public projection. Returns NULL for unknown OR unpublished tokens (both become 404).
-- Never includes stock, customers, reservations, prices or contracts.
create or replace function public.public_lot_view(_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pp public.lot_public_profiles; l public.lots; f public.farms; pc public.parcels; vis jsonb; res jsonb;
begin
  if _token is null or _token !~ '^[a-f0-9]{32}$' then return null; end if;
  select * into pp from public.lot_public_profiles where public_token = _token and is_public;
  if not found then return null; end if;
  select * into l from public.lots where id = pp.lot_id;
  select * into f from public.farms where id = l.farm_id;
  select * into pc from public.parcels where id = l.parcel_id;
  vis := coalesce(pp.visibility, '{}');
  res := jsonb_build_object(
    'lot_code', l.lot_code, 'name', l.friendly_name, 'variety', nullif(l.variety,''), 'process', l.process_type,
    'physical_state', l.physical_state,
    'story', pp.short_story, 'tasting_notes', pp.tasting_notes,
    'farm', case when coalesce((vis->>'farm')::boolean, true) and f.id is not null then jsonb_build_object('name', f.name, 'region', f.region, 'country', f.country, 'altitude_m', f.altitude_m) end,
    'parcel', case when coalesce((vis->>'parcel')::boolean, true) and pc.id is not null then jsonb_build_object('name', pc.name, 'altitude_m', pc.altitude_m) end,
    'producer', case when coalesce((vis->>'producer')::boolean, true) then f.owner_name end,
    'harvest', (select jsonb_build_object('first', min(t.harvest_date), 'last', max(t.harvest_date), 'season', max(t.season))
                from public.harvest_tickets t where t.lot_id = l.id or t.id = l.harvest_ticket_id),
    'phases', (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'started_at', p.started_at, 'ended_at', p.ended_at) order by p.started_at), '[]')
               from public.process_phases p where p.lot_id = l.id),
    'measurements', case when coalesce((vis->>'measurements')::boolean, false) then
      (select coalesce(jsonb_agg(jsonb_build_object('label', v.value->>'label', 'value', v.value_number, 'unit', v.value->>'unit', 'at', v.measured_at) order by v.measured_at), '[]')
       from public.variable_logs v where v.lot_id = l.id) end,
    'moisture', case when coalesce((vis->>'moisture')::boolean, true) then l.current_moisture end,
    'quality', case when coalesce((vis->>'quality')::boolean, true) then
      (select jsonb_build_object('score', q.score, 'notes', q.data->>'notes', 'at', q.sampled_at) from public.quality_samples q
       where q.lot_id = l.id and q.status = 'aprobado' order by q.sampled_at desc limit 1) end,
    'files', (select coalesce(jsonb_agg(jsonb_build_object('id', fl.id, 'kind', fl.kind, 'title', fl.title, 'path', fl.storage_path, 'mime', fl.mime_type)), '[]')
              from public.files fl where fl.lot_id = l.id and fl.public_selected and fl.kind <> 'contract'),
    'exported_at', now());
  return res;
end $$;

create or replace function public.public_sack_view(_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.sacks; tok text; lot jsonb;
begin
  if _token is null or _token !~ '^[a-f0-9]{32}$' then return null; end if;
  select * into s from public.sacks where sack_token = _token;
  if not found then return null; end if;
  select public_token into tok from public.lot_public_profiles where lot_id = s.lot_id and is_public;
  if tok is null then return null; end if;
  lot := public.public_lot_view(tok);
  if lot is null then return null; end if;
  return jsonb_build_object('sack', jsonb_build_object('seq', s.seq, 'weight_kg', s.weight_kg, 'created_at', s.created_at), 'lot', lot, 'lot_token', tok);
end $$;

-- ===== Report snapshots shared on purpose (expiring, revocable) =====
create table public.report_shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  title text not null check (length(trim(title)) between 1 and 200),
  payload jsonb not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
grant select on public.report_shares to authenticated;
grant all on public.report_shares to service_role;
alter table public.report_shares enable row level security;
create policy "members read" on public.report_shares for select to authenticated using (public.is_org_member(organization_id));

create or replace function public.publish_report_snapshot(_org uuid, _title text, _payload jsonb, _days int default 7)
returns public.report_shares language plpgsql security definer set search_path = public as $$
declare s public.report_shares;
begin
  perform public._require_role(_org, '{administrador,comercial}');
  if _days is null or _days < 1 or _days > 90 then raise exception 'Vigencia inválida (1–90 días)' using errcode='22023'; end if;
  if jsonb_typeof(_payload) <> 'object' or length(_payload::text) > 500000 then raise exception 'Contenido inválido' using errcode='22023'; end if;
  insert into public.report_shares (organization_id, title, payload, expires_at) values (_org, trim(_title), _payload, now() + make_interval(days => _days)) returning * into s;
  perform public.write_audit(_org, 'report_shares', s.id::text, 'publish', jsonb_build_object('title', _title, 'expires_at', s.expires_at));
  return s;
end $$;
create or replace function public.revoke_report_snapshot(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.report_shares;
begin
  select * into s from public.report_shares where id = _id for update;
  if not found then raise exception 'Enlace no encontrado' using errcode='P0002'; end if;
  perform public._require_role(s.organization_id, '{administrador,comercial}');
  update public.report_shares set revoked_at = now() where id = _id and revoked_at is null;
  perform public.write_audit(s.organization_id, 'report_shares', _id::text, 'revoke', null);
end $$;
create or replace function public.public_report_snapshot(_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('title', title, 'payload', payload, 'created_at', created_at, 'expires_at', expires_at)
  from public.report_shares where _token ~ '^[a-f0-9]{32}$' and token = _token and revoked_at is null and expires_at > now()
$$;

-- ===== Sales summary: kg delivered and price weighted by delivered kg, per currency =====
create or replace function public.sales_summary(_org uuid, _from timestamptz, _to timestamptz)
returns table (currency text, deliveries bigint, kg_delivered numeric, kg_priced numeric, weighted_price_per_kg numeric)
language sql stable security definer set search_path = public as $$
  select coalesce(r.currency, 'sin precio'), count(*), sum(r.qty_kg),
    sum(r.qty_kg) filter (where r.price is not null),
    round(sum(r.price * r.qty_kg) filter (where r.price is not null) / nullif(sum(r.qty_kg) filter (where r.price is not null), 0), 4)
  from public.reservations r
  where r.organization_id = _org and public.is_org_member(_org) and r.status = 'entregada'
    and r.delivered_at >= _from and r.delivered_at < _to
  group by coalesce(r.currency, 'sin precio')
$$;

-- ===== Organizations: demo flag + list of my memberships =====
alter table public.organizations add column is_demo boolean not null default false;
create or replace function public.my_memberships()
returns table (organization_id uuid, organization_name text, role public.app_role, is_demo boolean)
language sql stable security definer set search_path = public as $$
  select m.organization_id, o.name, m.role, o.is_demo from public.memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid() and m.active order by o.is_demo, m.created_at
$$;

-- Admin-only: creates a separate demo organization with sample data. Touches no existing org or user.
create or replace function public.create_demo_environment()
returns uuid language plpgsql security definer set search_path = public as $$
declare org uuid; farm uuid; parcel uuid; cust uuid; res jsonb; l public.lots; r public.reservations; ph public.process_phases; tpl uuid;
begin
  if auth.uid() is null or not exists (select 1 from public.memberships where user_id = auth.uid() and role = 'administrador' and active) then
    raise exception 'Permiso denegado' using errcode='42501'; end if;
  insert into public.organizations (name, is_demo, region) values ('Demo evaluación ' || to_char(now(),'DD/MM HH24:MI'), true, 'Tarrazú') returning id into org;
  insert into public.memberships (organization_id, user_id, role) values (org, auth.uid(), 'administrador');
  perform public._seed_process_templates(org);
  insert into public.units (organization_id, name, symbol, kg_factor, is_configurable) values (org, 'Cajuela', 'cajuela', 12.5, true), (org, 'Fanega', 'fanega', 250, true);
  insert into public.farms (organization_id, name, region, owner_name, altitude_m) values (org, 'Finca La Esperanza (demo)', 'Tarrazú', 'Productor demo', 1650) returning id into farm;
  insert into public.parcels (organization_id, farm_id, name, variety, altitude_m) values (org, farm, 'Lote Alto', 'Caturra', 1700) returning id into parcel;
  insert into public.customers (organization_id, name, type, country) values (org, 'Tostador Demo', 'tostador', 'Costa Rica') returning id into cust;
  res := public.register_harvest(org, jsonb_build_object('farm_id', farm, 'parcel_id', parcel, 'variety', 'Caturra', 'harvest_date', current_date - 30,
    'qty', 40, 'uom', 'cajuela', 'season', '2025-2026', 'cut_type', 'corte', 'workers', '["Ana","Luis","Marta"]', 'responsible', 'Encargado demo', 'initial_quality', 'madura'), null, 'Caturra lavado demo');
  select id into tpl from public.process_templates where organization_id = org and process_type = 'lavado' limit 1;
  ph := public.start_phase((res->>'lot_id')::uuid, 'Fermentación', tpl, 'Fermentación');
  perform public.log_phase_variable(ph.id, 'ph', 4.6);
  perform public.log_phase_variable(ph.id, 'temperatura', 31);
  perform public.close_phase(ph.id, 470, 'pergamino_humedo', 'Demo');
  l := public.release_lot_for_sale((res->>'lot_id')::uuid, 'Demo');
  r := public.create_reservation(l.id, cust, 100, 6.5, 'USD');
  perform public.confirm_reservation(r.id);
  perform public.deliver_reservation(r.id);
  perform public.create_reservation(l.id, cust, 50, 7.0, 'USD', now() + interval '10 days');
  res := public.register_harvest(org, jsonb_build_object('farm_id', farm, 'parcel_id', parcel, 'variety', 'Geisha', 'harvest_date', current_date - 25,
    'qty', 300, 'uom', 'kg', 'season', '2025-2026', 'cut_type', 'pasilla', 'worker_count', 2, 'responsible', 'Encargado demo'), null, 'Geisha anaeróbico demo');
  select id into tpl from public.process_templates where organization_id = org and process_type = 'anaerobico' limit 1;
  perform public.start_phase((res->>'lot_id')::uuid, 'Fermentación anaeróbica', tpl, 'Fermentación anaeróbica', 60);
  update public.process_phases set started_at = now() - interval '22 days' where lot_id = (res->>'lot_id')::uuid;
  perform public.publish_lot(l.id, true, 'Lote de demostración cultivado a 1700 m.', 'Chocolate, cítricos', '{"measurements": true}');
  return org;
end $$;

-- ===== Grants for new functions =====
revoke execute on function public._op_get(uuid, text, text) from public, anon, authenticated;
revoke execute on function public._op_put(uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public._same_org_refs() from public, anon, authenticated;
revoke execute on function public._lots_derive_state() from public, anon, authenticated;
revoke execute on function public._seed_process_templates(uuid) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['release_lot_for_sale(uuid,text)',
    'create_lot(uuid,text,numeric,uuid,uuid,text,text,text,uuid,text)',
    'create_reservation(uuid,uuid,numeric,numeric,text,timestamptz,text,text,text)',
    'deliver_reservation(uuid,text,text)', 'register_harvest(uuid,jsonb,uuid,text,text)',
    'save_process_template(uuid,uuid,text,text,text,jsonb)', 'start_phase(uuid,text,uuid,text,int,text)',
    'log_phase_variable(uuid,text,numeric,text,text,text)', 'close_phase(uuid,numeric,text,text,text)',
    'overdue_phases(uuid)', 'create_sacks(uuid,int,numeric)', 'publish_lot(uuid,boolean,text,text,jsonb)',
    'publish_report_snapshot(uuid,text,jsonb,int)', 'revoke_report_snapshot(uuid)', 'sales_summary(uuid,timestamptz,timestamptz)',
    'my_memberships()', 'create_demo_environment()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['public_lot_view(text)', 'public_sack_view(text)', 'public_report_snapshot(text)'] loop
    execute format('revoke execute on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

alter publication supabase_realtime add table public.process_phases, public.alerts, public.harvest_tickets;
