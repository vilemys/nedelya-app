-- Неделька: сохраняемый ручной порядок задач

alter table public.tasks
  add column if not exists sort_order bigint not null default 0;

with ranked as (
  select id, row_number() over (partition by owner_id order by created_at desc) as position
  from public.tasks
)
update public.tasks
set sort_order = ranked.position
from ranked
where public.tasks.id = ranked.id
  and public.tasks.sort_order = 0;

create index if not exists tasks_owner_sort_order_idx
  on public.tasks(owner_id, sort_order);
