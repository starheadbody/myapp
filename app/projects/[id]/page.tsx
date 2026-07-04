import { notFound } from 'next/navigation';
import { getSessionState } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase/server';
import { label } from '@/lib/tags';
import type { LedgerEntry, Project } from '@/lib/types';
import { Ledger } from '@/components/Ledger';
import { CandidatePanel } from './candidates';
import { LogWorkForm } from './log-work';

// Project workbench. The candidate panel is the ONLY place people become
// visible, and only to this project's owner, only for unfilled dependencies.
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await getSessionState();
  const supabase = await supabaseServer();

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!project) notFound(); // RLS: visible only to owner or matched users

  const p = project as Project;
  const isOwner = profile?.id === p.owner_id;

  const { data: entries } = await supabase
    .from('commitment_log')
    .select('*')
    .eq('project_id', id)
    .order('timestamp', { ascending: false })
    .limit(50);

  return (
    <>
      <p className="kicker">Project</p>
      <h1 className="display">{p.problem_statement.slice(0, 90)}</h1>
      <div className="center mt-2">
        <span className={`phase-pill ${p.current_phase}`}>{p.current_phase}</span>
      </div>
      {p.current_phase === 'dormant' && (
        <p className="lede">
          Dormant: no ledger activity for 30 days. Matching is paused until a
          new entry is logged.
        </p>
      )}

      <div className="card">
        <p className="ledger-type">Target market</p>
        <p className="ledger-desc">{p.target_market}</p>
        {p.technical_constraint && (
          <>
            <p className="ledger-type mt-2">Technical constraint</p>
            <p className="ledger-desc">{p.technical_constraint}</p>
          </>
        )}
        <p className="ledger-type mt-2">Equity model</p>
        <p className="ledger-desc">{label(p.equity_model)}</p>
        <p className="ledger-type mt-2">Open dependencies</p>
        <div className="tag-grid" style={{ justifyContent: 'flex-start' }}>
          {p.active_dependencies.length ? (
            p.active_dependencies.map((d) => (
              <span key={d} className="tag static lav">
                {label(d)}
              </span>
            ))
          ) : (
            <span className="meta">All dependencies filled.</span>
          )}
        </div>
      </div>

      {isOwner && p.active_dependencies.length > 0 && (
        <CandidatePanel projectId={p.id} />
      )}

      {isOwner && <LogWorkForm projectId={p.id} />}

      <p className="kicker mt-4">Project ledger</p>
      <Ledger entries={(entries ?? []) as LedgerEntry[]} />
    </>
  );
}
