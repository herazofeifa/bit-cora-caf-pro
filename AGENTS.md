# Architecture rules

- Inventory, reservations, waste, quality and lot split/merge change only through SECURITY DEFINER SQL functions that lock the lot row; why: prevents overselling under concurrency.
- Every operational table carries organization_id with RLS via is_org_member/has_org_role; why: tenant isolation is enforced by the database, not the UI.
- The user's role comes from public.memberships (my_membership()); never from localStorage; why: client state is forgeable.
- audit_log is append-only and written server-side with auth.uid() and now(); why: trustworthy history.
- Modules not yet on Lovable Cloud keep a per-user local cache (bcp.ops-data.v2:<uid>) cleared on sign-out; legacy keys are kept as backup and never uploaded; why: no cross-user leakage during the migration.
- Demo data loads only by explicit user action; why: never mix demo with real records.
- Shared-data access lives in src/lib/cloud.ts; why: one path for reads/writes/realtime.
- DB tests run on a disposable local PostgreSQL via tests/db/run-local.sh; why: the sandbox DB user cannot assume the authenticated role.
- Lots are not sellable until release_lot_for_sale; a BEFORE trigger derives commercial_state and qty_blocked_kg; why: state can never go stale or expose in-process coffee.
- Retriable RPCs take an _op_key stored in operation_keys bound to actor + operation + md5 of the canonical argument array; a reused key with other data or another actor is rejected; why: repeated taps apply once and a key can never return someone else's or a different result.
- A generic _same_org_refs trigger guards every cross-table reference; why: no function or direct write can link another organization's rows.
- Anonymous pages (/t, /s, /r) read only through SECURITY DEFINER projections returning NULL for private/unknown tokens; why: identical 404 and no private columns.
- Server-backed screens live under /operacion and use src/lib/ops-cloud.ts; legacy screens still use the per-user local cache; why: incremental migration without breaking existing UI.
- The copilot calls the OpenAI API from a server function with read-only, allowlisted tools run under the user's RLS session; why: the author's requirement and no arbitrary SQL or writes.
- The offline queue (IndexedDB, per user+org) holds only harvests and measurements; why: inventory/reservations must be decided online.
- src/lib/cloud.ts applies a response only if it belongs to the current generation (bumped on every start/stop); why: late replies must not repopulate data after logout or organization switch.
- Team visibility (profiles/user_roles) is self or an administrator sharing an organization, via can_see_user(); team actions take the selected organization and check has_org_role server-side; why: no global-admin cross-organization reads.
