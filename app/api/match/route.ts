import { NextResponse } from 'next/server';
import { getSessionState } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Candidate } from '@/lib/types';

// MATCHING ENGINE (spec §2). Project-to-capability only.
// GET  /api/match?project_id=X  -> top 3–5 candidates per unfilled dependency,
//                                  ranked commitment_score desc, then domain overlap.
//                                  Owner-only: candidates are never a public surface.
// POST /api/match               -> owner proposes a match to one surfaced candidate.
//                                  Match rows are only ever created here, from
//                                  engine output — clients cannot invent them.

async function requireOwnedProject(projectId: string) {
  const { profile } = await getSessionState();
  if (!profile) return { error: 'Account not activated.', status: 403 as const };
  const admin = supabaseAdmin();
  const { data: project } = await admin
    .from('projects')
    .select('id, owner_id, current_phase, active_dependencies, domain_tags')
    .eq('id', projectId)
    .single();
  if (!project || project.owner_id !== profile.id)
    return { error: 'Project not found.', status: 404 as const };
  return { profile, project, admin };
}

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get('project_id');
  if (!projectId)
    return NextResponse.json({ error: 'project_id required.' }, { status: 400 });

  const ctx = await requireOwnedProject(projectId);
  if ('error' in ctx)
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  if (['dormant', 'archived'].includes(ctx.project.current_phase))
    return NextResponse.json({
      candidates: [],
      mentors: [],
      reason: 'Project is dormant — log new work to reactivate matching.',
    });

  const [{ data: candidates, error: e1 }, { data: mentors }] = await Promise.all([
    ctx.admin.rpc('match_candidates', { p_project_id: projectId, p_limit: 5 }),
    ctx.admin.rpc('mentor_candidates', { p_project_id: projectId, p_limit: 3 }),
  ]);
  if (e1)
    return NextResponse.json({ error: 'Matching query failed.' }, { status: 500 });

  // Group per dependency; expose only what a proposal decision needs —
  // no emails, no bios. Identity is revealed through the match itself.
  const grouped: Record<string, Candidate[]> = {};
  for (const c of (candidates ?? []) as Candidate[]) {
    (grouped[c.dependency] ??= []).push(c);
  }
  return NextResponse.json({ candidates: grouped, mentors: mentors ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.project_id || !body?.user_id || !body?.matched_on)
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  const ctx = await requireOwnedProject(body.project_id);
  if ('error' in ctx)
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  // Re-run the engine server-side: a proposal is only valid for a candidate
  // the engine currently surfaces (prevents free-form person targeting).
  const { data: candidates } = await ctx.admin.rpc('match_candidates', {
    p_project_id: body.project_id,
    p_limit: 5,
  });
  const valid = ((candidates ?? []) as Candidate[]).some(
    (c) => c.user_id === body.user_id && c.dependency === body.matched_on,
  );
  if (!valid)
    return NextResponse.json(
      { error: 'That user is not a surfaced candidate for this dependency.' },
      { status: 400 },
    );

  const { data, error } = await ctx.admin
    .from('matches')
    .insert({
      project_id: body.project_id,
      user_id: body.user_id,
      matched_on: body.matched_on,
      owner_accepted: true, // proposing implies the owner's side
    })
    .select('id')
    .single();

  if (error)
    return NextResponse.json(
      { error: 'Match already exists or could not be created.' },
      { status: 400 },
    );
  return NextResponse.json({ id: data.id });
}
