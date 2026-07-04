'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CAPABILITY_TAGS, DOMAIN_TAGS, label } from '@/lib/tags';

// Mandatory onboarding gate (spec §1). Four steps, no skipping:
// assets -> gaps -> proof of work (+ domains) -> activation.
// Assets/gaps are fixed-vocabulary chips only — no free text.
const STEPS = ['assets', 'gaps', 'proof', 'activate'] as const;

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [assets, setAssets] = useState<string[]>([]);
  const [gaps, setGaps] = useState<string[]>([]);
  const [proofUrl, setProofUrl] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  const [isMentor, setIsMentor] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, tag: string) =>
    set(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);

  const canAdvance =
    (step === 0 && assets.length > 0) ||
    (step === 1 && gaps.length > 0) ||
    (step === 2 && /^https?:\/\/.+\..+/.test(proofUrl)) ||
    step === 3;

  async function activate() {
    setBusy(true);
    setError('');
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assets,
        gaps,
        proof_of_work_url: proofUrl,
        domain_tags: domains,
        is_mentor: isMentor,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? 'Activation failed.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <>
      <p className="kicker">Onboarding · step {step + 1} of 4</p>

      {step === 0 && (
        <>
          <h1 className="display">
            What do you
            <br />
            bring?
          </h1>
          <p className="lede">
            Your assets. Fixed list — matching runs on these tags, so choose
            only what you can prove.
          </p>
          <div className="tag-grid">
            {CAPABILITY_TAGS.map((t) => (
              <button
                key={t}
                className={`tag ${assets.includes(t) ? 'on' : ''}`}
                onClick={() => toggle(assets, setAssets, t)}
              >
                {label(t)}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h1 className="display">
            What are you
            <br />
            missing?
          </h1>
          <p className="lede">
            Your gaps — the capabilities your future projects will declare as
            dependencies.
          </p>
          <div className="tag-grid">
            {CAPABILITY_TAGS.filter((t) => !assets.includes(t)).map((t) => (
              <button
                key={t}
                className={`tag ${gaps.includes(t) ? 'on' : ''}`}
                onClick={() => toggle(gaps, setGaps, t)}
              >
                {label(t)}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="display">
            Proof of work.
            <br />
            <span className="accent">Required.</span>
          </h1>
          <p className="lede">
            One link that shows you finish things: GitHub, a deck, writing, a
            financial model. Without it your account stays view-only.
          </p>
          <div className="field">
            <label htmlFor="pow">Proof of work URL</label>
            <input
              id="pow"
              type="url"
              placeholder="https://github.com/you/thing-you-shipped"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Domains this proof demonstrates</label>
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
            <p className="hint">Used to rank you for domain-relevant projects.</p>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="display">
            Activate your
            <br />
            ledger.
          </h1>
          <p className="lede">
            From here, your public record is your commitment log — append-only,
            no edits, no deletes. Your score is derived from what you log, never
            self-reported.
          </p>
          <div className="card">
            <p className="ledger-type">Assets</p>
            <p className="ledger-desc">{assets.map(label).join(', ')}</p>
            <p className="ledger-type mt-2">Gaps</p>
            <p className="ledger-desc">{gaps.map(label).join(', ')}</p>
            <p className="ledger-type mt-2">Proof of work</p>
            <p className="ledger-desc">{proofUrl}</p>
          </div>
          <div className="card">
            <label className="row" style={{ cursor: 'pointer' }}>
              <span className="ledger-desc">
                Join as a mentor (advisory role — you will never be matched to
                fill operational roles like technical or capital)
              </span>
              <input
                type="checkbox"
                checked={isMentor}
                onChange={(e) => setIsMentor(e.target.checked)}
              />
            </label>
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}

      <div className="btn-row">
        {step > 0 && (
          <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            className="btn btn-block"
            disabled={!canAdvance}
            onClick={() => setStep(step + 1)}
          >
            Continue <span className="arrow">→</span>
          </button>
        ) : (
          <button className="btn btn-block" disabled={busy} onClick={activate}>
            {busy ? 'Activating…' : 'Activate account'}{' '}
            <span className="arrow">→</span>
          </button>
        )}
      </div>

      <div className="dots">
        {STEPS.map((s, i) => (
          <i key={s} className={i === step ? 'on' : ''} />
        ))}
      </div>
    </>
  );
}
