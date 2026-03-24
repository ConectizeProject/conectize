	-- Permite que administradores excluam linhas do histórico de edição da OS

	drop policy if exists "service_order_edit_history_delete_admin" on public.service_order_edit_history;

	create policy "service_order_edit_history_delete_admin"

	on public.service_order_edit_history for delete

	to authenticated

	using (public.is_admin());



	grant delete on public.service_order_edit_history to authenticated;


