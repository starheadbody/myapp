-- ============================================================
-- VENTURING — initial schema
-- Progress engine, not a social network.
-- Core invariant: matching is PROJECT-TO-CAPABILITY, never
-- person-to-person browsing. There is no user directory, no
-- search surface, no feed. Users become visible only when a
-- project's unfilled dependency intersects their assets.
-- ============================================================

-- ---------- Enums (fixed vocabularies — no free text) ----------

create type public.project_phase as enum
  ('idea', 'validating', 'building', 'launched', 'dormant', 'archived');

create type public.match_status as enum
  ('proposed', 'accepted', 'rejected', 'expired');

create type public.ledger_entry_type as enum
  ('joined_project', 'submitted_artifact', 'reached_milestone',
   'shipped_release', 'closed_customer', 'advisory_session',
   'project_created', 'dependency_filled');

-- operational = counts toward filling a dependency; advisory = mentor activity
create type public.ledger_category as enum ('operational', 'advisory');

-- Fixed asset/gap tag vocabulary. Assets and gaps draw from the SAME list
-- (a gap is a missing asset). Enforced by a domain check, not free text.
create type public.capability_tag as enum
  ('technical', 'capital', 'domain_expertise', 'sales', 'time',
   'design', 'marketing', 'operations', 'legal', 'product');

-- Fixed domain vocabulary used for proof-of-work / project overlap ranking.
create type public.domain_tag as enum
  ('fintech', 'healthtech', 'edtech', 'climate', 'ai_ml', 'consumer',
   'b2b_saas', 'marketplace', 'hardware', 'biotech', 'media', 'other');

create type public.equity_model as enum
  ('equal_split', 'dynamic_split', 'milestone_vested', 'cash_plus_equity',
   'advisory_shares', 'to_be_negotiated');

-- ---------- users ----------
-- A row here exists ONLY once onboarding is complete. proof_of_work_url is
-- NOT NULL by design: authenticated people without a row are the "Learn"
-- track (view-only, never matchable, cannot message). This is how the spec's
-- "no null allowed" and "no-proof users get view-only access" coexist.

create table public.users (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null unique,
  created_at        timestamptz not null default now(),
  assets            public.capability_tag[] not null default '{}',
  gaps              public.capability_tag[] not null default '{}',
  domain_tags       public.domain_tag[] not null default '{}',   -- domains the proof of work demonstrates
  commitment_score  numeric not null default 0,                  -- DERIVED from commitment_log; never self-reported
  proof_of_work_url text not null check (proof_of_work_url ~ '^https?://'),
  is_mentor         boolean not null default false,
  constraint assets_required check (array_length(assets, 1) >= 1)
);

comment on column public.users.commitment_score is
  'Derived by trigger from commitment_log. Any direct write is overwritten; clients must never set it.';

-- ---------- projects ----------

create table public.projects (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references public.users (id) on delete cascade,
  problem_statement    text not null check (char_length(problem_statement) between 20 and 600),
  target_market        text not null,
  current_phase        public.project_phase not null default 'idea',
  phase_before_dormant public.project_phase,   -- restored on reactivation
  technical_constraint text not null default '',
  equity_model         public.equity_model not null default 'to_be_negotiated',
  domain_tags          public.domain_tag[] not null default '{}',
  active_dependencies  public.capability_tag[] not null default '{}',  -- unfilled roles; drives matching
  last_activity_at     timestamptz not null default now(),
  created_at           timestamptz not null default now()
);

create index projects_dependencies_idx on public.projects using gin (active_dependencies);
create index projects_activity_idx on public.projects (last_activity_at)
  where current_phase not in ('dormant', 'archived');

-- ---------- commitment_log — the Founder's Ledger ----------
-- APPEND-ONLY. Publicly viewable. The single source of trust in the system.
-- No UPDATE, no DELETE — enforced three ways: privileges, RLS, and a trigger
-- (so even service-role code cannot casually rewrite history).

