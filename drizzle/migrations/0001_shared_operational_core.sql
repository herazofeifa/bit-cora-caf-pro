-- ===== Organizations & memberships =====
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null default 'Costa Rica',
  region text,
  created_at timestamptz not null default now()
);
create table public.memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role public.app_role not null default 'consulta',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id);
grant select on public.organizations to authenticated;
grant all on public.organizations to service_role;
grant select on public.memberships to authenticated;
grant all on public.memberships to service_role;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

create or replace function public.is_org_member(_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where organization_id = _org and user_id = auth.uid() and active)
$$;
create or replace function public.has_org_role(_org uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships where organization_id = _org and user_id = auth.uid() and active and role = any(_roles))
$$;

create policy "members read org" on public.organizations for select to authenticated using (public.is_org_member(id));
create policy "members read memberships" on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.has_org_role(organization_id, array['administrador']::public.app_role[]));

-- Initial microbeneficio + memberships for existing admins (backfill)
insert into public.organizations (name, region) values ('Microbeneficio', 'Tarrazú');
insert into public.memberships (organization_id, user_id, role)
  select (select id from public.organizations order by created_at limit 1), ur.user_id, ur.role
  from public.user_roles ur
  on conflict do nothing;

-- New users: profile + 'consulta' role only. No automatic administrator.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.email);
  insert into public.user_roles (user_id, role) values (new.id, 'consulta');
  return new;
end $$;

-- ===== Audit (append-only) =====
create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid default auth.uid(),
  entity text not null,
  entity_id text not null,
  action text not null,
  diff jsonb,
  created_at timestamptz not null default now()
);
create index audit_org_idx on public.audit_log(organization_id, created_at desc);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "members read audit" on public.audit_log for select to authenticated using (public.is_org_member(organization_id));

create or replace function public.audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_log es solo de agregado'; end $$;
create trigger audit_no_update before update or delete on public.audit_log
  for each row execute function public.audit_immutable();

create or replace function public.write_audit(_org uuid, _entity text, _id text, _action text, _diff jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (organization_id, actor_id, entity, entity_id, action, diff, created_at)
  values (_org, auth.uid(), _entity, _id, _action, _diff, now())
$$;
revoke execute on function public.write_audit(uuid, text, text, text, jsonb) from public, anon, authenticated;

-- Generic audit trigger for directly-editable tables
create or replace function public.audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  perform public.write_audit(r.organization_id, tg_table_name, r.id::text, lower(tg_op),
    case when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)) else to_jsonb(r) end);
  return r;
end $$;

-- ===== Catalogs =====
create table public.org_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.farms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  region text, country text not null default 'Costa Rica', owner_name text,
  altitude_m numeric check (altitude_m is null or altitude_m between 0 and 6000),
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.parcels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  variety text, altitude_m numeric, area_ha numeric check (area_ha is null or area_ha >= 0), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, symbol text not null, unit_type text not null default 'weight',
  kg_factor numeric check (kg_factor is null or kg_factor > 0), liters_factor numeric,
  is_configurable boolean not null default false, notes text,
  unique (organization_id, symbol)
);
create table public.process_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, process_type text not null, description text,
  phases jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create table public.variable_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, unit text, value_type text not null, category text not null default 'general',
  config jsonb not null default '{}'::jsonb, active boolean not null default true
);
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  type text not null default 'tostador',
  contact_name text, phone text, email text, country text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ===== Field & lots =====
create table public.harvest_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('harvest','intake')),
  farm_id uuid not null references public.farms(id),
  parcel_id uuid references public.parcels(id),
  producer_name text, harvest_date date not null, intake_datetime timestamptz not null default now(),
  variety text,
  qty_original numeric not null check (qty_original > 0 and qty_original <> 'NaN'),
  uom_original text not null,
  qty_kg numeric check (qty_kg is null or (qty_kg > 0 and qty_kg <> 'NaN')),
  conversion_factor_to_kg numeric, conversion_basis text not null default 'configured',
  data jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);

