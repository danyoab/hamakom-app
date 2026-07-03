// Temporary one-shot migration runner. Deployed, invoked once, then deleted.
// Guarded: only callable with the project's service_role key.
import postgres from 'npm:postgres@3.4.5'

const STATEMENTS = [
  // ── columns the reviews trigger + partner program need ──
  `alter table locations add column if not exists avg_rating numeric(2,1)`,
  `alter table locations add column if not exists review_count int not null default 0`,
  `alter table locations add column if not exists is_partner boolean not null default false`,
  `alter table locations add column if not exists partner_since timestamptz`,
  `alter table locations add column if not exists partner_tier text`,
  `alter table locations add column if not exists reservation_url text`,
  `alter table locations add column if not exists partner_contact text`,

  // ── community reviews (schema.sql §Community Reviews, never applied) ──
  `create table if not exists location_reviews (
    id          uuid primary key default gen_random_uuid(),
    location_id bigint references locations(id) on delete cascade,
    user_id     uuid references auth.users(id) on delete cascade,
    rating      int not null check (rating >= 1 and rating <= 5),
    body        text check (char_length(body) <= 200),
    created_at  timestamptz default now(),
    unique (location_id, user_id)
  )`,
  `alter table location_reviews enable row level security`,
  `drop policy if exists "public_read_reviews" on location_reviews`,
  `create policy "public_read_reviews" on location_reviews for select using (true)`,
  `drop policy if exists "auth_insert_review" on location_reviews`,
  `create policy "auth_insert_review" on location_reviews for insert with check (auth.uid() = user_id)`,
  `drop policy if exists "auth_update_own_review" on location_reviews`,
  `create policy "auth_update_own_review" on location_reviews for update using (auth.uid() = user_id)`,
  `create or replace function sync_location_rating() returns trigger
   language plpgsql security definer as $fn$
   declare target bigint;
   begin
     target := coalesce(new.location_id, old.location_id);
     update locations
       set avg_rating   = (select round(avg(rating)::numeric, 1) from location_reviews where location_id = target),
           review_count = (select count(*) from location_reviews where location_id = target)
       where id = target;
     return coalesce(new, old);
   end;
   $fn$`,
  `drop trigger if exists location_rating_sync on location_reviews`,
  `create trigger location_rating_sync
     after insert or update or delete on location_reviews
     for each row execute function sync_location_rating()`,

  // ── partner inquiries (For Businesses form) ──
  `create table if not exists partner_inquiries (
    id            uuid primary key default gen_random_uuid(),
    business_name text not null check (char_length(business_name) between 1 and 120),
    contact_name  text check (char_length(contact_name) <= 120),
    phone         text check (char_length(phone) <= 40),
    email         text check (char_length(email) <= 200),
    city          text check (char_length(city) <= 80),
    message       text check (char_length(message) <= 2000),
    status        text not null default 'new' check (status in ('new', 'contacted', 'closed')),
    created_at    timestamptz default now()
  )`,
  `alter table partner_inquiries enable row level security`,
  `drop policy if exists "public_insert_inquiry" on partner_inquiries`,
  `create policy "public_insert_inquiry" on partner_inquiries for insert with check (true)`,
  `drop policy if exists "admin_read_inquiries" on partner_inquiries`,
  `create policy "admin_read_inquiries" on partner_inquiries for select
     using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')`,
  `drop policy if exists "admin_update_inquiries" on partner_inquiries`,
  `create policy "admin_update_inquiries" on partner_inquiries for update
     using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')`,
]

Deno.serve(async (req) => {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response('forbidden', { status: 403 })
  }
  const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1 })
  const done: string[] = []
  try {
    for (const stmt of STATEMENTS) {
      await sql.unsafe(stmt)
      done.push(stmt.slice(0, 60).replace(/\s+/g, ' '))
    }
    const cols = await sql`
      select column_name from information_schema.columns
      where table_name = 'locations'
        and column_name in ('is_partner', 'avg_rating', 'review_count', 'partner_since')`
    const tables = await sql`
      select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name in ('location_reviews', 'partner_inquiries')`
    return Response.json({ ok: true, executed: done.length, cols, tables })
  } catch (e) {
    return Response.json({ ok: false, executed: done, error: String(e) }, { status: 500 })
  } finally {
    await sql.end()
  }
})
