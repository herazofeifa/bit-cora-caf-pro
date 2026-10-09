drop policy if exists "members read" on public.lot_links;
create policy "members read" on public.lot_links for select to authenticated
  using (exists (select 1 from public.lots pl where pl.id = lot_links.parent_lot_id and public.is_org_member(pl.organization_id)));