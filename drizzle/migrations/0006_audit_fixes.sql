-- 0006: independent-audit fixes.
--  1. Idempotency keys bound to actor + operation + canonical hash of the relevant arguments;
--     reusing a key with a different payload or by a different user is rejected.
--  2. public_lot_view no longer invents exported_at = now(): exported_at is the explicitly declared
--     export date (null when none); generated_at is the projection time.
--  3. Expired reservations cannot be confirmed or delivered even if expire_reservations never ran;
--     new reservations cannot have a past expiry.
--  4. profiles / user_roles readable only by the same user or an administrator sharing an organization.

alter table public.operation_keys add column if not exists args_hash text;
comment on column public.operation_keys.args_hash is 'md5 of the canonical jsonb array of operation arguments (excluding the key).';

create or replace function public._op_get(_org uuid, _key text, _op text, _args_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k public.operation_keys;
begin
  -- keyless (nested) calls must not overwrite the outer operation's hash
  if _key is null then return null; end if;
  if length(_key) < 8 or length(_key) > 200 then raise exception 'Clave de operación inválida' using errcode='22023'; end if;
  if _args_hash is null then raise exception 'Falta la huella de la operación' using errcode='22023'; end if;
  perform set_config('bcp.op_hash', _args_hash, true);
  perform pg_advisory_xact_lock(hashtextextended(_org::text || ':' || _key, 0));
  select * into k from public.operation_keys where organization_id = _org and op_key = _key;
  if not found then return null; end if;
  if k.operation <> _op then raise exception 'La clave de operación ya se usó para otra acción' using errcode='23505'; end if;
  if k.actor_id is distinct from auth.uid() then raise exception 'La clave de operación pertenece a otro usuario' using errcode='23505'; end if;
  if k.args_hash is distinct from _args_hash then raise exception 'La clave de operación ya se usó con datos distintos' using errcode='23505'; end if;
  return k.result;
end $$;

create or replace function public._op_put(_org uuid, _key text, _op text, _result jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.operation_keys (organization_id, op_key, operation, result, actor_id, args_hash)
  select _org, _key, _op, _result, auth.uid(), nullif(current_setting('bcp.op_hash', true), '') where _key is not null
$$;

-- Patch every idempotent RPC so its single _op_get call passes the hash of its own arguments.
do $patch$
declare rec record; def text; n int;
begin
  for rec in select * from (values
    ('public.create_lot(uuid,text,numeric,uuid,uuid,text,text,text,uuid,text)'::regprocedure,
      'md5(jsonb_build_array(_org,_friendly_name,_qty_kg,_farm_id,_parcel_id,_variety,_process_type,_physical_state,_harvest_ticket_id)::text)'),
    ('public.create_reservation(uuid,uuid,numeric,numeric,text,timestamptz,text,text,text)'::regprocedure,
      'md5(jsonb_build_array(_lot,_customer,_qty,_price,_currency,_expires_at,_notes,_price_unit)::text)'),
    ('public.deliver_reservation(uuid,text,text)'::regprocedure, 'md5(jsonb_build_array(_id,_notes)::text)'),
    ('public.register_harvest(uuid,jsonb,uuid,text,text)'::regprocedure, 'md5(jsonb_build_array(_org,_data,_target_lot,_lot_name)::text)'),
    ('public.start_phase(uuid,text,uuid,text,integer,text)'::regprocedure,
      'md5(jsonb_build_array(_lot,_name,_template,_phase_key,_expected_minutes)::text)'),
    ('public.log_phase_variable(uuid,text,numeric,text,text,text)'::regprocedure,
      'md5(jsonb_build_array(_phase,_key,_value,_unit,_notes)::text)'),
    ('public.close_phase(uuid,numeric,text,text,text)'::regprocedure,
      'md5(jsonb_build_array(_phase,_weight_out_kg,_physical_state,_notes)::text)')
  ) as t(fn, hash_expr) loop
    def := pg_get_functiondef(rec.fn);
    n := (select count(*) from regexp_matches(def, '_op_get\(([^,]+), _op_key, ''(\w+)''\)', 'g'));
    if n <> 1 then raise exception 'patch: expected one _op_get call in %, found %', rec.fn, n; end if;
    execute regexp_replace(def, '_op_get\(([^,]+), _op_key, ''(\w+)''\)', '_op_get(\1, _op_key, ''\2'', ' || rec.hash_expr || ')');
  end loop;
end $patch$;

drop function public._op_get(uuid, text, text);
revoke execute on function public._op_get(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public._op_put(uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public.confirm_reservation(_id uuid)
returns public.reservations language plpgsql security definer set search_path = public as $$
declare r public.reservations;
begin
  r := public._lock_reservation(_id);
  perform public._require_role(r.organization_id, '{administrador,comercial}');
  if r.status <> 'reservada' then raise exception 'La reserva está %, no se puede confirmar', r.status using errcode='55000'; end if;
  if r.expires_at is not null and r.expires_at <= now() then
    raise exception 'La reserva venció el %, no se puede confirmar', r.expires_at using errcode='55000'; end if;
  update public.lots set qty_reserved_kg = qty_reserved_kg - r.qty_kg, qty_committed_kg = qty_committed_kg + r.qty_kg, updated_at = now() where id = r.lot_id;
  update public.reservations set status = 'confirmada', confirmed_at = now() where id = _id returning * into r;
  perform public.write_audit(r.organization_id, 'reservations', _id::text, 'confirm', null);
  return r;
end $$;

do $patch$
declare def text;
begin
  def := pg_get_functiondef('public.deliver_reservation(uuid,text,text)'::regprocedure);
  if position('if prev is not null then return r; end if;' in def) = 0 then raise exception 'patch: deliver anchor missing'; end if;
  execute replace(def, 'if prev is not null then return r; end if;',
    'if prev is not null then return r; end if;
  if r.status = ''reservada'' and r.expires_at is not null and r.expires_at <= now() then
    raise exception ''La reserva venció el %, no se puede entregar'', r.expires_at using errcode=''55000''; end if;');

  def := pg_get_functiondef('public.create_reservation(uuid,uuid,numeric,numeric,text,timestamptz,text,text,text)'::regprocedure);
  if position('if coalesce(_price_unit,'''') <> ''kg''' in def) = 0 then raise exception 'patch: create_reservation anchor missing'; end if;
  execute replace(def, 'if coalesce(_price_unit,'''') <> ''kg''',
    'if _expires_at is not null and _expires_at <= now() then raise exception ''La fecha de vencimiento ya pasó'' using errcode=''22023''; end if;
  if coalesce(_price_unit,'''') <> ''kg''');
end $patch$;

alter table public.lot_public_profiles add column if not exists exported_at timestamptz;
comment on column public.lot_public_profiles.exported_at is 'Export date explicitly declared by admin/comercial; null when undeclared. Never derived from a delivery.';

create or replace function public.declare_lot_export(_lot uuid, _exported_at timestamptz)
returns public.lot_public_profiles language plpgsql security definer set search_path = public as $$
declare l public.lots; pp public.lot_public_profiles;
begin
  select * into l from public.lots where id = _lot;
  if not found then raise exception 'Lote no encontrado' using errcode='P0002'; end if;
  perform public._require_role(l.organization_id, '{administrador,comercial}');
  if _exported_at is not null and _exported_at > now() then
    raise exception 'La fecha de exportación no puede ser futura' using errcode='22023'; end if;
  update public.lot_public_profiles set exported_at = _exported_at, updated_at = now() where lot_id = _lot returning * into pp;
  if not found then raise exception 'Primero crea la ficha pública del lote' using errcode='P0002'; end if;
  perform public.write_audit(l.organization_id, 'lot_public_profiles', _lot::text, 'declare_export', jsonb_build_object('exported_at', _exported_at));
  return pp;
end $$;
revoke execute on function public.declare_lot_export(uuid, timestamptz) from public, anon;
grant execute on function public.declare_lot_export(uuid, timestamptz) to authenticated;

do $patch$
declare def text;
begin
  def := pg_get_functiondef('public.public_lot_view(text)'::regprocedure);
  if position('''exported_at'', now())' in def) = 0 then raise exception 'patch: public_lot_view anchor missing'; end if;
  execute replace(def, '''exported_at'', now())', '''exported_at'', pp.exported_at, ''generated_at'', now())');
end $patch$;

create or replace function public.can_see_user(_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _user = auth.uid() or exists (
    select 1 from public.memberships me join public.memberships them on them.organization_id = me.organization_id
    where me.user_id = auth.uid() and me.active and me.role = 'administrador' and them.user_id = _user)
$$;
revoke execute on function public.can_see_user(uuid) from public, anon;
grant execute on function public.can_see_user(uuid) to authenticated;

drop policy if exists "Own profile readable" on public.profiles;
create policy "Self or shared-org admin reads profile" on public.profiles for select to authenticated
  using (public.can_see_user(id));
drop policy if exists "Own roles readable" on public.user_roles;
drop policy if exists "Admins insert roles" on public.user_roles;
drop policy if exists "Admins update roles" on public.user_roles;
drop policy if exists "Admins delete roles" on public.user_roles;
create policy "Self or shared-org admin reads roles" on public.user_roles for select to authenticated
  using (public.can_see_user(user_id));
comment on table public.user_roles is 'Legacy global role mirror; authorization uses public.memberships. Written only by the server.';
