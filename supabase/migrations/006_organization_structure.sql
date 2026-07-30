-- Неделька: иерархическое дерево должностей

alter table public.positions
  add column if not exists parent_position_id uuid references public.positions(id) on delete set null,
  add column if not exists purpose text not null default '';

alter table public.positions
  add constraint positions_not_own_parent
  check (parent_position_id is null or parent_position_id <> id);

create index if not exists positions_parent_idx
  on public.positions(organization_id, parent_position_id);
