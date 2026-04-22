-- Galeria adicional (até 9 paths no Storage; + image_storage_path = até 10 fotos por aparelho)
alter table public.resale_devices
  add column if not exists image_gallery_paths text[] not null default '{}';

comment on column public.resale_devices.image_gallery_paths is
  'Caminhos extras no bucket resale-device-photos (máx. 9 no app; capa continua em image_storage_path ou image_url).';