create table public.lot_sequences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  prefix text not null, year int not null, last_value int not null default 0,
  primary key (organization_id, prefix, year)
);
revoke all on public.lot_sequences from anon, authenticated;
grant all on public.lot_sequences to service_role;
alter table public.lot_sequences enable row level security;

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lot_code text not null,
  friendly_name text not null,
  farm_id uuid references public.farms(id),
  parcel_id uuid references public.parcels(id),
  harvest_ticket_id uuid references public.harvest_tickets(id),
  parent_lot_id uuid references public.lots(id),
  variety text not null default '',
  process_type text not null default 'lavado',
  physical_state text not null default 'cereza',
  commercial_state text not null default 'en_proceso',
  quality_status text not null default 'sin_evaluar',
  qty_initial_kg numeric not null check (qty_initial_kg >= 0 and qty_initial_kg <> 'NaN'),
  qty_current_kg numeric not null check (qty_current_kg >= 0 and qty_current_kg <> 'NaN'),
  qty_reserved_kg numeric not null default 0 check (qty_reserved_kg >= 0 and qty_reserved_kg <> 'NaN'),
  qty_committed_kg numeric not null default 0 check (qty_committed_kg >= 0 and qty_committed_kg <> 'NaN'),
  qty_blocked_kg numeric not null default 0 check (qty_blocked_kg >= 0 and qty_blocked_kg <> 'NaN'),
  qty_sold_kg numeric not null default 0 check (qty_sold_kg >= 0 and qty_sold_kg <> 'NaN'),
  stock_safety_kg numeric not null default 0 check (stock_safety_kg >= 0 and stock_safety_kg <> 'NaN'),
  qty_free_kg numeric generated always as
    (greatest(0, qty_current_kg - qty_reserved_kg - qty_committed_kg - qty_blocked_kg - stock_safety_kg)) stored,
  current_moisture numeric check (current_moisture is null or current_moisture between 0 and 100),
  current_location text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, lot_code),
  constraint lots_allocations_fit check (qty_reserved_kg + qty_committed_kg + qty_blocked_kg <= qty_current_kg)
);
create table public.lot_links (
  parent_lot_id uuid not null references public.lots(id) on delete cascade,
  child_lot_id uuid not null references public.lots(id) on delete cascade,
  kind text not null check (kind in ('split','merge')),
  qty_kg numeric not null check (qty_kg > 0),
  created_at timestamptz not null default now(),
  primary key (parent_lot_id, child_lot_id)
);
create table public.process_phases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  name text not null, order_index int not null default 0,
  status text not null default 'running' check (status in ('running','paused','finished')),
  started_at timestamptz not null default now(), ended_at timestamptz, paused_at timestamptz,
  total_paused_minutes int not null default 0, expected_minutes int,
  location text, notes text, responsible_user_id uuid
);
create table public.variable_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  variable_id uuid references public.variable_definitions(id),
  phase_id uuid references public.process_phases(id),
  value_number numeric check (value_number is null or value_number <> 'NaN'),
  value jsonb, measured_at timestamptz not null default now(), measured_by uuid default auth.uid(), notes text
);
create table public.moisture_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  moisture_pct numeric not null check (moisture_pct > 0 and moisture_pct <= 100),
  measured_at timestamptz not null default now(), measured_by uuid default auth.uid(), device text, notes text
);
create table public.waste_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  waste_type text not null, destination text not null default 'descarte',
  qty_kg numeric not null check (qty_kg > 0 and qty_kg <> 'NaN'),
  reason text not null check (length(trim(reason)) > 0),
  registered_at timestamptz not null default now(), created_by uuid default auth.uid(), notes text
);
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lot_id uuid not null references public.lots(id),
  customer_id uuid not null references public.customers(id),
  qty_kg numeric not null check (qty_kg > 0 and qty_kg <> 'NaN'),
  price numeric check (price is null or (price >= 0 and price <> 'NaN')), currency text,
  status text not null default 'reservada' check (status in ('reservada','confirmada','entregada','cancelada','vencida')),
  reserved_at timestamptz not null default now(), expires_at timestamptz,
  confirmed_at timestamptz, delivered_at timestamptz, released_at timestamptz,
  notes text, created_by uuid default auth.uid()
);
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  movement_type text not null,
  qty_kg numeric not null check (qty_kg <> 'NaN'),
  reason text, reference_id uuid,
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
create table public.quality_samples (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete cascade,
  status text not null check (status in ('pendiente','aprobado','bloqueado','rechazado','requiere_reproceso')),
  score numeric check (score is null or score between 0 and 100),
  moisture_pct numeric, water_activity numeric, data jsonb not null default '{}'::jsonb,
  sampled_at timestamptz not null default now(), created_by uuid default auth.uid()
);
create table public.lot_public_profiles (
  lot_id uuid primary key references public.lots(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  is_public boolean not null default false,
  short_story text, tasting_notes text,
  visibility jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ===== Grants, RLS, policies =====
do $$
declare t text;
begin
  foreach t in array array['org_settings','farms','parcels','units','process_templates','variable_definitions','customers',
    'harvest_tickets','lots','lot_links','process_phases','variable_logs','moisture_logs','waste_logs','reservations',
    'stock_movements','quality_samples','lot_public_profiles'] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- read: members (lot_links via parent lot)
do $$
declare t text;
begin
  foreach t in array array['org_settings','farms','parcels','units','process_templates','variable_definitions','customers',
    'harvest_tickets','lots','process_phases','variable_logs','moisture_logs','waste_logs','reservations',
    'stock_movements','quality_samples','lot_public_profiles'] loop
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_org_member(organization_id))', t);
  end loop;
end $$;
create policy "members read" on public.lot_links for select to authenticated
  using (exists (select 1 from public.lots l where l.id = parent_lot_id and public.is_org_member(l.organization_id)));

-- direct writes only on catalog-like tables, by role. Inventory tables are written via functions only.
do $$
declare t text; roles text;
begin
  for t, roles in select * from (values
    ('org_settings','{administrador}'), ('farms','{administrador}'), ('parcels','{administrador}'),
    ('units','{administrador}'), ('process_templates','{administrador}'), ('variable_definitions','{administrador,encargado_beneficio}'),
    ('customers','{administrador,comercial}'), ('lot_public_profiles','{administrador,comercial}'),
    ('process_phases','{administrador,encargado_beneficio}'), ('variable_logs','{administrador,encargado_beneficio}')
  ) v(a,b) loop
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('create policy "role insert" on public.%I for insert to authenticated with check (public.has_org_role(organization_id, %L::public.app_role[]))', t, roles);
    execute format('create policy "role update" on public.%I for update to authenticated using (public.has_org_role(organization_id, %L::public.app_role[])) with check (public.has_org_role(organization_id, %L::public.app_role[]))', t, roles, roles);
    execute format('create policy "admin delete" on public.%I for delete to authenticated using (public.has_org_role(organization_id, ''{administrador}''::public.app_role[]))', t);
    if t <> 'org_settings' and t <> 'lot_public_profiles' then
      execute format('create trigger audit_%s after insert or update or delete on public.%I for each row execute function public.audit_row()', t, t);
    end if;
  end loop;
end $$;

-- ===== Helpers =====
create or replace function public._assert_qty(_q numeric, _label text default 'cantidad')
returns void language plpgsql immutable as $$
begin
  if _q is null or _q = 'NaN'::numeric or _q <= 0 or _q > 10000000 then
    raise exception '% inválida: debe ser un número positivo', _label using errcode = '22023';
  end if;
end $$;

create or replace function public._require_role(_org uuid, _roles public.app_role[])
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_org_role(_org, _roles) then
    raise exception 'Permiso denegado' using errcode = '42501';
  end if;
end $$;

create or replace function public.my_membership()
returns table (organization_id uuid, organization_name text, role public.app_role)
language sql stable security definer set search_path = public as $$
  select m.organization_id, o.name, m.role from public.memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = auth.uid() and m.active order by m.created_at limit 1
$$;

create or replace function public._next_lot_code(_org uuid, _process text)
returns text language plpgsql security definer set search_path = public as $$
declare p text; y int := extract(year from now())::int; n int;
begin
  p := upper(left(coalesce(nullif(_process,''),'LOT'), 3));
  insert into public.lot_sequences (organization_id, prefix, year, last_value) values (_org, p, y, 1)
  on conflict (organization_id, prefix, year) do update set last_value = public.lot_sequences.last_value + 1
  returning last_value into n;
  return format('%s-%s-%s', p, y, lpad(n::text, 3, '0'));
end $$;

-- ===== Lot operations =====
create or replace function public.create_lot(_org uuid, _friendly_name text, _qty_kg numeric,
  _farm_id uuid default null, _parcel_id uuid default null, _variety text default '',
  _process_type text default 'lavado', _physical_state text default 'cereza', _harvest_ticket_id uuid default null)
returns public.lots language plpgsql security definer set search_path = public as $$
declare l public.lots;
begin
  perform public._require_role(_org, '{administrador,encargado_beneficio,productor}');
  perform public._assert_qty(_qty_kg, 'Cantidad del lote');
  if coalesce(trim(_friendly_name),'') = '' then raise exception 'El lote necesita un nombre' using errcode='22023'; end if;
  insert into public.lots (organization_id, lot_code, friendly_name, farm_id, parcel_id, harvest_ticket_id, variety,
    process_type, physical_state, qty_initial_kg, qty_current_kg)
  values (_org, public._next_lot_code(_org, _process_type), trim(_friendly_name), _farm_id, _parcel_id, _harvest_ticket_id,
    coalesce(_variety,''), _process_type, _physical_state, _qty_kg, _qty_kg)
  returning * into l;
  insert into public.stock_movements (organization_id, lot_id, movement_type, qty_kg, reason) values (_org, l.id, 'entrada', _qty_kg, 'Creación de lote');
  perform public.write_audit(_org, 'lots', l.id::text, 'create', to_jsonb(l));
  return l;
end $$;

create or replace function public.adjust_inventory(_lot uuid, _delta numeric, _reason text)
returns public.lots language plpgsql security definer set search_path = public as $$
declare l public.lots; movable numeric;
begin
  select * into l from public.lots where id = _lot for update;
  if not found then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform public._require_role(l.organization_id, '{administrador,encargado_beneficio}');
  if _delta is null or _delta = 'NaN'::numeric or _delta = 0 or abs(_delta) > 10000000 then
    raise exception 'Ajuste inválido' using errcode='22023'; end if;
  if coalesce(trim(_reason),'') = '' then raise exception 'El ajuste requiere un motivo' using errcode='22023'; end if;
  if _delta < 0 then
    movable := l.qty_current_kg - l.qty_reserved_kg - l.qty_committed_kg;
    if -_delta > movable then
      raise exception 'No se puede ajustar % kg: solo % kg no están reservados ni comprometidos', -_delta, movable using errcode='23514';
    end if;
    update public.lots set qty_current_kg = qty_current_kg + _delta,
      qty_blocked_kg = least(qty_blocked_kg, qty_current_kg + _delta - qty_reserved_kg - qty_committed_kg),
      updated_at = now() where id = _lot returning * into l;
  else
    update public.lots set qty_current_kg = qty_current_kg + _delta, updated_at = now() where id = _lot returning * into l;
  end if;
  insert into public.stock_movements (organization_id, lot_id, movement_type, qty_kg, reason) values (l.organization_id, _lot, 'ajuste', _delta, trim(_reason));
  perform public.write_audit(l.organization_id, 'lots', _lot::text, 'adjust', jsonb_build_object('delta', _delta, 'reason', _reason));
  return l;
end $$;

create or replace function public.log_waste(_lot uuid, _qty numeric, _waste_type text, _reason text, _destination text default 'descarte')
returns public.waste_logs language plpgsql security definer set search_path = public as $$
declare l public.lots; w public.waste_logs; movable numeric;
begin
  select * into l from public.lots where id = _lot for update;
  if not found then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform public._require_role(l.organization_id, '{administrador,encargado_beneficio}');
  perform public._assert_qty(_qty, 'Merma');
  if coalesce(trim(_reason),'') = '' then raise exception 'La merma requiere un motivo' using errcode='22023'; end if;
  movable := l.qty_current_kg - l.qty_reserved_kg - l.qty_committed_kg;
  if _qty > movable then
    raise exception 'La merma (% kg) supera el café no reservado ni comprometido (% kg)', _qty, movable using errcode='23514';
  end if;
  update public.lots set qty_current_kg = qty_current_kg - _qty,
    qty_blocked_kg = least(qty_blocked_kg, qty_current_kg - _qty - qty_reserved_kg - qty_committed_kg), updated_at = now()
    where id = _lot;
  insert into public.waste_logs (organization_id, lot_id, waste_type, destination, qty_kg, reason)
    values (l.organization_id, _lot, _waste_type, coalesce(_destination,'descarte'), _qty, trim(_reason)) returning * into w;
  insert into public.stock_movements (organization_id, lot_id, movement_type, qty_kg, reason, reference_id)
    values (l.organization_id, _lot, 'merma', -_qty, trim(_reason), w.id);
  perform public.write_audit(l.organization_id, 'waste_logs', w.id::text, 'create', to_jsonb(w));
  return w;
end $$;

create or replace function public.log_moisture(_lot uuid, _pct numeric, _device text default null, _notes text default null)
returns public.moisture_logs language plpgsql security definer set search_path = public as $$
declare l public.lots; m public.moisture_logs;
begin
  select * into l from public.lots where id = _lot for update;
  if not found then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform public._require_role(l.organization_id, '{administrador,encargado_beneficio}');
  if _pct is null or _pct = 'NaN'::numeric or _pct <= 0 or _pct > 100 then raise exception 'Humedad inválida' using errcode='22023'; end if;
  insert into public.moisture_logs (organization_id, lot_id, moisture_pct, device, notes) values (l.organization_id, _lot, _pct, _device, _notes) returning * into m;
  update public.lots set current_moisture = _pct, updated_at = now() where id = _lot;
  perform public.write_audit(l.organization_id, 'moisture_logs', m.id::text, 'create', to_jsonb(m));
  return m;
end $$;

-- Quality: blocking moves free café into blocked; approval releases the block.
create or replace function public.record_quality(_lot uuid, _status text, _score numeric default null, _data jsonb default '{}'::jsonb)
returns public.lots language plpgsql security definer set search_path = public as $$
declare l public.lots; s public.quality_samples;
begin
  select * into l from public.lots where id = _lot for update;
  if not found then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform public._require_role(l.organization_id, '{administrador,encargado_beneficio}');
  insert into public.quality_samples (organization_id, lot_id, status, score, data) values (l.organization_id, _lot, _status, _score, coalesce(_data,'{}'))
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
end $$;

create or replace function public.split_lot(_lot uuid, _parts jsonb)
returns setof public.lots language plpgsql security definer set search_path = public as $$
declare l public.lots; part jsonb; q numeric; total numeric := 0; child public.lots;
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
  if total > l.qty_free_kg then
    raise exception 'Las partes suman % kg pero solo hay % kg libres', total, l.qty_free_kg using errcode='23514'; end if;
  update public.lots set qty_current_kg = qty_current_kg - total, updated_at = now() where id = _lot;
  for part in select * from jsonb_array_elements(_parts) loop
    q := (part->>'qty_kg')::numeric;
    insert into public.lots (organization_id, lot_code, friendly_name, farm_id, parcel_id, parent_lot_id, variety, process_type,
      physical_state, commercial_state, quality_status, qty_initial_kg, qty_current_kg, current_moisture)
    values (l.organization_id, public._next_lot_code(l.organization_id, l.process_type),
      coalesce(nullif(trim(part->>'name'),''), l.friendly_name || ' (parte)'), l.farm_id, l.parcel_id, l.id, l.variety, l.process_type,
      l.physical_state, l.commercial_state, l.quality_status, q, q, l.current_moisture)
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
declare org uuid; src public.lots; total numeric := 0; merged public.lots; ids uuid[];
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
    if src.qty_free_kg <= 0 then raise exception 'El lote % no tiene café libre para mezclar', src.lot_code using errcode='23514'; end if;
    total := total + src.qty_free_kg;
  end loop;
  select * into src from public.lots where id = ids[1];
  insert into public.lots (organization_id, lot_code, friendly_name, variety, process_type, physical_state, commercial_state, qty_initial_kg, qty_current_kg)
  values (org, public._next_lot_code(org, 'MEZ'), trim(_name), 'Mezcla', src.process_type, src.physical_state, 'en_proceso', total, total)
  returning * into merged;
  for src in select * from public.lots where id = any(ids) loop
    insert into public.lot_links values (src.id, merged.id, 'merge', src.qty_free_kg, now());
    insert into public.stock_movements (organization_id, lot_id, movement_type, qty_kg, reference_id) values (org, src.id, 'transformacion', -src.qty_free_kg, merged.id);
    update public.lots set qty_current_kg = qty_current_kg - src.qty_free_kg, updated_at = now() where id = src.id;
  end loop;
  insert into public.stock_movements (organization_id, lot_id, movement_type, qty_kg) values (org, merged.id, 'entrada', total);
  perform public.write_audit(org, 'lots', merged.id::text, 'merge', jsonb_build_object('sources', ids, 'kg', total));
  return merged;
end $$;

-- ===== Reservations (row-locked; lot locked after reservation to keep a fixed order) =====
create or replace function public.create_reservation(_lot uuid, _customer uuid, _qty numeric,
  _price numeric default null, _currency text default null, _expires_at timestamptz default null, _notes text default null)
returns public.reservations language plpgsql security definer set search_path = public as $$
declare l public.lots; r public.reservations;
begin
  select * into l from public.lots where id = _lot for update;
  if not found then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform public._require_role(l.organization_id, '{administrador,comercial}');
  perform public._assert_qty(_qty, 'Cantidad a reservar');
  if _price is not null and (_price = 'NaN'::numeric or _price < 0) then raise exception 'Precio inválido' using errcode='22023'; end if;
  if not exists (select 1 from public.customers where id = _customer and organization_id = l.organization_id) then
    raise exception 'Cliente no encontrado' using errcode='P0002'; end if;
  if _qty > l.qty_free_kg then
    raise exception 'Sobreventa: solo hay % kg libres', l.qty_free_kg using errcode='23514'; end if;
  update public.lots set qty_reserved_kg = qty_reserved_kg + _qty, updated_at = now() where id = _lot;
  insert into public.reservations (organization_id, lot_id, customer_id, qty_kg, price, currency, expires_at, notes)
    values (l.organization_id, _lot, _customer, _qty, _price, _currency, _expires_at, _notes) returning * into r;
  insert into public.stock_movements (organization_id, lot_id, movement_type, qty_kg, reference_id) values (l.organization_id, _lot, 'reserva', _qty, r.id);
  perform public.write_audit(l.organization_id, 'reservations', r.id::text, 'create', to_jsonb(r));
  return r;
end $$;

create or replace function public._lock_reservation(_id uuid)
returns public.reservations language plpgsql security definer set search_path = public as $$
declare r public.reservations;
begin
  select * into r from public.reservations where id = _id;
  if not found then raise exception 'Reserva no encontrada' using errcode='P0002'; end if;
  perform 1 from public.lots where id = r.lot_id for update;          -- lot first (same order as create)
  select * into r from public.reservations where id = _id for update; -- re-read under lock
  return r;
end $$;

create or replace function public.confirm_reservation(_id uuid)
returns public.reservations language plpgsql security definer set search_path = public as $$
declare r public.reservations;
begin
  r := public._lock_reservation(_id);
  perform public._require_role(r.organization_id, '{administrador,comercial}');
  if r.status <> 'reservada' then raise exception 'La reserva está %, no se puede confirmar', r.status using errcode='55000'; end if;
  update public.lots set qty_reserved_kg = qty_reserved_kg - r.qty_kg, qty_committed_kg = qty_committed_kg + r.qty_kg, updated_at = now() where id = r.lot_id;
  update public.reservations set status = 'confirmada', confirmed_at = now() where id = _id returning * into r;
  perform public.write_audit(r.organization_id, 'reservations', _id::text, 'confirm', null);
  return r;
end $$;

create or replace function public._release_reservation(_r public.reservations, _new_status text, _reason text)
returns public.reservations language plpgsql security definer set search_path = public as $$
declare r public.reservations;
begin
  if _r.status = 'reservada' then
    update public.lots set qty_reserved_kg = qty_reserved_kg - _r.qty_kg, updated_at = now() where id = _r.lot_id;
  elsif _r.status = 'confirmada' then
    update public.lots set qty_committed_kg = qty_committed_kg - _r.qty_kg, updated_at = now() where id = _r.lot_id;
  else
    raise exception 'La reserva ya está %', _r.status using errcode='55000';
  end if;
  update public.reservations set status = _new_status, released_at = now(),
    notes = coalesce(notes || E'\n', '') || coalesce(_reason, '') where id = _r.id returning * into r;
  insert into public.stock_movements (organization_id, lot_id, movement_type, qty_kg, reason, reference_id)
    values (r.organization_id, r.lot_id, 'liberacion_reserva', -r.qty_kg, _reason, r.id);
  perform public.write_audit(r.organization_id, 'reservations', r.id::text, _new_status, jsonb_build_object('reason', _reason));
  return r;
end $$;
revoke execute on function public._release_reservation(public.reservations, text, text) from public, anon, authenticated;
revoke execute on function public._lock_reservation(uuid) from public, anon, authenticated;
revoke execute on function public._next_lot_code(uuid, text) from public, anon, authenticated;

create or replace function public.cancel_reservation(_id uuid, _reason text default null)
returns public.reservations language plpgsql security definer set search_path = public as $$
declare r public.reservations;
begin
  r := public._lock_reservation(_id);
  perform public._require_role(r.organization_id, '{administrador,comercial}');
  return public._release_reservation(r, 'cancelada', coalesce(_reason, 'Cancelada'));
end $$;

create or replace function public.expire_reservations(_org uuid)
returns int language plpgsql security definer set search_path = public as $$
declare rid uuid; r public.reservations; n int := 0;
begin
  perform public._require_role(_org, '{administrador,comercial,encargado_beneficio}');
  for rid in select id from public.reservations where organization_id = _org and status = 'reservada' and expires_at < now() order by id loop
    r := public._lock_reservation(rid);
    if r.status = 'reservada' and r.expires_at < now() then
      perform public._release_reservation(r, 'vencida', 'Vencida automáticamente');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.deliver_reservation(_id uuid, _notes text default null)
returns public.reservations language plpgsql security definer set search_path = public as $$
declare r public.reservations;
begin
  r := public._lock_reservation(_id);
  perform public._require_role(r.organization_id, '{administrador,comercial}');
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
  perform public.write_audit(r.organization_id, 'reservations', _id::text, 'deliver', null);
  return r;
end $$;

-- ===== Members: role change with last-admin protection =====
create or replace function public.set_member_role(_org uuid, _user uuid, _role public.app_role, _active boolean default true)
returns public.memberships language plpgsql security definer set search_path = public as $$
declare m public.memberships; admins int;
begin
  perform public._require_role(_org, '{administrador}');
  -- serialize all admin changes in this org
  perform 1 from public.organizations where id = _org for update;
  select * into m from public.memberships where organization_id = _org and user_id = _user for update;
  if not found then raise exception 'El usuario no pertenece a la organización' using errcode='P0002'; end if;
  if m.role = 'administrador' and m.active and (_role <> 'administrador' or not _active) then
    select count(*) into admins from public.memberships where organization_id = _org and role = 'administrador' and active;
    if admins <= 1 then raise exception 'No se puede quitar al último administrador' using errcode='55000'; end if;
  end if;
  update public.memberships set role = _role, active = _active where organization_id = _org and user_id = _user returning * into m;
  delete from public.user_roles where user_id = _user;
  insert into public.user_roles (user_id, role) values (_user, _role);
  perform public.write_audit(_org, 'memberships', _user::text, 'set_role', jsonb_build_object('role', _role, 'active', _active));
  return m;
end $$;

-- user_roles is now written only via set_member_role / server code
drop policy if exists "Admins insert roles" on public.user_roles;
drop policy if exists "Admins update roles" on public.user_roles;
drop policy if exists "Admins delete roles" on public.user_roles;
revoke insert, update, delete on public.user_roles from authenticated;

-- public functions: callable by signed-in users only (each checks role inside)
do $$
declare f text;
begin
  foreach f in array array['create_lot(uuid,text,numeric,uuid,uuid,text,text,text,uuid)','adjust_inventory(uuid,numeric,text)',
    'log_waste(uuid,numeric,text,text,text)','log_moisture(uuid,numeric,text,text)','record_quality(uuid,text,numeric,jsonb)',
    'split_lot(uuid,jsonb)','merge_lots(uuid[],text)','create_reservation(uuid,uuid,numeric,numeric,text,timestamptz,text)',
    'confirm_reservation(uuid)','cancel_reservation(uuid,text)','expire_reservations(uuid)','deliver_reservation(uuid,text)',
    'set_member_role(uuid,uuid,public.app_role,boolean)','my_membership()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

alter publication supabase_realtime add table public.customers, public.lots, public.reservations;