-- Неделька: обязанности сотрудников

create table public.responsibilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assignee_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 160),
  expected_result text not null default '',
  created_by uuid not null references public.profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index responsibilities_org_assignee_idx
  on public.responsibilities(organization_id, assignee_id);

alter table public.responsibilities enable row level security;

create policy "Members read relevant responsibilities" on public.responsibilities
  for select using (
    assignee_id = auth.uid() or public.is_org_leader(organization_id)
  );

create policy "Leaders create responsibilities" on public.responsibilities
  for insert with check (
    public.is_org_leader(organization_id)
    and exists (
      select 1 from public.organization_members
      where organization_id = responsibilities.organization_id
        and user_id = responsibilities.assignee_id
    )
    and created_by = auth.uid()
  );

create policy "Leaders update responsibilities" on public.responsibilities
  for update using (public.is_org_leader(organization_id))
  with check (public.is_org_leader(organization_id));

create policy "Leaders delete responsibilities" on public.responsibilities
  for delete using (public.is_org_leader(organization_id));
