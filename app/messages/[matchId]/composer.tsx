'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

// Direct insert through RLS: the policy itself verifies the sender is a
// party to an accepted match — no privileged path exists for messaging.
export function Composer({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError('');
    const supabase = supabaseBrowser();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('messages').insert({
      thread_id: threadId,
      sender_id: user?.id,
      body: text,
    });
    setBusy(false);
    if (err) {
      setError('Message rejected — the match may no longer be accepted.');
      return;
    }
    setBody('');
    router.refresh();
  }

  return (
    <div className="field">
      <label>Message</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="About the work…"
      />
      {error && <p className="error">{error}</p>}
      <div className="btn-row">
        <button className="btn btn-block" disabled={busy || !body.trim()} onClick={send}>
          {busy ? 'Sending…' : 'Send'} <span className="arrow">→</span>
        </button>
      </div>
    </div>
  );
}
