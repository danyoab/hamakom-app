-- Public discovery should never expose locations.notes_internal,
-- partner_contact, manual_edits, or curator identities. The previous SELECT
-- policy exposed every column of every approved row, even via the anon API.
-- Deploy the compatible frontend first, then apply this migration.
begin;
create or replace view public.public_location_catalog with (security_barrier = true) as
select l.id,
  (select jsonb_object_agg(field.key, field.value)
   from jsonb_each(to_jsonb(l)) field
   where field.key = any(array[
     'id','slug','name','name_he','city','city_he','region','category','occasion','price','date_stage',
     'description','description_he','maps_query','kashrus','featured','status','image_url','lat','lng',
     'business_status','formatted_address','phone','website','opening_hours','last_enriched_at',
     'google_rating','google_place_id','avg_rating','review_count','is_partner','partner_tier','reservation_url',
     'kashrut_status','kashrut_authority','kashrut_certificate_expiry','kashrut_last_verified_at',
     'kashrut_verification_source','kashrut_level','vibe_tags','indoor_outdoor','best_time','weather_fit',
     'romantic_score','conversation_score','energy_score','quietness_score','activity_vs_food_score',
     'group_vs_intimate_score','duration_min','duration_max','confidence_score','menu_url','menu_scope',
     'menu_checked_at','dietary_options','dietary_source_url','dietary_scope','dietary_checked_at','food_type',
     'details_source_url','details_checked_at'
   ])) as venue
from public.locations l where l.status = 'approved';
revoke all on public.public_location_catalog from public;
grant select on public.public_location_catalog to anon, authenticated;
drop policy if exists "public_read_approved" on public.locations;
revoke select on public.locations from anon;
-- Existing admin_read_all_locations checks app_metadata.role = admin.
-- Signed-in public visitors use the view, not the base table.
commit;
