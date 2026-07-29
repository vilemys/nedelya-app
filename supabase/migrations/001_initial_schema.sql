-- Неделька: автономная многопользовательская модель
create extension if not exists pgcrypto;

create type public.member_role as enum ('owner', 'manager', 'employee');
create type public.task_status as enum ('planned', 'in_progress', 'done', 'cancelled');
create type public.task_priority as enum ('low', 'medium', 'high');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'employee',
  job_title text,
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.member_role not null default 'employee',
  invited_by uuid not null references public.profiles(id),
  token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  description text,
  status public.task_status not null default 'planned',
  priority public.task_priority not null default 'medium',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  main_result text not null default '',
  next_priority text not null default '',
  blocker text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, week_start)
);

create index tasks_org_owner_idx on public.tasks(organization_id, owner_id);
create index tasks_due_idx on public.tasks(due_date);
create index reports_org_week_idx on public.weekly_reports(organization_id, week_start);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.create_organization(organization_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from organization_members where user_id = auth.uid()) then
    raise exception 'User already belongs to an organization';
  end if;
  insert into organizations (name, created_by)
  values (trim(organization_name), auth.uid())
  returning id into new_org_id;
  insert into organization_members (organization_id, user_id, role)
  values (new_org_id, auth.uid(), 'owner');
  return new_org_id;
end;
$$;

create or replace function public.is_org_member(org_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from organization_members
  where organization_id = org_id and user_id = auth.uid()
) $$;

create or replace function public.is_org_leader(org_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from organization_members
  where organization_id = org_id and user_id = auth.uid() and role in ('owner', 'manager')
) $$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.invitations enable row level security;
alter table public.tasks enable row level security;
alter table public.weekly_reports enable row level security;

create policy "Users read own profile" on public.profiles
  for select using (id = auth.uid());
create policy "Members read colleague profiles" on public.profiles
  for select using (exists (
    select 1 from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  ));
create policy "Users update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Members read organization" on public.organizations
  for select using (public.is_org_member(id));
create policy "Owners update organization" on public.organizations
  for update using (exists (
    select 1 from public.organization_members
    where organization_id = id and user_id = auth.uid() and role = 'owner'
  ));

create policy "Members read memberships" on public.organization_members
  for select using (public.is_org_member(organization_id));
create policy "Leaders add memberships" on public.organization_members
  for insert with check (public.is_org_leader(organization_id));
create policy "Leaders update memberships" on public.organization_members
  for update using (public.is_org_leader(organization_id));
create policy "Owners remove memberships" on public.organization_members
  for delete using (exists (
    select 1 from public.organization_members own
    where own.organization_id = organization_id and own.user_id = auth.uid() and own.role = 'owner'
  ));

create policy "Leaders manage invitations" on public.invitations
  for all using (public.is_org_leader(organization_id))
  with check (public.is_org_leader(organization_id));

create policy "Members read organization tasks" on public.tasks
  for select using (public.is_org_member(organization_id));
create policy "Members create own tasks" on public.tasks
  for insert with check (public.is_org_member(organization_id) and owner_id = auth.uid());
create policy "Owners update own tasks" on public.tasks
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Owners delete own tasks" on public.tasks
  for delete using (owner_id = auth.uid());

create policy "Members read organization reports" on public.weekly_reports
  for select using (public.is_org_member(organization_id));
create policy "Members create own reports" on public.weekly_reports
  for insert with check (public.is_org_member(organization_id) and user_id = auth.uid());
create policy "Members update own reports" on public.weekly_reports
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_leader(uuid) to authenticated;
