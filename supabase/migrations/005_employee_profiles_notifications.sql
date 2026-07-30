-- Неделька: расширенные карточки сотрудников и ответственный за уведомления

alter table public.profiles
  add column if not exists employee_description text not null default '',
  add column if not exists birth_date date;

alter table public.organization_members
  add column if not exists is_notification_contact boolean not null default false;

create unique index if not exists organization_single_notification_contact_idx
  on public.organization_members (organization_id)
  where is_notification_contact;

create policy "Leaders update colleague profiles" on public.profiles
  for update using (
    exists (
      select 1
      from public.organization_members leader
      join public.organization_members colleague
        on colleague.organization_id = leader.organization_id
      where leader.user_id = auth.uid()
        and leader.role in ('owner', 'manager')
        and colleague.user_id = profiles.id
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members leader
      join public.organization_members colleague
        on colleague.organization_id = leader.organization_id
      where leader.user_id = auth.uid()
        and leader.role in ('owner', 'manager')
        and colleague.user_id = profiles.id
    )
  );

create or replace function public.set_notification_contact(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org_id uuid;
begin
  select organization_id
    into target_org_id
  from organization_members
  where user_id = target_user_id;

  if target_org_id is null or not public.is_org_leader(target_org_id) then
    raise exception 'Only organization leaders can change the notification contact';
  end if;

  update organization_members
  set is_notification_contact = (user_id = target_user_id)
  where organization_id = target_org_id;
end;
$$;

grant execute on function public.set_notification_contact(uuid) to authenticated;
