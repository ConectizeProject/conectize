-- Um aviso de agendamento por pessoa e OS. Um retry não empilha o mesmo alerta.

create unique index if not exists staff_notifications_user_order_kind_uidx
  on public.staff_notifications (user_id, service_order_id, kind);
