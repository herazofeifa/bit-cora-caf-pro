#!/usr/bin/env bash
# Concurrency test: N parallel sessions try to reserve 15 kg from a 100 kg lot.
# Exactly 6 must succeed (90 kg) and the lot must never be oversold.
# Requires DATABASE_URL pointing at a disposable database with the migrations applied.
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
ORG=00000000-0000-0000-0000-0000000000c1
ADMIN=10000000-0000-0000-0000-0000000000c1
COM=10000000-0000-0000-0000-0000000000c2
CUST=30000000-0000-0000-0000-0000000000c1

psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 <<SQL
insert into public.organizations (id, name) values ('$ORG', 'Concurrency');
insert into public.memberships (organization_id, user_id, role) values ('$ORG', '$ADMIN', 'administrador'), ('$ORG', '$COM', 'comercial');
insert into public.customers (id, organization_id, name) values ('$CUST', '$ORG', 'Cliente');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"$ADMIN","role":"authenticated"}', false);
select public.release_lot_for_sale((public.create_lot('$ORG', 'Lote concurrente', 100)).id);
SQL
LOT=$(psql "$DATABASE_URL" -Atc "select id from public.lots where organization_id = '$ORG'")

N=10
rm -f /tmp/bcp_conc_*.out
for i in $(seq 1 $N); do
  ( psql "$DATABASE_URL" -Atq -v ON_ERROR_STOP=1 >/tmp/bcp_conc_$i.out 2>&1 <<SQL
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"$COM","role":"authenticated"}', false);
select pg_sleep(0.2);
select 'OK ' || id from public.create_reservation('$LOT', '$CUST', 15);
SQL
  ) &
done
wait

OK=$(grep -l '^OK ' /tmp/bcp_conc_*.out | wc -l | tr -d ' ')
OVER=$(grep -l 'Sobreventa' /tmp/bcp_conc_*.out | wc -l | tr -d ' ')
RES=$(psql "$DATABASE_URL" -Atc "select qty_reserved_kg::int || ' ' || qty_free_kg::int from public.lots where id = '$LOT'")
echo "successful=$OK rejected_oversell=$OVER reserved_free=$RES"
[ "$OK" = "6" ] && [ "$OVER" = "4" ] && [ "$RES" = "90 10" ] || { echo "FAIL concurrency"; exit 1; }
echo "ok - concurrent reservations never oversell"

# Expiry race: one expired reservation; 5 sessions run expire_reservations while 5 try to confirm it.
# None may confirm; the hold is released exactly once.
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 <<SQL
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"$COM","role":"authenticated"}', false);
select public.cancel_reservation(id, 'reset') from public.reservations where lot_id = '$LOT' and status = 'reservada';
select public.create_reservation('$LOT', '$CUST', 20, null, null, now() + interval '1 day', 'exp-race');
reset role;
update public.reservations set expires_at = now() - interval '1 minute' where notes = 'exp-race';
SQL
RID=$(psql "$DATABASE_URL" -Atc "select id from public.reservations where notes = 'exp-race'")
rm -f /tmp/bcp_exp_*.out
for i in $(seq 1 10); do
  if [ $((i % 2)) -eq 0 ]; then CALL="select 'EXP ' || public.expire_reservations('$ORG')"; else CALL="select 'CONF ' || status from public.confirm_reservation('$RID')"; fi
  ( psql "$DATABASE_URL" -Atq >/tmp/bcp_exp_$i.out 2>&1 <<SQL
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"$COM","role":"authenticated"}', false);
select pg_sleep(0.2);
$CALL;
SQL
  ) &
done
wait
CONF=$( (grep -l '^CONF ' /tmp/bcp_exp_*.out || true) | wc -l | tr -d ' ')
REL=$(psql "$DATABASE_URL" -Atc "select count(*) from public.stock_movements where reference_id = '$RID' and movement_type = 'liberacion_reserva'")
ST=$(psql "$DATABASE_URL" -Atc "select status from public.reservations where id = '$RID'")
RSV=$(psql "$DATABASE_URL" -Atc "select qty_reserved_kg::int from public.lots where id = '$LOT'")
echo "expiry_race confirmed=$CONF releases=$REL status=$ST reserved=$RSV"
[ "$CONF" = "0" ] && [ "$REL" = "1" ] && [ "$ST" = "vencida" ] && [ "$RSV" = "0" ] || { echo "FAIL expiry race"; exit 1; }
echo "ok - expired reservation never confirmed; released exactly once"
