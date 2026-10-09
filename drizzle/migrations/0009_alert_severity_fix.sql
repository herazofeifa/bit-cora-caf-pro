create or replace function public._low_stock_alert() returns trigger language plpgsql security definer set search_path = public as $$
declare th numeric;
begin
  select nullif(settings->>'low_stock_kg','')::numeric into th from public.org_settings where organization_id = new.organization_id;
  if th is null or th <= 0 or not new.sale_released then return new; end if;
  if coalesce(new.qty_free_kg,0) < th then
    if not exists (select 1 from public.alerts where lot_id = new.id and kind = 'stock_bajo' and resolved_at is null) then
      insert into public.alerts (organization_id, lot_id, kind, severity, message)
      values (new.organization_id, new.id, 'stock_bajo', 'warning',
        format('Stock bajo en %s: %s kg libres (umbral %s kg)', new.lot_code, round(coalesce(new.qty_free_kg,0),2), th));
    end if;
  else
    update public.alerts set resolved_at = now() where lot_id = new.id and kind = 'stock_bajo' and resolved_at is null;
  end if;
  return new;
end $$;

create or replace function public._moisture_alert() returns trigger language plpgsql security definer set search_path = public as $$
declare lo numeric; code text;
begin
  select nullif(settings->>'moisture_min','')::numeric into lo from public.org_settings where organization_id = new.organization_id;
  lo := coalesce(lo, 10);
  select lot_code into code from public.lots where id = new.lot_id;
  if new.moisture_pct < lo then
    insert into public.alerts (organization_id, lot_id, kind, severity, message)
    values (new.organization_id, new.lot_id, 'humedad', 'critical', format('Humedad %s%% en %s, por debajo del mínimo %s%%', new.moisture_pct, code, lo));
  end if;
  return new;
end $$;