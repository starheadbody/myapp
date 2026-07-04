import { NextResponse } from 'next/server';
import { getSessionState } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase/server';

const USER_WRITABLE = [
  'submitted_artifact',
  'reached_milestone',
  'shipped_release',
  'closed_customer',
  'advisory_session',
];

// Append-only ledger writes. RLS enforces that the author is attached to the
// project (owner or accepted match); DB triggers set advisory category for
// mentors, recompute commitment_score, and reactivate dormant projects.
export async function POST(req: Request) {
  const { profile } = await getSessionState();
  if (!profile)
    return NextResponse.json({ error: 'Account not activated.' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const description = String(body?.description ?? '').trim();
  if (!body?.project_id || !USER_WRITABLE.includes(body?.entry_type))
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  if (description.length < 3 || description.length > 500)
    return NextResponse.json(
      { error: 'Description must be 3–500 characters.' },
      { status: 400 },
    );

  const supabase = await supabaseServer();
  const { error } = await supabase.from('commitment_log').insert({
    user_id: profile.id,
    project_id: body.project_id,
    entry_type: body.entry_type,
    description,
  });
  if (error)
    return NextResponse.json(
      { error: 'Not permitted — you must own the project or hold an accepted match.' },
      { status: 403 },
    );
  return NextResponse.json({ ok: true });
}
