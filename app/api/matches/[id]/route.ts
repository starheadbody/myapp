import { NextResponse } from 'next/server';
import { getSessionState } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase/server';

// Accept/reject a proposed match. DB triggers do the heavy lifting:
// both-sides-accepted -> status 'accepted' -> thread created + ledger entry
// + dependency removed. Terminal states are immutable at the DB level.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { profile } = await getSessionState();
  if (!profile)
    return NextResponse.json({ error: 'Account not activated.' }, { status: 403 });

  const { decision } = await req.json().catch(() => ({}));
  if (!['accept', 'reject'].includes(decision))
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  const supabase = await supabaseServer();
  const { data: match } = await supabase
    .from('matches')
    .select('*, projects(owner_id)')
    .eq('id', id)
    .maybeSingle(); // RLS: parties only
  if (!match)
    return NextResponse.json({ error: 'Match not found.' }, { status: 404 });
  if (match.status !== 'proposed')
    return NextResponse.json(
      { error: `Match is already ${match.status}.` },
      { status: 409 },
    );

  const isOwner = match.projects.owner_id === profile.id;
  const patch =
    decision === 'reject'
      ? { status: 'rejected' }
      : isOwner
        ? { owner_accepted: true }
        : { candidate_accepted: true };

  const { error } = await supabase.from('matches').update(patch).eq('id', id);
  if (error)
    return NextResponse.json({ error: 'Could not update match.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
