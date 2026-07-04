# Venturing

A progress engine, not a social network. Venturing matches early-stage
founders with complementary co-founders, technical partners, and mentors
based on **validated project needs** — never open networking.

## The one architectural rule

**Matching is project-to-capability, never person-to-person browsing.**

Enforced at every layer:

- There is no user directory, people search, feed, likes, or follows —
  none of these surfaces exist in the codebase.
- RLS on `users` allows reading another user's row **only** through an
  existing match relationship. No policy permits enumeration.
- The only place people become visible is the owner-only candidate panel on
  a project, fed by `match_candidates()` — top 3–5 per unfilled dependency
  tag, ranked by `commitment_score` then domain overlap.
- Match rows can only be created by the server from live engine output
  (`POST /api/match` re-runs the engine and rejects any target it didn't
  surface), so you cannot "reach out" to an arbitrary person.
- Messaging tables are gated by RLS + a DB trigger to accepted matches;
  threads are created exclusively by the acceptance trigger.

## Stack

Next.js (App Router) · Supabase (Postgres + Auth) · Vercel (hosting + cron).

## Setup

1. Create a Supabase project; run `supabase/migrations/0001_venturing_init.sql`
   (SQL editor or `supabase db push`).
2. Copy `.env.example` → `.env.local` and fill in the keys. `CRON_SECRET`
   must match the value Vercel sends (set it in Vercel env vars).
3. `npm install && npm run dev`.

## How the spec's gates are implemented

### Onboarding gate (§1)
Activation **is** the creation of the `public.users` row, and that row's
`proof_of_work_url` is `NOT NULL` with a URL check — so "no null allowed"
and "no-proof users get view-only access" coexist: an authenticated person
without a profile row *is* the Learn track (view-only, unmatchable, cannot
message). Assets/gaps are Postgres enums — free text is impossible.

### Matching engine (§2)
`match_candidates(project_id, limit)` in SQL: unnests the project's
`active_dependencies`, intersects with `users.assets`, excludes mentors,
the owner, and already-matched users, ranks by `commitment_score` desc →
domain-tag overlap desc → tenure, capped at 3–5 per dependency. Exposed at
`GET /api/match` to the project owner only.

### Dormancy (§3)
`flag_dormant_projects()` flips projects with `last_activity_at` older than
30 days to `dormant` (remembering `phase_before_dormant`). Called daily by
Vercel cron → `/api/cron/dormancy` (a pg_cron alternative is commented in
the migration). Dormant projects return zero candidates. Any new ledger
entry restores the prior phase via trigger.

### Messaging (§4)
No open DMs anywhere. `threads` has a trigger rejecting inserts unless the
match is `accepted`; the thread is auto-created when both `owner_accepted`
and `candidate_accepted` become true. Message inserts are validated by RLS
against the accepted match's two parties.

### Mentors (§5)
`users.is_mentor` boolean. A ledger trigger forces mentors' entries to
`category = 'advisory'` (worth half weight in scoring). The matching engine
filters `is_mentor = false` for fillable dependencies; mentors surface only
in the separate advisory lane via `mentor_candidates()`.

### Founder's Ledger
`commitment_log` is append-only three ways: revoked UPDATE/DELETE
privileges, no RLS write policies beyond INSERT, and a trigger that raises
on any UPDATE/DELETE (blocking even service-role code). `commitment_score`
is recomputed by trigger from the log (weighted by entry type, halved for
advisory, ~90-day exponential decay) — clients can never set it.

## Minimal extensions beyond the spec (and why)

| Extension | Reason |
| --- | --- |
| `users.domain_tags`, `projects.domain_tags` | The spec ranks by "proof_of_work overlap with the project's industry/domain"; overlap needs a fixed domain vocabulary on both sides. |
| `projects.phase_before_dormant` | Reactivation must know which phase to restore. |
| `matches.owner_accepted` / `candidate_accepted` | "Accepted by both sides" requires tracking each side; `status` flips only when both are true. |
| `threads` table | Stable conversation key per accepted match. |
| `ledger_category` enum | Spec §5 requires advisory vs. operational tagging. |

## Explicitly not built (per spec)

Public bios/feeds/search/likes/follows/vanity metrics; AI matching
explanations (ranking is pure SQL filter/sort).

## Future scope (flagged, not built)

- **Authentication UI** — sessions are read via Supabase Auth (`@supabase/ssr`);
  wire up Supabase's hosted auth or a magic-link page later.
- **Match expiry sweep** — the `expired` status and immutability rules exist;
  a cron to expire stale proposals (e.g. 14 days) is a one-line addition to
  the dormancy route.
- Payment / equity legal tooling, admin dashboards, proof-of-work
  verification (human or automated review of linked URLs), notifications.
