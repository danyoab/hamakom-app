-- The restored database had 317 explicitly seeded IDs, but its sequence was
-- still at 1. New approved submissions collided with existing records.
begin;
lock table public.locations in share row exclusive mode;
select setval('public.locations_id_seq', greatest(
  (select coalesce(max(id), 1) from public.locations),
  (select last_value from public.locations_id_seq)
), true);
commit;
