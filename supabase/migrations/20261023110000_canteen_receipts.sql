-- Журнал приёма продуктов (бракераж сырья): каждая партия — отдельная запись.
-- Применено к проекту lojsuvtkrazwdcwcxtqy 23.10.2026. Опирается на существующие
-- app.can(), app.set_updated_at(), app.audit_trigger(), canteen_suppliers и organizations.
create table public.canteen_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  received_on date not null default current_date,
  received_time time not null default localtime,
  product text not null check (length(btrim(product)) > 0),
  qty numeric(12,3) not null check (qty > 0),
  unit text not null default 'кг' check (unit in ('кг','г','л','шт','уп','ящ')),
  supplier_id uuid references public.canteen_suppliers(id) on delete set null,
  supplier_name text,
  expiry_date date,
  status text not null default 'accepted' check (status in ('accepted','checking','rejected')),
  invoice_no text,
  appearance text,
  storage_cond text,
  actual_usage text,
  responsible text,
  note text,
  photo_path text,
  invoice_photo_path text,
  declaration_path text,
  declaration_name text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.canteen_receipts is 'Журнал приёма продуктов (бракераж сырья). Файлы — в Storage, bucket canteen, путь <org_id>/<receipt_id>/<файл>.';

create index canteen_receipts_org_day on public.canteen_receipts (org_id, received_on desc, received_time desc);
create index canteen_receipts_org_expiry on public.canteen_receipts (org_id, expiry_date) where status <> 'rejected';
create index canteen_receipts_supplier on public.canteen_receipts (supplier_id);

alter table public.canteen_receipts enable row level security;
create policy "canteen_receipts: read" on public.canteen_receipts for select to authenticated
  using (app.can('canteen.view', org_id));
create policy "canteen_receipts: insert" on public.canteen_receipts for insert to authenticated
  with check (app.can('canteen.manage', org_id));
create policy "canteen_receipts: update" on public.canteen_receipts for update to authenticated
  using (app.can('canteen.manage', org_id)) with check (app.can('canteen.manage', org_id));
create policy "canteen_receipts: delete" on public.canteen_receipts for delete to authenticated
  using (app.can('canteen.manage', org_id));

create trigger set_updated_at before update on public.canteen_receipts
  for each row execute function app.set_updated_at();
create trigger audit after insert or update or delete on public.canteen_receipts
  for each row execute function app.audit_trigger();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('canteen', 'canteen', false, 20971520,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do nothing;

create policy "canteen: read files" on storage.objects for select to authenticated
  using (bucket_id = 'canteen' and app.can('canteen.view', app.try_uuid(app.path_head(name))));
create policy "canteen: upload files" on storage.objects for insert to authenticated
  with check (bucket_id = 'canteen' and app.can('canteen.manage', app.try_uuid(app.path_head(name))));
create policy "canteen: update files" on storage.objects for update to authenticated
  using (bucket_id = 'canteen' and app.can('canteen.manage', app.try_uuid(app.path_head(name))));
create policy "canteen: delete files" on storage.objects for delete to authenticated
  using (bucket_id = 'canteen' and app.can('canteen.manage', app.try_uuid(app.path_head(name))));

-- Обновления в реальном времени
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'canteen_receipts') then
    alter publication supabase_realtime add table public.canteen_receipts;
  end if;
end $$;
