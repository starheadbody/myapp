import { NextResponse } from 'next/server';
import {
  CAPABILITY_TAGS,
  DOMAIN_TAGS,
  EQUITY_MODELS,
  PROJECT_PHASES,
} from '@/lib/tags';
import { getSessionState } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const { authUser, profile } = await getSessionState();
  if (!authUser)
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!profile)
    return NextResponse.json(
      { error: 'Account not activated — complete onboarding first.' },
      { status: 403 },
    );

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  const deps = (body.active_dependencies ?? []).filter((t: string) =>
    (CAPABILITY_TAGS as readonly string[]).includes(t),
  );
  const domain_tags = (body.domain_tags ?? []).filter((t: string) =>
    (DOMAIN_TAGS as readonly string[]).includes(t),
  );
  const phase = (PROJECT_PHASES as readonly string[]).includes(body.current_phase)
    ? body.current_phase
    : 'idea'; // dormant/archived can never be set by a user
  const equity = (EQUITY_MODELS as readonly string[]).includes(body.equity_model)
    ? body.equity_model
    : 'to_be_negotiated';

  const problem = String(body.problem_statement ?? '').trim();
  if (problem.length < 20 || problem.length > 600)
    return NextResponse.json(
      { error: 'Problem statement must be 20–600 characters.' },
      { status: 400 },
    );
  if (!String(body.target_market ?? '').trim())
    return NextResponse.json({ error: 'Target market is required.' }, { status: 400 });
  if (deps.length === 0)
    return NextResponse.json(
      { error: 'Declare at least one active dependency.' },
      { status: 400 },
    );

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('projects')
    .insert({
      owner_id: profile.id,
      problem_statement: problem,
      target_market: String(body.target_market).trim(),
      current_phase: phase,
      technical_constraint: String(body.technical_constraint ?? '').trim(),
      equity_model: equity,
      domain_tags,
      active_dependencies: deps,
    })
    .select('id')
    .single();

  if (error || !data)
    return NextResponse.json({ error: 'Could not create project.' }, { status: 400 });

  // Founding entry in the ledger — this also stamps last_activity_at.
  await supabase.from('commitment_log').insert({
    user_id: profile.id,
    project_id: data.id,
    entry_type: 'project_created',
    description: `Declared project: ${problem.slice(0, 80)}`,
  });

  return NextResponse.json({ id: data.id });
}
