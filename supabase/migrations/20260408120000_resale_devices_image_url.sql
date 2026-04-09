-- URL opcional da foto do aparelho (vitrine / visão cliente)
alter table public.resale_devices
  add column if not exists image_url text;

comment on column public.resale_devices.image_url is 'URL pública da foto (ex.: CDN ou link direto) para exibição na vitrine ao cliente.';
