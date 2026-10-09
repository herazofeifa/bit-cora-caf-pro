# Architecture rules

- Inventory, reservations, waste, quality and lot split/merge change only through SECURITY DEFINER SQL functions that lock the lot row; why: prevents overselling under concurrency.
- Every operational table carries organization_id with RLS via is_org_member/has_org_role; why: tenant isolation is enforced by the database, not the UI.
- The user's role comes from public.memberships (my_membership()); never from localStorage; why: client state is forgeable.
- audit_log is append-only and written server-side with auth.uid() and now(); why: trustworthy history.
- Modules not yet on Lovable Cloud keep a per-user local cache (bcp.ops-data.v2:<uid>) cleared on sign-out; legacy keys are kept as backup and never uploaded; why: no cross-user leakage during the migration.
- Demo data loads only by explicit user action; why: never mix demo with real records.
- Shared-data access lives in src/lib/cloud.ts; why: one path for reads/writes/realtime.
- DB tests run on a disposable local PostgreSQL via tests/db/run-local.sh; why: the sandbox DB user cannot assume the authenticated role.
