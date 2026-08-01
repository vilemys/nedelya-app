-- Неделька: безопасные роли, передача владельца и приватность KPI/структуры

drop policy if exists "Members read KPI" on public.kpi_metrics;
drop policy if exists "Leaders and assignees read KPI" on public.kpi_metrics;
create policy "Leaders and assignees read KPI" on public.kpi_metrics
  for select using (
    public.is_org_leader(organization_id)
    or (assignee_id = auth.uid() and public.is_org_member(organization_id))
  );

drop policy if exists "Members read positions" on public.positions;
drop policy if exists "Leaders read positions" on public.positions;
create policy "Leaders read positions" on public.positions
  for select using (public.is_org_leader(organization_id));

create or replace function public.set_member_role(
  target_user_id uuid,
  new_role public.member_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller organization_members%rowtype;
  target organization_members%rowtype;
begin
  select * into caller from organization_members where user_id = auth.uid() limit 1;
  select * into target from organization_members
    where organization_id = caller.organization_id and user_id = target_user_id;

  if caller.role <> 'owner' then
    raise exception 'Only owner can change roles';
  end if;
  if target.user_id is null or target.role = 'owner' or target_user_id = auth.uid() then
    raise exception 'This role cannot be changed';
  end if;
  if new_role not in ('manager', 'employee') then
    raise exception 'Unsupported role';
  end if;

  update organization_members set role = new_role
  where organization_id = caller.organization_id and user_id = target_user_id;
end;
$$;

create or replace function public.transfer_organization_ownership(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller organization_members%rowtype;
  target organization_members%rowtype;
begin
  select * into caller from organization_members where user_id = auth.uid() limit 1;
  select * into target from organization_members
    where organization_id = caller.organization_id and user_id = target_user_id;

  if caller.role <> 'owner' then
    raise exception 'Only owner can transfer ownership';
  end if;
  if target.user_id is null or target.role <> 'manager' then
    raise exception 'Ownership can be transferred to a manager only';
  end if;

  update organization_members set role = 'manager'
  where organization_id = caller.organization_id and user_id = auth.uid();
  update organization_members set role = 'owner'
  where organization_id = caller.organization_id and user_id = target_user_id;
end;
$$;

grant execute on function public.set_member_role(uuid, public.member_role) to authenticated;
grant execute on function public.transfer_organization_ownership(uuid) to authenticated;

drop policy if exists "Leaders read team personal databases" on public.personal_databases;
create policy "Leaders read team personal databases" on public.personal_databases
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1 from organization_members leader
      join organization_members colleague on colleague.organization_id = leader.organization_id
      where leader.user_id = auth.uid()
        and leader.role in ('owner', 'manager')
        and colleague.user_id = personal_databases.owner_id
    )
  );

drop policy if exists "Leaders read team personal database files" on storage.objects;
create policy "Leaders read team personal database files" on storage.objects
  for select using (
    bucket_id = 'personal-files'
    and exists (
      select 1 from organization_members leader
      join organization_members colleague on colleague.organization_id = leader.organization_id
      where leader.user_id = auth.uid()
        and leader.role in ('owner', 'manager')
        and split_part(storage.objects.name, '/', 1) = colleague.user_id::text
    )
  );
