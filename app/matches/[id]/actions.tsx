'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function MatchActions({
  matchId,
  role,
  youAccepted,
}: {
  matchId: string;
  role: 'owner' | 'candidate';
  youAccepted: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function decide(decision: 'accept' | 'reject') {
    setBusy(true);
    setError('');
    const res = await fetch(`/api/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Could not update match.');
      return;
    }
    router.refresh();
  }

  if (youAccepted)
    return (
      <p className="lede mt-3">
        You accepted. Waiting for the {role === 'owner' ? 'candidate' : 'owner'}
        &nbsp;— the conversation opens only when both sides accept.
      </p>
    );

  return (
    <>
      <div className="btn-row">
        <button
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => decide('reject')}
        >
          Decline
        </button>
        <button
          className="btn btn-block"
          disabled={busy}
          onClick={() => decide('accept')}
        >
          Accept match <span className="arrow">→</span>
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </>
  );
}
