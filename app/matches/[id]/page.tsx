import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionState } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase/server';
import { label } from '@/lib/tags';
import type { Match, Project } from '@/lib/types';
import { MatchActions } from './actions';

// A match is the only bridge between two people. Accept/reject here;
// messaging exists only after BOTH sides accept.
export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await getSessionState();
  if (!profile) notFound();

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('matches')
    .select('*, projects(*)')
    .eq('id', id)
    .maybeSingle(); // RLS: parties only
  if (!data) notFound();

  const match = data as Match & { projects: Project };
  const project = match.projects;
  const role = project.owner_id === profile.id ? 'owner' : 'candidate';
  const youAccepted =
    role === 'owner' ? match.owner_accepted : match.candidate_accepted;

  return (
    <>
      <p className="kicker">Match · {match.status}</p>
      <h1 className="display">
        Matched on{' '}
        <span className="accent">{label(match.matched_on)}.</span>
      </h1>
      <p className="lede">
        {role === 'candidate'
          ? 'This project declared a dependency your validated assets fill.'
          : 'You proposed this candidate for an open dependency.'}
      </p>

      <div className="card">
        <p className="ledger-type">Problem</p>
        <p className="ledger-desc">{project.problem_statement}</p>
        <p className="ledger-type mt-2">Target market</p>
        <p className="ledger-desc">{project.target_market}</p>
        {project.technical_constraint && (
          <>
            <p className="ledger-type mt-2">Technical constraint</p>
            <p className="ledger-desc">{project.technical_constraint}</p>
          </>
        )}
        <p className="ledger-type mt-2">Equity model</p>
        <p className="ledger-desc">{label(project.equity_model)}</p>
        <p className="meta mt-2">
          <Link href={`/u/${project.owner_id}`} style={{ textDecoration: 'underline' }}>
            Owner&rsquo;s ledger
          </Link>
          {role === 'owner' && (
            <>
              {' · '}
              <Link href={`/u/${match.user_id}`} style={{ textDecoration: 'underline' }}>
                Candidate&rsquo;s ledger
              </Link>
            </>
          )}
        </p>
      </div>

      {match.status === 'proposed' && (
        <MatchActions matchId={match.id} role={role} youAccepted={youAccepted} />
      )}

      {match.status === 'accepted' && (
        <div className="center mt-3">
          <Link href={`/messages/${match.id}`} className="btn">
            Open conversation <span className="arrow">→</span>
          </Link>
        </div>
      )}

      {(match.status === 'rejected' || match.status === 'expired') && (
        <p className="lede mt-3">
          This match is {match.status}. No conversation exists for it.
        </p>
      )}
    </>
  );
}
