import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Dormancy sweep (spec §3). Invoked daily by Vercel cron (vercel.json).
// Projects with no ledger activity for 30 days flip to 'dormant' and vanish
// from the matching engine; a new commitment_log entry reactivates them
// (handled by the after_ledger_insert trigger).
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc('flag_dormant_projects');
  if (error)
    return NextResponse.json({ error: 'Sweep failed.' }, { status: 500 });

  return NextResponse.json({ flagged_dormant: data ?? 0 });
}
