-- Face Reset canonical score migration
-- Run this once in the Supabase SQL Editor before deploying the matching frontend.
-- It converts existing legacy raw scores (0-1000 per scene) to canonical scores
-- (0-100 per scene), then rebuilds daily totals from the migrated scene scores.
-- This migration is deliberately one-time only. It must not be re-run.

begin;

-- Persist a migration marker before changing any score. If this migration has
-- already succeeded, raise an error and roll back the entire transaction.
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
    where name = '20260808_canonical_score_scale'
  ) then
    raise exception 'Face Reset canonical score migration has already been applied.';
  end if;

  insert into public.face_reset_schema_migrations (name)
  values ('20260808_canonical_score_scale');
end $$;

-- Remove prior score-related CHECK constraints regardless of their generated names.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select con.conname, rel.relname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname in ('session_results', 'daily_progress')
      and con.contype = 'c'
      and (
        pg_get_constraintdef(con.oid) ilike '%score%'
        or pg_get_constraintdef(con.oid) ilike '%scene_scores%'
      )
  loop
    execute format('alter table public.%I drop constraint if exists %I', constraint_row.relname, constraint_row.conname);
  end loop;
end $$;

-- Convert immutable individual session records from the legacy 0-1000 scale.
update public.session_results
set score = round(100 * power(least(greatest(score, 0), 1000)::numeric / 1000, 1.3))::integer;

-- Convert every per-scene score in existing daily progress and derive the daily total.
with converted_progress as (
  select
    progress.user_id,
    progress.progress_date,
    coalesce(
      jsonb_object_agg(
        score_entry.key,
        to_jsonb(round(100 * power(least(greatest(score_entry.value::numeric, 0), 1000) / 1000, 1.3))::integer)
      ) filter (where score_entry.key is not null),
      '{}'::jsonb
    ) as scene_scores
  from public.daily_progress progress
  left join lateral jsonb_each_text(coalesce(progress.scene_scores, '{}'::jsonb)) score_entry on true
  group by progress.user_id, progress.progress_date
), rebuilt_progress as (
  select
    user_id,
    progress_date,
    scene_scores,
    coalesce((select sum(value::integer) from jsonb_each_text(scene_scores)), 0)::integer as total_score,
    coalesce((select count(*) from jsonb_each(scene_scores)), 0)::integer as completed_sessions
  from converted_progress
)
update public.daily_progress progress
set
  scene_scores = rebuilt.scene_scores,
  total_score = rebuilt.total_score,
  completed_sessions = rebuilt.completed_sessions,
  is_complete = rebuilt.completed_sessions >= 3
from rebuilt_progress rebuilt
where progress.user_id = rebuilt.user_id
  and progress.progress_date = rebuilt.progress_date;

alter table public.session_results
  add constraint session_results_score_canonical_check check (score between 0 and 100);

create or replace function public.face_reset_scene_scores_are_canonical(scores jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when jsonb_typeof(scores) <> 'object' then false
    else not exists (
      select 1
      from jsonb_each(scores) as score_entry(key, value)
      where not case
        when jsonb_typeof(score_entry.value) <> 'number' then false
        when score_entry.value::text !~ '^[0-9]+$' then false
        when length(score_entry.value::text) > 3 then false
        else (score_entry.value::text)::integer between 0 and 100
      end
    )
  end;
$$;

alter table public.daily_progress
  add constraint daily_progress_total_score_canonical_check check (total_score between 0 and 300);

alter table public.daily_progress
  add constraint daily_progress_scene_scores_canonical_check
  check (public.face_reset_scene_scores_are_canonical(scene_scores));

commit;
