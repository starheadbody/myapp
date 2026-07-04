import { label } from '@/lib/tags';
import type { LedgerEntry } from '@/lib/types';

// The Founder's Ledger — append-only timeline. Deliberately has NO edit or
// delete affordances; the table itself rejects mutations. Advisory entries
// (mentors) are visually distinct from operational ones.
export function Ledger({ entries }: { entries: LedgerEntry[] }) {
  if (!entries.length)
    return <p className="lede">No entries yet. The ledger only grows.</p>;

  return (
    <div className="ledger">
      {entries.map((e) => (
        <div key={e.id} className="ledger-entry">
          <span className={`ledger-dot ${e.category}`} />
          <div>
            <p className="ledger-type">
              {label(e.entry_type)}
              {e.category === 'advisory' ? ' · advisory' : ''}
            </p>
            <p className="ledger-desc">{e.description}</p>
            <p className="meta">
              {new Date(e.timestamp).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
