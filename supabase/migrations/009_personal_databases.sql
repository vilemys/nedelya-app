-- Неделька: личные базы пользователей

create table if not exists public.personal_databases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  columns text[] not null default '{}',
  records jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personal_databases_owner_idx
  on public.personal_databases(owner_id, created_at desc);

alter table public.personal_databases enable row level security;

create policy "Users read own personal databases"
  on public.personal_databases for select
  using (owner_id = auth.uid());

create policy "Users create own personal databases"
  on public.personal_databases for insert
  with check (owner_id = auth.uid());

create policy "Users update own personal databases"
  on public.personal_databases for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Users delete own personal databases"
  on public.personal_databases for delete
  using (owner_id = auth.uid());
