-- Неделька: справочник должностей и назначение при приглашении

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table public.organization_members
  add column position_id uuid references public.positions(id) on delete set null;

alter table public.invitations
  add column position_id uuid references public.positions(id) on delete set null;

create index positions_org_idx on public.positions(organization_id);

alter table public.positions enable row level security;

create policy "Members read positions" on public.positions
  for select using (public.is_org_member(organization_id));

create policy "Leaders create positions" on public.positions
  for insert with check (public.is_org_leader(organization_id));

create policy "Leaders update positions" on public.positions
  for update using (public.is_org_leader(organization_id))
  with check (public.is_org_leader(organization_id));

create policy "Leaders delete unused positions" on public.positions
  for delete using (public.is_org_leader(organization_id));

create or replace function public.create_invitation_with_position(
  invite_email text,
  invite_role public.member_role default 'employee',
  invite_position_id uuid default null
)
returns table (token uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_org_id uuid;
begin
  select organization_id into current_org_id
  from organization_members
  where user_id = auth.uid() and role in ('owner', 'manager')
  limit 1;

  if current_org_id is null then
    raise exception 'Only organization leaders can invite members';
  end if;
  if invite_role = 'owner' then
    raise exception 'Owner role cannot be assigned by invitation';
  end if;
  if trim(invite_email) = '' then
    raise exception 'Email is required';
  end if;
  if invite_position_id is not null and not exists (
    select 1 from positions
    where id = invite_position_id and organization_id = current_org_id
  ) then
    raise exception 'Position does not belong to organization';
  end if;

  return query
  insert into invitations (
    organization_id, email, role, position_id, invited_by, token, expires_at, accepted_at
  )
  values (
    current_org_id, lower(trim(invite_email)), invite_role, invite_position_id, auth.uid(),
    gen_random_uuid(), now() + interval '7 days', null
  )
  on conflict (organization_id, email)
  do update set
    role = excluded.role,
    position_id = excluded.position_id,
    invited_by = excluded.invited_by,
    token = gen_random_uuid(),
    expires_at = now() + interval '7 days',
    accepted_at = null,
    created_at = now()
  returning invitations.token, invitations.expires_at;
end;
$$;

create or replace function public.accept_invitation(invite_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_record invitations%rowtype;
  current_email text;
  selected_position_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  current_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select * into invitation_record
  from invitations
  where token = invite_token
  for update;

  if invitation_record.id is null then raise exception 'Invitation not found'; end if;
  if invitation_record.accepted_at is not null then raise exception 'Invitation already accepted'; end if;
  if invitation_record.expires_at < now() then raise exception 'Invitation expired'; end if;
  if lower(invitation_record.email) <> current_email then
    raise exception 'Invitation belongs to another email';
  end if;
  if exists (select 1 from organization_members where user_id = auth.uid()) then
    raise exception 'User already belongs to an organization';
  end if;

  select name into selected_position_name
  from positions
  where id = invitation_record.position_id
    and organization_id = invitation_record.organization_id;

  insert into organization_members (
    organization_id, user_id, role, position_id, job_title
  )
  values (
    invitation_record.organization_id, auth.uid(), invitation_record.role,
    invitation_record.position_id, selected_position_name
  );

  update invitations set accepted_at = now() where id = invitation_record.id;
  return invitation_record.organization_id;
end;
$$;

grant execute on function public.create_invitation_with_position(
  text, public.member_role, uuid
) to authenticated;
