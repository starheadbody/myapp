'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LEDGER_ENTRY_TYPES, label } from '@/lib/tags';

// Append a ledger entry. This is the ONLY write affordance the ledger has —
// no edit, no delete, by design. Logging work also feeds commitment_score
// and reactivates dormant projects.
export function LogWorkForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [entryType, setEntryType] = useState<string>(LEDGER_ENTRY_TYPES[0]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    const res = await fetch('/api/ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, entry_type: entryType, description }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Could not log entry.');
      return;
    }
    setDescription('');
    router.refresh();
  }

  return (
    <div className="card">
      <h3 className="card-title">Log verifiable work</h3>
      <div className="field">
        <label>Entry type</label>
        <select value={entryType} onChange={(e) => setEntryType(e.target.value)}>
          {LEDGER_ENTRY_TYPES.map((t) => (
            <option key={t} value={t}>
              {label(t)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>What happened</label>
        <textarea
          placeholder="Shipped the payments integration; demo at …"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p className="hint">Append-only. This cannot be edited or deleted. Ever.</p>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="btn-row">
        <button
          className="btn btn-block"
          disabled={busy || description.trim().length < 3}
          onClick={submit}
        >
          {busy ? 'Logging…' : 'Append to ledger'} <span className="arrow">→</span>
        </button>
      </div>
    </div>
  );
}
