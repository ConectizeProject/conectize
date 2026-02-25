-- Adiciona status 'aguardando_aprovacao' em service_orders
alter table public.service_orders drop constraint if exists service_orders_status_check;
alter table public.service_orders add constraint service_orders_status_check check (status in (
  'orcamento',
  'aguardando_aprovacao',
  'aprovado',
  'aguardando_pecas',
  'em_manutencao',
  'aguardando_retirada',
  'finalizada',
  'finalizada_sem_conserto',
  'finalizada_sem_aprovacao',
  'cancelada'
));
