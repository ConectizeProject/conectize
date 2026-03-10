-- Adiciona saldo inicial nas contas
alter table public.contas
  add column if not exists saldo_inicial_cents integer not null default 0;

comment on column public.contas.saldo_inicial_cents is 'Valor inicial da conta ao ser criada ou configurado manualmente.';
