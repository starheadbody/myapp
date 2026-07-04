'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  CAPABILITY_TAGS,
  DOMAIN_TAGS,
  EQUITY_MODELS,
  PROJECT_PHASES,
  label,
} from '@/lib/tags';

// Project creation (spec deliverable 3). Order follows the spec:
// problem_statement -> target_market -> current_phase -> technical_constraint
// -> equity_model -> active_dependencies.
export default function NewProject() {
  const router = useRouter();
  const [form, setForm] = useState({
    problem_statement: '',
    target_market: '',
    current_phase: 'idea',
    technical_constraint: '',
    equity_model: 'to_be_negotiated',
  });
  const [deps, setDeps] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (list: string[], setter: (v: string[]) => void, t: string) =>
    setter(list.includes(t) ? list.filter((x) => x !== t) : [...list, t]);

  async function submit() {
    setBusy(true);
    setError('');
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, active_dependencies: deps, domain_tags: domains }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Could not create project.');
      return;
    }
    const { id } = await res.json();
    router.push(`/projects/${id}`);
    router.refresh();
  }

  return (
    <>
      <p className="kicker">Declare a project</p>
      <h1 className="display">
        State the problem,
        <br />
        name the need.
      </h1>

      <div className="field">
        <label>Problem statement</label>
        <textarea
          placeholder="What is broken, for whom, and what evidence do you have? (20–600 chars)"
          value={form.problem_statement}
          onChange={(e) => set('problem_statement', e.target.value)}
        />
      </div>

      <div className="field">
        <label>Target market</label>
        <input
          placeholder="Who pays, and how many of them exist?"
          value={form.target_market}
          onChange={(e) => set('target_market', e.target.value)}
        />
      </div>

      <div className="field">
        <label>Current phase</label>
        <select
          value={form.current_phase}
          onChange={(e) => set('current_phase', e.target.value)}
        >
          {PROJECT_PHASES.map((p) => (
            <option key={p} value={p}>
              {label(p)}
            </option>
          ))}
        </select>
        <p className="hint">
          Dormant and archived are system-managed — you cannot choose them.
        </p>
      </div>

      <div className="field">
        <label>Technical constraint</label>
        <input
          placeholder="The hardest technical thing this must do"
          value={form.technical_constraint}
          onChange={(e) => set('technical_constraint', e.target.value)}
        />
      </div>

      <div className="field">
        <label>Equity model</label>
        <select
          value={form.equity_model}
          onChange={(e) => set('equity_model', e.target.value)}
        >
          {EQUITY_MODELS.map((m) => (
            <option key={m} value={m}>
              {label(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Domain</label>
        <div className="tag-grid" style={{ marginTop: 4 }}>
          {DOMAIN_TAGS.map((t) => (
            <button
              key={t}
              className={`tag ${domains.includes(t) ? 'on' : ''}`}
              onClick={() => toggle(domains, setDomains, t)}
            >
              {label(t)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Active dependencies — unfilled roles this project needs</label>
        <div className="tag-grid" style={{ marginTop: 4 }}>
          {CAPABILITY_TAGS.map((t) => (
            <button
              key={t}
              className={`tag ${deps.includes(t) ? 'on' : ''}`}
              onClick={() => toggle(deps, setDeps, t)}
            >
              {label(t)}
            </button>
          ))}
        </div>
        <p className="hint">
          The matching engine runs on these tags. It only surfaces candidates
          for declared needs — there is no browsing.
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="btn-row">
        <button
          className="btn btn-block"
          disabled={busy || deps.length === 0}
          onClick={submit}
        >
          {busy ? 'Creating…' : 'Create project'} <span className="arrow">→</span>
        </button>
      </div>
    </>
  );
}
