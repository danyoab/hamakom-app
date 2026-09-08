-- Analytics are private. Anonymous outcomes use an unguessable impression ID
-- plus its session ID, rather than table-wide read/update permissions.
begin;
do $$ declare p record; begin
  for p in select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('analytics_events','recommendation_impressions','recommendation_outcomes')
  loop execute format('drop policy %I on public.%I', p.policyname, p.tablename); end loop;
end $$;
create policy admin_read_events on public.analytics_events for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'role')='admin');
create policy admin_read_impressions on public.recommendation_impressions for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'role')='admin');
create policy admin_read_outcomes on public.recommendation_outcomes for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists anon_insert_events on public.analytics_events;
create policy anon_insert_events on public.analytics_events for insert to anon, authenticated
  with check (user_id is null or user_id=auth.uid());
drop policy if exists anon_insert_impressions on public.recommendation_impressions;
create policy anon_insert_impressions on public.recommendation_impressions for insert to anon, authenticated
  with check (user_id is null or user_id=auth.uid());
revoke select,update,delete on public.analytics_events,public.recommendation_impressions from anon;
revoke update,delete on public.analytics_events,public.recommendation_impressions from authenticated;
revoke all on public.recommendation_outcomes from anon,authenticated;
grant select on public.analytics_events,public.recommendation_impressions,public.recommendation_outcomes to authenticated;
grant insert on public.analytics_events,public.recommendation_impressions to anon,authenticated;
alter view public.analytics_summary set (security_invoker=true);
alter view public.plan_popularity set (security_invoker=true);
alter view public.location_popularity set (security_invoker=true);
revoke all on public.analytics_summary,public.plan_popularity,public.location_popularity from anon;
grant select on public.analytics_summary,public.plan_popularity,public.location_popularity to authenticated;

-- Account deletion removes associated analytics instead of merely detaching
-- the user ID while leaving their quiz answers in the database.
do $$ declare c record; begin
  for c in select conrelid::regclass as tbl, conname from pg_constraint
    where contype='f' and confrelid='auth.users'::regclass
      and conrelid in ('public.analytics_events'::regclass,'public.recommendation_impressions'::regclass)
  loop execute format('alter table %s drop constraint %I',c.tbl,c.conname); end loop;
end $$;
alter table public.analytics_events add constraint analytics_events_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;
alter table public.recommendation_impressions add constraint recommendation_impressions_user_id_fkey foreign key(user_id) references auth.users(id) on delete cascade;

alter table public.recommendation_impressions add column if not exists client_id uuid default gen_random_uuid();
create unique index if not exists recommendation_impressions_client_unique on public.recommendation_impressions(client_id);

create unique index if not exists recommendation_outcomes_impression_unique on public.recommendation_outcomes(recommendation_impression_id);
create or replace function public.record_recommendation_outcome(p_impression_id uuid, p_session_id text, p_patch jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare k text; internal_id public.recommendation_impressions.id%type;
begin
  if p_session_id is null or length(p_session_id)<16 or p_patch is null or jsonb_typeof(p_patch)<>'object' then return false; end if;
  if p_patch-array['saved','shared','maps_opened','reminder_set','went','rating','would_do_again'] <> '{}'::jsonb then raise exception 'Invalid outcome fields'; end if;
  foreach k in array array['saved','shared','maps_opened','reminder_set','went','would_do_again'] loop
    if p_patch ? k and jsonb_typeof(p_patch->k) not in ('boolean','null') then raise exception 'Invalid boolean'; end if;
  end loop;
  if p_patch ? 'rating' and p_patch->'rating'<>'null'::jsonb and
     (jsonb_typeof(p_patch->'rating')<>'number' or (p_patch->>'rating') !~ '^[1-5]$') then raise exception 'Invalid rating'; end if;
  select id into internal_id from public.recommendation_impressions
    where client_id=p_impression_id and session_id=p_session_id and (user_id is null or user_id=auth.uid());
  if internal_id is null then return false; end if;
  insert into public.recommendation_outcomes(recommendation_impression_id,saved,shared,maps_opened,reminder_set,went,rating,would_do_again)
  values(internal_id,coalesce((p_patch->>'saved')::boolean,false),coalesce((p_patch->>'shared')::boolean,false),
    coalesce((p_patch->>'maps_opened')::boolean,false),coalesce((p_patch->>'reminder_set')::boolean,false),
    (p_patch->>'went')::boolean,(p_patch->>'rating')::integer,(p_patch->>'would_do_again')::boolean)
  on conflict(recommendation_impression_id) do update set
    saved=case when p_patch ? 'saved' then excluded.saved else recommendation_outcomes.saved end,
    shared=case when p_patch ? 'shared' then excluded.shared else recommendation_outcomes.shared end,
    maps_opened=case when p_patch ? 'maps_opened' then excluded.maps_opened else recommendation_outcomes.maps_opened end,
    reminder_set=case when p_patch ? 'reminder_set' then excluded.reminder_set else recommendation_outcomes.reminder_set end,
    went=case when p_patch ? 'went' then excluded.went else recommendation_outcomes.went end,
    rating=case when p_patch ? 'rating' then excluded.rating else recommendation_outcomes.rating end,
    would_do_again=case when p_patch ? 'would_do_again' then excluded.would_do_again else recommendation_outcomes.would_do_again end,
    updated_at=now();
  return true;
end $$;
revoke all on function public.record_recommendation_outcome(uuid,text,jsonb) from public;
grant execute on function public.record_recommendation_outcome(uuid,text,jsonb) to anon,authenticated;
commit;