create table public.commitment_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete restrict,
  project_id  uuid not null references public.projects (id) on delete restrict,
  entry_type  public.ledger_entry_type not null,
  category    public.ledger_category not null default 'operational',
  description text not null check (char_length(description) between 3 and 500),
  "timestamp" timestamptz not null default now()
);

create index commitment_log_user_idx on public.commitment_log (user_id, "timestamp" desc);
create index commitment_log_project_idx on public.commitment_log (project_id, "timestamp" desc);

create or replace function public.forbid_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'commitment_log is append-only: % is not permitted', tg_op;
end $$;

create trigger commitment_log_append_only
  before update or delete on public.commitment_log
  for each row execute function public.forbid_ledger_mutation();

revoke update, delete on public.commitment_log from anon, authenticated;

-- Mentors write advisory entries; advisory entries never carry operational weight.
create or replace function public.enforce_ledger_category()
returns trigger language plpgsql security definer set search_path = public as $$
declare mentor boolean;
begin
  select is_mentor into mentor from public.users where id = new.user_id;
  if mentor then
    new.category := 'advisory';
  end if;
  return new;
end $$;

create trigger commitment_log_category
  before insert on public.commitment_log
  for each row execute function public.enforce_ledger_category();

-- Ledger inserts drive everything derived:
--   1. recompute the author's commitment_score (weighted, recency-decayed)
--   2. bump project.last_activity_at
--   3. reactivate a dormant project
create or replace function public.after_ledger_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.users u set commitment_score = (
    select coalesce(sum(
      (case l.entry_type
         when 'reached_milestone'  then 5
         when 'shipped_release'    then 5
         when 'closed_customer'    then 4
         when 'submitted_artifact' then 3
         when 'dependency_filled'  then 3
         when 'joined_project'     then 2
         when 'project_created'    then 2
         when 'advisory_session'   then 1
       end)
      * (case category when 'advisory' then 0.5 else 1.0 end)
      * exp(-extract(epoch from (now() - l."timestamp")) / (86400.0 * 90))  -- 90-day half-life-ish decay
    ), 0)
    from public.commitment_log l where l.user_id = new.user_id
  )
  where u.id = new.user_id;

  update public.projects p
     set last_activity_at = greatest(p.last_activity_at, new."timestamp"),
         current_phase = case
           when p.current_phase = 'dormant'
             then coalesce(p.phase_before_dormant, 'validating')
           else p.current_phase end,
         phase_before_dormant = case
           when p.current_phase = 'dormant' then null
           else p.phase_before_dormant end
   where p.id = new.project_id;

  return new;
end $$;

create trigger commitment_log_after_insert
  after insert on public.commitment_log
  for each row execute function public.after_ledger_insert();

-- ---------- matches ----------

create table public.matches (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  matched_on  public.capability_tag not null,   -- the dependency tag that triggered this match
  status      public.match_status not null default 'proposed',
  owner_accepted     boolean not null default false,
  candidate_accepted boolean not null default false,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  unique (project_id, user_id, matched_on)
);

-- status becomes 'accepted' only when BOTH sides accept (spec §4).
create or replace function public.settle_match_status()
returns trigger language plpgsql as $$
declare v_owner uuid;
begin
  -- Each side may only flip its own acceptance flag (auth.uid() is null for
  -- service-role/server calls, which are trusted).
  if auth.uid() is not null then
    select p.owner_id into v_owner from public.projects p where p.id = new.project_id;
    if new.owner_accepted <> old.owner_accepted and auth.uid() <> v_owner then
      raise exception 'only the project owner can accept for the owner side';
    end if;
    if new.candidate_accepted <> old.candidate_accepted and auth.uid() <> new.user_id then
      raise exception 'only the candidate can accept for the candidate side';
    end if;
  end if;
  if new.owner_accepted and new.candidate_accepted and old.status = 'proposed' then
    new.status := 'accepted';
    new.decided_at := now();
  end if;
  if new.status in ('rejected', 'expired') and old.status = 'proposed' then
    new.decided_at := now();
  end if;
  -- terminal states are immutable
  if old.status in ('accepted', 'rejected', 'expired') and new.status <> old.status then
    raise exception 'match % is settled (%); status cannot change', old.id, old.status;
  end if;
  return new;
