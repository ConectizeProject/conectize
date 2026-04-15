-- Lojista: pode criar e atualizar apenas overrides onde retailer_user_id = auth.uid()

drop policy if exists "pricing_tag_retailer_overrides_retailer_insert_own"
  on public.pricing_tag_retailer_overrides;
create policy "pricing_tag_retailer_overrides_retailer_insert_own"
on public.pricing_tag_retailer_overrides
for insert
to authenticated
with check (
  public.is_retailer()
  and retailer_user_id = auth.uid()
);

drop policy if exists "pricing_tag_retailer_overrides_retailer_update_own"
  on public.pricing_tag_retailer_overrides;
create policy "pricing_tag_retailer_overrides_retailer_update_own"
on public.pricing_tag_retailer_overrides
for update
to authenticated
using (
  public.is_retailer()
  and retailer_user_id = auth.uid()
)
with check (
  public.is_retailer()
  and retailer_user_id = auth.uid()
);
