'use client';

import { useEffect, useState } from 'react';
import { label } from '@/lib/tags';
import type { Candidate } from '@/lib/types';

// Owner-only surface of engine output: top 3–5 per open dependency.
// Candidates are shown as evidence (score, domain overlap, proof of work),
// not as profiles — there is nothing to browse beyond this.
export function CandidatePanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<{
    candidates: Record<string, Candidate[]>;
    mentors: Candidate[];
    reason?: string;
  } | null>(null);
  const [proposed, setProposed] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/match?project_id=${projectId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError('Could not load matches.'));
  }, [projectId]);

  async function propose(c: Candidate) {
    setError('');
    const res = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        user_id: c.user_id,
        matched_on: c.dependency,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Proposal failed.');
      return;
    }
    setProposed((p) => [...p, `${c.user_id}:${c.dependency}`]);
  }

  if (!data) return <p className="lede mt-3">Running the matching engine…</p>;
  if (data.reason) return <p className="lede mt-3">{data.reason}</p>;

  const deps = Object.keys(data.candidates ?? {});

  return (
    <>
      <p className="kicker mt-4">Matched capability, not people</p>
      {deps.length === 0 && (
        <p className="lede">
          No candidates currently fit these dependencies. Candidates appear as
          founders with matching validated assets activate.
        </p>
      )}
      {deps.map((dep) => (
        <div key={dep}>
          <p className="ledger-type mt-3">needs · {label(dep)}</p>
          {data.candidates[dep].map((c) => {
            const key = `${c.user_id}:${c.dependency}`;
            return (
              <div key={key} className="card">
                <div className="row">
                  <div>
                    <p className="ledger-type">commitment score</p>
                    <p className="score">{Number(c.commitment_score).toFixed(1)}</p>
                    <p className="meta mt-1">
                      domain overlap: {c.domain_overlap} ·{' '}
                      <a
                        href={c.proof_of_work_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: 'underline' }}
                      >
                        proof of work
                      </a>{' '}
                      ·{' '}
                      <a href={`/u/${c.user_id}`} style={{ textDecoration: 'underline' }}>
                        ledger
                      </a>
                    </p>
                  </div>
                  {proposed.includes(key) ? (
                    <span className="phase-pill">proposed</span>
                  ) : (
                    <button className="btn" onClick={() => propose(c)}>
                      Propose <span className="arrow">→</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {data.mentors?.length ? (
        <>
          <p className="ledger-type mt-3">advisory · mentors</p>
          <p className="hint">
            Mentors advise; they never fill operational dependencies.
          </p>
          {data.mentors.map((m) => (
            <div key={m.user_id} className="card">
              <div className="row">
                <div>
                  <p className="ledger-type">commitment score</p>
                  <p className="score">{Number(m.commitment_score).toFixed(1)}</p>
                  <p className="meta mt-1">
                    <a href={`/u/${m.user_id}`} style={{ textDecoration: 'underline' }}>
                      ledger
                    </a>
                  </p>
                </div>
                <span className="phase-pill">mentor</span>
              </div>
            </div>
          ))}
        </>
      ) : null}
      {error && <p className="error">{error}</p>}
    </>
  );
}
