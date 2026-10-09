-- Reservation commercial terms: agreed delivery date is distinct from reservation expiry.
alter table public.reservations add column if not exists agreed_delivery_date date;
alter table public.reservations add column if not exists conditions text;
alter table public.lots add column if not exists location_updated_at timestamptz;

create or replace function public.set_reservation_terms(_id uuid, _delivery date, _conditions text)
returns public.reservations language plpgsql security definer set search_path = public as $$
declare r public.reservations;
begin
  select * into r from public.reservations where id = _id for update;
  if not found then raise exception 'Reserva no encontrada' using errcode='P0002'; end if;
  perform public._require_role(r.organization_id, '{administrador,comercial}');
  if r.status not in ('reservada','confirmada') then raise exception 'Solo reservas activas pueden cambiar condiciones' using errcode='23514'; end if;
  if _delivery is not null and _delivery < r.reserved_at::date then raise exception 'La entrega pactada no puede ser antes de la reserva' using errcode='22023'; end if;
  update public.reservations set agreed_delivery_date = _delivery, conditions = nullif(trim(coalesce(_conditions,'')),'') where id = _id returning * into r;
  perform public.write_audit(r.organization_id, 'reservations', r.id::text, 'terms', jsonb_build_object('agreed_delivery_date', _delivery, 'conditions', _conditions));
  return r;
end $$;
revoke all on function public.set_reservation_terms(uuid, date, text) from public, anon;
grant execute on function public.set_reservation_terms(uuid, date, text) to authenticated;

create or replace function public.set_lot_location(_lot uuid, _location text)
returns public.lots language plpgsql security definer set search_path = public as $$
declare l public.lots;
begin
  select * into l from public.lots where id = _lot for update;
  if not found then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform public._require_role(l.organization_id, '{administrador,encargado_beneficio}');
  update public.lots set current_location = nullif(trim(coalesce(_location,'')),''), location_updated_at = now(), updated_at = now() where id = _lot returning * into l;
  perform public.write_audit(l.organization_id, 'lots', l.id::text, 'location', jsonb_build_object('location', l.current_location));
  return l;
end $$;
revoke all on function public.set_lot_location(uuid, text) from public, anon;
grant execute on function public.set_lot_location(uuid, text) to authenticated;

create or replace function public.resolve_alert(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.alerts;
begin
  select * into a from public.alerts where id = _id for update;
  if not found then raise exception 'Alerta no encontrada' using errcode='P0002'; end if;
  perform public._require_role(a.organization_id, '{administrador,encargado_beneficio,comercial}');
  update public.alerts set resolved_at = now(), resolved_by = auth.uid() where id = _id and resolved_at is null;
  perform public.write_audit(a.organization_id, 'alerts', a.id::text, 'resolve', null);
end $$;
revoke all on function public.resolve_alert(uuid) from public, anon;
grant execute on function public.resolve_alert(uuid) to authenticated;

-- Low-stock alert: sellable lot whose free kg drops below the organization threshold.
create or replace function public._low_stock_alert() returns trigger language plpgsql security definer set search_path = public as $$
declare th numeric;
begin
  select nullif(settings->>'low_stock_kg','')::numeric into th from public.org_settings where organization_id = new.organization_id;
  if th is null or th <= 0 or not new.sale_released then return new; end if;
  if coalesce(new.qty_free_kg,0) < th then
    if not exists (select 1 from public.alerts where lot_id = new.id and kind = 'stock_bajo' and resolved_at is null) then
      insert into public.alerts (organization_id, lot_id, kind, severity, message)
      values (new.organization_id, new.id, 'stock_bajo', 'media',
        format('Stock bajo en %s: %s kg libres (umbral %s kg)', new.lot_code, round(coalesce(new.qty_free_kg,0),2), th));
    end if;
  else
    update public.alerts set resolved_at = now() where lot_id = new.id and kind = 'stock_bajo' and resolved_at is null;
  end if;
  return new;
end $$;
drop trigger if exists lots_low_stock on public.lots;
create trigger lots_low_stock after insert or update of qty_current_kg, qty_reserved_kg, qty_committed_kg, qty_blocked_kg, sale_released on public.lots
  for each row execute function public._low_stock_alert();

-- Moisture out of the organization range raises an alert.
create or replace function public._moisture_alert() returns trigger language plpgsql security definer set search_path = public as $$
declare lo numeric; hi numeric; code text;
begin
  select coalesce(nullif(settings->>'moisture_min','')::numeric, 10), coalesce(nullif(settings->>'moisture_max','')::numeric, 12)
    into lo, hi from public.org_settings where organization_id = new.organization_id;
  lo := coalesce(lo, 10); hi := coalesce(hi, 12);
  select lot_code into code from public.lots where id = new.lot_id;
  if new.moisture_pct > hi + 8 then
    null; -- still drying: normal, not an alert
  elsif new.moisture_pct < lo then
    insert into public.alerts (organization_id, lot_id, kind, severity, message)
    values (new.organization_id, new.lot_id, 'humedad', 'alta', format('Humedad %s%% en %s, por debajo del mínimo %s%%', new.moisture_pct, code, lo));
  end if;
  return new;
end $$;
drop trigger if exists moisture_alert on public.moisture_logs;
create trigger moisture_alert after insert on public.moisture_logs for each row execute function public._moisture_alert();

-- Realtime for catalogs and measurements.
do $$ declare t text; begin
  foreach t in array array['farms','parcels','units','variable_definitions','variable_logs','moisture_logs','quality_samples','waste_logs','stock_movements','org_settings','process_templates','files','lot_public_profiles','sacks'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;