-- Неделька: график сотрудников, KPI и готовый шаблон структуры

alter table public.organization_members
  add column if not exists work_start_time time;

create table public.kpi_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text not null default '',
  unit text not null default '',
  target_value numeric not null default 0,
  current_value numeric not null default 0,
  period text not null default 'month' check (period in ('week', 'month', 'quarter')),
  created_by uuid not null references public.profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kpi_metrics_org_assignee_idx
  on public.kpi_metrics(organization_id, assignee_id);

alter table public.kpi_metrics enable row level security;

create policy "Members read KPI" on public.kpi_metrics
  for select using (public.is_org_member(organization_id));

create policy "Leaders create KPI" on public.kpi_metrics
  for insert with check (
    public.is_org_leader(organization_id)
    and created_by = auth.uid()
  );

create policy "Leaders update KPI" on public.kpi_metrics
  for update using (public.is_org_leader(organization_id))
  with check (public.is_org_leader(organization_id));

create policy "Leaders delete KPI" on public.kpi_metrics
  for delete using (public.is_org_leader(organization_id));

create or replace function public.remove_organization_member(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_membership organization_members%rowtype;
  target_membership organization_members%rowtype;
begin
  select * into caller_membership
  from organization_members
  where user_id = auth.uid();

  select * into target_membership
  from organization_members
  where user_id = target_user_id
    and organization_id = caller_membership.organization_id;

  if caller_membership.role not in ('owner', 'manager') then
    raise exception 'Only leaders can remove employees';
  end if;
  if target_membership.user_id is null then
    raise exception 'Employee not found';
  end if;
  if target_membership.role = 'owner' or target_user_id = auth.uid() then
    raise exception 'Owner or current user cannot be removed';
  end if;
  if caller_membership.role = 'manager' and target_membership.role <> 'employee' then
    raise exception 'Manager can remove employees only';
  end if;

  delete from organization_members
  where organization_id = caller_membership.organization_id
    and user_id = target_user_id;
end;
$$;

create or replace function public.install_default_org_structure()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_org_id uuid;
  owner_position_id uuid;
  director_position_id uuid;
begin
  select organization_id into current_org_id
  from organization_members
  where user_id = auth.uid() and role in ('owner', 'manager')
  limit 1;

  if current_org_id is null then
    raise exception 'Only leaders can install structure';
  end if;

  insert into positions (organization_id, name, purpose)
  values (current_org_id, 'Владелец / Основатель', 'Определяет стратегию и ключевые цели компании')
  on conflict (organization_id, name) do update set purpose = excluded.purpose
  returning id into owner_position_id;

  insert into positions (organization_id, name, purpose, parent_position_id)
  values (current_org_id, 'Руководитель компании', 'Обеспечивает выполнение стратегии и общий результат', owner_position_id)
  on conflict (organization_id, name) do update
    set purpose = excluded.purpose, parent_position_id = excluded.parent_position_id
  returning id into director_position_id;

  insert into positions (organization_id, name, purpose, parent_position_id)
  values
    (current_org_id, 'HR и команда', 'Нанимает, адаптирует и развивает сотрудников', director_position_id),
    (current_org_id, 'Маркетинг', 'Создаёт стабильный поток целевых обращений', director_position_id),
    (current_org_id, 'Продажи', 'Превращает обращения в выручку компании', director_position_id),
    (current_org_id, 'Финансы', 'Обеспечивает финансовую устойчивость и прозрачность', director_position_id),
    (current_org_id, 'Операции', 'Создаёт продукт или оказывает услугу в срок', director_position_id),
    (current_org_id, 'Качество и клиентский сервис', 'Удерживает качество и лояльность клиентов', director_position_id)
  on conflict (organization_id, name) do update
    set purpose = excluded.purpose, parent_position_id = excluded.parent_position_id;
end;
$$;

grant execute on function public.remove_organization_member(uuid) to authenticated;
grant execute on function public.install_default_org_structure() to authenticated;
