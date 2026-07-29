-- Неделька: приглашения сотрудников по персональной ссылке

create or replace function public.create_invitation(
  invite_email text,
  invite_role public.member_role default 'employee'
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

  return query
  insert into invitations (
    organization_id, email, role, invited_by, token, expires_at, accepted_at
  )
  values (
    current_org_id, lower(trim(invite_email)), invite_role, auth.uid(),
    gen_random_uuid(), now() + interval '7 days', null
  )
  on conflict (organization_id, email)
  do update set
    role = excluded.role,
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

  insert into organization_members (organization_id, user_id, role)
  values (invitation_record.organization_id, auth.uid(), invitation_record.role);

  update invitations set accepted_at = now() where id = invitation_record.id;
  return invitation_record.organization_id;
end;
$$;

grant execute on function public.create_invitation(text, public.member_role) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
