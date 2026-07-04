import { NextResponse } from 'next/server';
import { CAPABILITY_TAGS, DOMAIN_TAGS } from '@/lib/tags';
import { supabaseServer } from '@/lib/supabase/server';

// Creates the users row = account activation. The row cannot exist without
// proof_of_work_url (DB NOT NULL), which is the whole gate: no proof, no
// profile, no matching, no messaging.
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  const assets = (body.assets ?? []).filter((t: string) =>
    (CAPABILITY_TAGS as readonly string[]).includes(t),
  );
  const gaps = (body.gaps ?? []).filter((t: string) =>
    (CAPABILITY_TAGS as readonly string[]).includes(t),
  );
  const domain_tags = (body.domain_tags ?? []).filter((t: string) =>
    (DOMAIN_TAGS as readonly string[]).includes(t),
  );
  const proof = String(body.proof_of_work_url ?? '');

  if (assets.length === 0)
    return NextResponse.json({ error: 'Select at least one asset.' }, { status: 400 });
  if (gaps.length === 0)
    return NextResponse.json({ error: 'Select at least one gap.' }, { status: 400 });
  if (!/^https?:\/\/.+\..+/.test(proof))
    return NextResponse.json(
      { error: 'A valid proof-of-work URL is required — no exceptions.' },
      { status: 400 },
    );

  const { error } = await supabase.from('users').insert({
    id: user.id,
    email: user.email,
    assets,
    gaps,
    domain_tags,
    proof_of_work_url: proof,
    is_mentor: Boolean(body.is_mentor),
    // commitment_score intentionally omitted — derived by DB trigger only
  });

  if (error) {
    const msg =
      error.code === '23505'
        ? 'Account already activated.'
        : 'Could not activate account.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
