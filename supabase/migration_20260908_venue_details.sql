-- Additive, repeatable. Apply before using the new curator fields.
begin;
alter table public.locations add column if not exists menu_url text;
alter table public.locations add column if not exists menu_scope text;
alter table public.locations add column if not exists menu_checked_at date;
alter table public.locations add column if not exists dietary_options text[];
alter table public.locations add column if not exists dietary_source_url text;
alter table public.locations add column if not exists dietary_scope text;
alter table public.locations add column if not exists dietary_checked_at date;
alter table public.locations add column if not exists food_type text;
alter table public.locations add column if not exists kashrut_level text;
alter table public.locations add column if not exists kashrut_status text default 'unknown';
alter table public.locations add column if not exists kashrut_authority text;
alter table public.locations add column if not exists kashrut_certificate_expiry date;
alter table public.locations add column if not exists kashrut_last_verified_at timestamptz;
alter table public.locations add column if not exists kashrut_verification_source text;
alter table public.locations add column if not exists details_source_url text;
alter table public.locations add column if not exists details_checked_at date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'locations_dietary_options_check' and conrelid = 'public.locations'::regclass) then
    alter table public.locations add constraint locations_dietary_options_check check (dietary_options <@ array['vegan','vegetarian','gluten-free','dairy-free']::text[]);
    alter table public.locations add constraint locations_menu_scope_check check (menu_scope in ('branch','chain'));
    alter table public.locations add constraint locations_dietary_scope_check check (dietary_scope in ('branch','chain'));
    alter table public.locations add constraint locations_food_type_check check (food_type in ('restaurant','cafe','dessert','bar','winery'));
    alter table public.locations add constraint locations_dietary_evidence_check check (coalesce(cardinality(dietary_options), 0) = 0 or (dietary_source_url is not null and dietary_source_url ~ '^https?://' and dietary_checked_at is not null));
  end if;
end $$;
create index if not exists locations_dietary_options_idx on public.locations using gin(dietary_options) where status = 'approved';
commit;
