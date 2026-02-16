-- Adiciona coluna share_token para links públicos de compartilhamento (email/WhatsApp)
-- O token permite que quem tem o link acesse as informações da OS sem autenticação.

alter table public.service_orders
  add column if not exists share_token text unique;

-- Gera token para ordens existentes que ainda não possuem
update public.service_orders
set share_token = gen_random_uuid()::text
where share_token is null;

-- Trigger para gerar share_token em novas ordens
create or replace function public.service_orders_set_share_token()
returns trigger as $$
begin
  if new.share_token is null then
    new.share_token := gen_random_uuid()::text;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists service_orders_set_share_token_trigger on public.service_orders;
create trigger service_orders_set_share_token_trigger
  before insert on public.service_orders
  for each row
  execute function public.service_orders_set_share_token();
