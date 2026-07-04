import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { label } from '@/lib/tags';
import type { LedgerEntry } from '@/lib/types';
import { Ledger } from '@/components/Ledger';

// PUBLIC profile — deliberately minimal (spec: nothing beyond assets, gaps,
// proof_of_work, commitment_log). No bio, no photo, no follower counts, no
// contact. Served via the admin client with an explicit column allowlist;
// email is never exposed. This page is reachable only from a match or a
// ledger reference — there is no index of users anywhere.
export default async function PublicLedger({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = supabaseAdmin();

  const { data: user } = await admin
    .from('users')
    .select(
      'id, assets, gaps, domain_tags, commitment_score, proof_of_work_url, is_mentor, created_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (!user) notFound();

  const { data: entries } = await admin
    .from('commitment_log')
    .select('*')
    .eq('user_id', id)
    .order('timestamp', { ascending: false })
    .limit(100);

  return (
    <>
      <p className="kicker">
        Founder&rsquo;s ledger{user.is_mentor ? ' · mentor' : ''}
      </p>
      <h1 className="display">
        The record
        <br />
        speaks.
      </h1>

      <div className="card">
        <div className="row">
          <div>
            <p className="ledger-type">Commitment score</p>
            <p className="score">{Number(user.commitment_score).toFixed(1)}</p>
          </div>
          <a
            className="link-caps"
            href={user.proof_of_work_url}
            target="_blank"
            rel="noreferrer"
          >
            Proof of work <span>→</span>
          </a>
        </div>
        <p className="ledger-type mt-2">Assets</p>
        <div className="tag-grid" style={{ justifyContent: 'flex-start' }}>
          {user.assets.map((t: string) => (
            <span key={t} className="tag static on">
              {label(t)}
            </span>
          ))}
        </div>
        <p className="ledger-type mt-2">Gaps</p>
        <div className="tag-grid" style={{ justifyContent: 'flex-start' }}>
          {user.gaps.map((t: string) => (
            <span key={t} className="tag static">
              {label(t)}
            </span>
          ))}
        </div>
      </div>

      <p className="kicker mt-4">Append-only · no edits · no deletes</p>
      <Ledger entries={(entries ?? []) as LedgerEntry[]} />
    </>
  );
}
