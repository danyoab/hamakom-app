-- HaMakom monetization foundation — 2026-07-14
-- Idempotent, additive migration for venue claims, attributed partner leads,
-- structured kashrut verification, partner reporting, and analytics privacy.

-- Structured kashrut data. `kashrus` remains as the backwards-compatible
-- display value while these fields record whether and how it was verified.
alter table locations add column if not exists kashrut_status text not null default 'unknown';
alter table locations add column if not exists kashrut_authority text;
alter table locations add column if not exists kashrut_certificate_expiry date;
alter table locations add column if not exists kashrut_last_verified_at timestamptz;
alter table locations add column if not exists kashrut_verification_source text;

do $$ begin
  alter table locations add constraint locations_kashrut_status_check
    check (kashrut_status in ('unknown', 'verified', 'not_certified', 'expired'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_locations_kashrut_status on locations(kashrut_status);

-- Attribute every business lead to its CTA and, for claims, its listing.
alter table partner_inquiries add column if not exists location_id bigint references locations(id) on delete set null;
alter table partner_inquiries add column if not exists inquiry_type text not null default 'partner';
alter table partner_inquiries add column if not exists source text;
alter table partner_inquiries add column if not exists utm_source text;
alter table partner_inquiries add column if not exists utm_medium text;
alter table partner_inquiries add column if not exists utm_campaign text;
alter table partner_inquiries add column if not exists notified_at timestamptz;

do $$ begin
  alter table partner_inquiries add constraint partner_inquiries_type_check
    check (inquiry_type in ('partner', 'claim'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_partner_inquiries_location on partner_inquiries(location_id);
create index if not exists idx_partner_inquiries_status_created on partner_inquiries(status, created_at desc);

-- Public submissions go through one validated function. This returns only the
-- new id, which the notification Edge Function uses to load the row server-side.
create or replace function submit_partner_inquiry(
  p_business_name text,
  p_contact_name text default null,
  p_phone text default null,
  p_email text default null,
  p_city text default null,
  p_message text default null,
  p_location_id bigint default null,
  p_inquiry_type text default 'partner',
  p_source text default 'direct_url',
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inquiry_id uuid;
begin
  if nullif(trim(p_business_name), '') is null then
    raise exception 'Business name is required';
  end if;
  if nullif(trim(coalesce(p_phone, '')), '') is null
     and nullif(trim(coalesce(p_email, '')), '') is null then
    raise exception 'A phone number or email is required';
  end if;
  if p_inquiry_type not in ('partner', 'claim') then
    raise exception 'Invalid inquiry type';
  end if;

  insert into partner_inquiries (
    business_name, contact_name, phone, email, city, message,
    location_id, inquiry_type, source, utm_source, utm_medium, utm_campaign
  ) values (
    left(trim(p_business_name), 120),
    nullif(left(trim(coalesce(p_contact_name, '')), 120), ''),
    nullif(left(trim(coalesce(p_phone, '')), 40), ''),
    nullif(left(trim(coalesce(p_email, '')), 200), ''),
    nullif(left(trim(coalesce(p_city, '')), 80), ''),
    nullif(left(trim(coalesce(p_message, '')), 2000), ''),
    p_location_id,
    p_inquiry_type,
    nullif(left(trim(coalesce(p_source, '')), 80), ''),
    nullif(left(trim(coalesce(p_utm_source, '')), 120), ''),
    nullif(left(trim(coalesce(p_utm_medium, '')), 120), ''),
    nullif(left(trim(coalesce(p_utm_campaign, '')), 160), '')
  ) returning id into inquiry_id;

  return inquiry_id;
end;
$$;

revoke all on function submit_partner_inquiry(text,text,text,text,text,text,bigint,text,text,text,text,text) from public;
grant execute on function submit_partner_inquiry(text,text,text,text,text,text,bigint,text,text,text,text,text) to anon, authenticated;

drop policy if exists "public_insert_inquiry" on partner_inquiries;
revoke insert on partner_inquiries from anon, authenticated;

-- Keep behavioral data write-only for anonymous clients. Remove every live
-- SELECT policy except the named admin policy, including unknown legacy names.
do $$
declare p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('analytics_events', 'recommendation_impressions', 'recommendation_outcomes')
      and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

drop policy if exists "admin_read_events" on analytics_events;
create policy "admin_read_events" on analytics_events for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "admin_read_impressions" on recommendation_impressions;
create policy "admin_read_impressions" on recommendation_impressions for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "admin_read_outcomes" on recommendation_outcomes;
drop policy if exists "anon_upsert_outcomes" on recommendation_outcomes;
drop policy if exists "anon_insert_outcomes" on recommendation_outcomes;
drop policy if exists "anon_update_outcomes" on recommendation_outcomes;
create policy "anon_insert_outcomes" on recommendation_outcomes for insert
  with check (true);
create policy "anon_update_outcomes" on recommendation_outcomes for update
  using (true) with check (true);
create policy "admin_read_outcomes" on recommendation_outcomes for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

revoke select on analytics_events, recommendation_impressions, recommendation_outcomes from anon;
grant select on analytics_events, recommendation_impressions, recommendation_outcomes to authenticated;

create index if not exists idx_analytics_place_performance
  on analytics_events(item_id, event_name, created_at desc)
  where item_type = 'place';
