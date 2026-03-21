-- Permissões para editar/excluir comentários de assistência

alter table public.service_order_assistance_comments enable row level security;

-- UPDATE: autor do comentário ou admin/staff
drop policy if exists "service_order_assistance_comments_staff_admin_update" on public.service_order_assistance_comments;
create policy "service_order_assistance_comments_staff_admin_update"
on public.service_order_assistance_comments for update
to authenticated
using (
  public.is_staff_or_admin() or author_user_id = auth.uid()
)
with check (
  public.is_staff_or_admin() or author_user_id = auth.uid()
);

-- DELETE: autor do comentário ou admin/staff
drop policy if exists "service_order_assistance_comments_staff_admin_delete" on public.service_order_assistance_comments;
create policy "service_order_assistance_comments_staff_admin_delete"
on public.service_order_assistance_comments for delete
to authenticated
using (
  public.is_staff_or_admin() or author_user_id = auth.uid()
);

