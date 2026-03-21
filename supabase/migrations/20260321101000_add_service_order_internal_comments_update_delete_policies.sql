alter table public.service_order_internal_comments enable row level security;

drop policy if exists "service_order_internal_comments_staff_admin_update" on public.service_order_internal_comments;
create policy "service_order_internal_comments_staff_admin_update"
on public.service_order_internal_comments for update
to authenticated
using (
  public.is_staff_or_admin() or author_user_id = auth.uid()
)
with check (
  public.is_staff_or_admin() or author_user_id = auth.uid()
);

drop policy if exists "service_order_internal_comments_staff_admin_delete" on public.service_order_internal_comments;
create policy "service_order_internal_comments_staff_admin_delete"
on public.service_order_internal_comments for delete
to authenticated
using (
  public.is_staff_or_admin() or author_user_id = auth.uid()
);