end $$;

create trigger matches_settle before update on public.matches
  for each row execute function public.settle_match_status();

-- On acceptance: create the (only possible) conversation thread and write
-- the joined_project ledger entry.
create or replace function public.on_match_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    insert into public.threads (match_id) values (new.id);
    insert into public.commitment_log (user_id, project_id, entry_type, description)
    values (new.user_id, new.project_id, 'joined_project',
            'Joined project to fill the "' || new.matched_on || '" dependency');
    -- the dependency is now filled
    update public.projects
       set active_dependencies = array_remove(active_dependencies, new.matched_on)
     where id = new.project_id;
  end if;
  return new;
end $$;

create trigger matches_on_accept after update on public.matches
  for each row execute function public.on_match_accepted();

-- ---------- messaging (exists ONLY behind an accepted match) ----------

create table public.threads (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null unique references public.matches (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.threads (id) on delete cascade,
  sender_id  uuid not null references public.users (id),
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index messages_thread_idx on public.messages (thread_id, created_at);

-- Threads may only ever exist for accepted matches (belt & braces on top of RLS).
create or replace function public.enforce_thread_gate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.matches m
                  where m.id = new.match_id and m.status = 'accepted') then
    raise exception 'threads can only be created for accepted matches';
  end if;
  return new;
end $$;

create trigger threads_gate before insert on public.threads
  for each row execute function public.enforce_thread_gate();

-- ---------- MATCHING ENGINE ----------
-- project-to-capability only. For ONE project, per unfilled dependency tag,
-- return the top N users whose assets contain that tag, ranked by
-- commitment_score desc, then domain overlap with the project, then tenure.
-- Mentors are NEVER returned as fillable-dependency candidates.
-- Dormant/archived projects return nothing.

create or replace function public.match_candidates(p_project_id uuid, p_limit int default 5)
returns table (
  dependency     public.capability_tag,
  user_id        uuid,
  commitment_score numeric,
  domain_overlap int,
  proof_of_work_url text
)
language sql stable security definer set search_path = public as $$
  select dep, u.id, u.commitment_score,
         coalesce(array_length(
           (select array_agg(d) from unnest(u.domain_tags) d
             where d = any (p.domain_tags)), 1), 0) as domain_overlap,
         u.proof_of_work_url
  from public.projects p
  cross join lateral unnest(p.active_dependencies) as dep
  join lateral (
    select u.*
    from public.users u
    where dep = any (u.assets)
      and u.is_mentor = false                       -- spec §5: mentors never fill operational deps
      and u.id <> p.owner_id
      and not exists (select 1 from public.matches m
                       where m.project_id = p.id and m.user_id = u.id
                         and m.matched_on = dep and m.status in ('proposed','accepted','rejected'))
    order by
      u.commitment_score desc,
      coalesce(array_length((select array_agg(d) from unnest(u.domain_tags) d
                              where d = any (p.domain_tags)), 1), 0) desc,
      u.created_at asc
    limit greatest(3, least(p_limit, 5))            -- spec §2: top 3–5, hard cap
  ) u on true
  where p.id = p_project_id
    and p.current_phase not in ('dormant', 'archived')   -- spec §3
$$;

-- Mentor matching: identical mechanics, advisory lane. Surfaced separately;
-- never mixed into fillable-dependency candidates.
create or replace function public.mentor_candidates(p_project_id uuid, p_limit int default 5)
returns table (user_id uuid, commitment_score numeric, domain_overlap int, proof_of_work_url text)
language sql stable security definer set search_path = public as $$
  select u.id, u.commitment_score,
         coalesce(array_length((select array_agg(d) from unnest(u.domain_tags) d
                                 where d = any (p.domain_tags)), 1), 0),
         u.proof_of_work_url
  from public.projects p, public.users u
  where p.id = p_project_id
    and p.current_phase not in ('dormant', 'archived')
    and u.is_mentor = true
    and u.id <> p.owner_id
    and (u.assets && p.active_dependencies or u.domain_tags && p.domain_tags)
  order by u.commitment_score desc, 3 desc
  limit greatest(3, least(p_limit, 5))
$$;

-- ---------- DORMANCY ----------
-- Called by the scheduled job (Vercel cron -> /api/cron/dormancy, or pg_cron).
create or replace function public.flag_dormant_projects()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.projects
     set phase_before_dormant = current_phase,
         current_phase = 'dormant'
   where current_phase not in ('dormant', 'archived')
     and last_activity_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- pg_cron alternative (uncomment if the extension is enabled):
-- select cron.schedule('venturing-dormancy', '0 4 * * *', $$select public.flag_dormant_projects()$$);

-- ---------- ROW LEVEL SECURITY ----------
-- Design rule: there is NO policy that lets a user enumerate other users.
-- Another user's row is readable only through a legitimate relationship
-- (a match involving you, a shared thread) or their public ledger page.

alter table public.users          enable row level security;
alter table public.projects       enable row level security;
alter table public.commitment_log enable row level security;
alter table public.matches        enable row level security;
alter table public.threads        enable row level security;
alter table public.messages       enable row level security;

-- users: read own row; read a row only when linked by a match.
-- (Profile pages for arbitrary users go through the server with the
-- service role and expose ONLY assets/gaps/proof/ledger — spec's public set.)
create policy users_self_read on public.users
  for select using (id = auth.uid());
create policy users_match_read on public.users
  for select using (exists (
    select 1 from public.matches m
    join public.projects p on p.id = m.project_id
    where (m.user_id = users.id and p.owner_id = auth.uid())
       or (m.user_id = auth.uid() and p.owner_id = users.id)));
create policy users_self_insert on public.users
  for insert with check (id = auth.uid());
-- self-update: profile fields only; commitment_score is trigger-owned and
-- overwritten on next ledger insert regardless.
create policy users_self_update on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- projects: owner full control; activated users may read non-archived
-- projects they've been matched to (needed to evaluate a proposal).
create policy projects_owner_all on public.projects
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy projects_matched_read on public.projects
  for select using (exists (
    select 1 from public.matches m
    where m.project_id = projects.id and m.user_id = auth.uid()));

-- commitment_log: PUBLICLY viewable (the trust mechanism), append by author only.
create policy ledger_public_read on public.commitment_log
  for select using (true);
create policy ledger_author_insert on public.commitment_log
  for insert with check (
    user_id = auth.uid()
    and exists (          -- must actually be attached to the project
      select 1 from public.projects p
      where p.id = project_id
        and (p.owner_id = auth.uid()
             or exists (select 1 from public.matches m
                         where m.project_id = p.id and m.user_id = auth.uid()
                           and m.status = 'accepted'))));

-- matches: visible to the two parties only. Created server-side (service role)
-- by the matching engine — clients cannot invent matches.
create policy matches_party_read on public.matches
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.projects p
                where p.id = matches.project_id and p.owner_id = auth.uid()));
create policy matches_party_update on public.matches
  for update using (
    user_id = auth.uid()
    or exists (select 1 from public.projects p
                where p.id = matches.project_id and p.owner_id = auth.uid()));

-- threads/messages: parties of the accepted match only.
create policy threads_party_read on public.threads
  for select using (exists (
    select 1 from public.matches m
    join public.projects p on p.id = m.project_id
    where m.id = threads.match_id and m.status = 'accepted'
      and (m.user_id = auth.uid() or p.owner_id = auth.uid())));

create policy messages_party_read on public.messages
  for select using (exists (
    select 1 from public.threads t
    join public.matches m on m.id = t.match_id
    join public.projects p on p.id = m.project_id
    where t.id = messages.thread_id and m.status = 'accepted'
      and (m.user_id = auth.uid() or p.owner_id = auth.uid())));
create policy messages_party_insert on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.threads t
      join public.matches m on m.id = t.match_id
      join public.projects p on p.id = m.project_id
      where t.id = thread_id and m.status = 'accepted'
        and (m.user_id = auth.uid() or p.owner_id = auth.uid())));
