-- Face Reset Program Day migration
-- Run this once in the Supabase SQL Editor before deploying the matching frontend.
-- Program Day is a product-level progression value and remains separate from progress_date.

begin;

create table if not exists public.face_reset_schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

revoke all on table public.face_reset_schema_migrations from anon, authenticated;

do $$
begin
  if exists (
    select 1
    from public.face_reset_schema_migrations
    where name = '20260808_program_day_leaderboard'
  ) then
    raise exception 'Face Reset Program Day migration has already been applied.';
  end if;

  insert into public.face_reset_schema_migrations (name)
  values ('20260808_program_day_leaderboard');
end $$;

-- Keep the actual local activity date while storing the independently assigned program day.
alter table public.daily_progress
  add column if not exists program_day integer;

alter table public.session_results
  add column if not exists program_day integer;

-- Existing test and legacy records predate Program Day, so safely place them in Day 1.
update public.daily_progress
set program_day = 1
where program_day is null;

update public.session_results
set program_day = 1
where program_day is null;

alter table public.daily_progress
  alter column program_day set not null;

alter table public.session_results
  alter column program_day set not null;

-- New records must explicitly provide Program Day. A missing value should fail,
-- rather than silently placing the activity in Day 1.
alter table public.daily_progress
  alter column program_day drop default;

alter table public.session_results
  alter column program_day drop default;

alter table public.daily_progress
  drop constraint if exists daily_progress_program_day_positive_check;

alter table public.session_results
  drop constraint if exists session_results_program_day_positive_check;

alter table public.daily_progress
  add constraint daily_progress_program_day_positive_check check (program_day >= 1);

alter table public.session_results
  add constraint session_results_program_day_positive_check check (program_day >= 1);

-- Indexes support one user's program history and completed Program Day leaderboard queries.
create index if not exists daily_progress_program_day_completed_score_idx
  on public.daily_progress (program_day, total_score desc, updated_at asc)
  where is_complete = true and completed_sessions >= 3;

create index if not exists session_results_user_program_day_created_idx
  on public.session_results (user_id, program_day, created_at desc);

-- The old calendar-date view has a different column shape, so it must be
-- removed before the Program Day leaderboard is created.
drop view if exists public.daily_leaderboard;

-- One public leaderboard-safe record per user and Program Day. The row_number CTE
-- prevents duplicate historical rows from appearing more than once for a player.
create view public.daily_leaderboard
with (security_invoker = false)
as
with latest_completed_program_day as (
  select
    progress.user_id,
    progress.program_day,
    coalesce(nullif(trim(profile.display_name), ''), 'Anonymous') as display_name,
    progress.total_score,
    progress.completed_sessions,
    progress.is_complete,
    progress.updated_at,
    row_number() over (
      partition by progress.user_id, progress.program_day
      order by progress.updated_at desc, progress.total_score desc
    ) as player_program_row
  from public.daily_progress as progress
  left join public.profiles as profile on profile.user_id = progress.user_id
  where progress.is_complete = true
    and progress.completed_sessions >= 3
), ranked_program_days as (
  select
    program_day,
    display_name,
    total_score,
    completed_sessions,
    is_complete,
    rank() over (
      partition by program_day
      order by total_score desc, updated_at asc
    )::integer as rank
  from latest_completed_program_day
  where player_program_row = 1
)
select
  program_day,
  display_name,
  total_score,
  completed_sessions,
  is_complete,
  rank
from ranked_program_days;

-- The view intentionally bypasses own-row table SELECT RLS, but exposes no private data.
revoke all on public.daily_leaderboard from anon;
grant select on public.daily_leaderboard to authenticated;

commit;
