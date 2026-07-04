import { notFound } from 'next/navigation';
import { getSessionState } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase/server';
import { label } from '@/lib/tags';
import { Composer } from './composer';

// Messaging exists ONLY here, keyed by an accepted match's thread.
// There is no inbox of arbitrary people and no way to start a thread —
// threads are created by the DB trigger on match acceptance, nowhere else.
export default async function ThreadPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const { profile } = await getSessionState();
  if (!profile) notFound();

  const supabase = await supabaseServer();
  const { data: thread } = await supabase
    .from('threads')
    .select('id, matches:match_id(matched_on, status)')
    .eq('match_id', matchId)
    .maybeSingle(); // RLS: parties of the accepted match only
  if (!thread) notFound();

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true })
    .limit(200);

  const matchInfo = thread.matches as unknown as { matched_on: string };

  return (
    <>
      <p className="kicker">Conversation · {label(matchInfo.matched_on)}</p>
      <h1 className="display">
        Talk is earned
        <br />
        here.
      </h1>
      <p className="lede">
        This thread exists because both sides accepted the match. Keep it about
        the work.
      </p>

      <div className="mt-3">
        {(messages ?? []).length === 0 && (
          <p className="lede">No messages yet. Open with the dependency, not small talk.</p>
        )}
        {(messages ?? []).map((m) => (
          <div
            key={m.id}
            className="card"
            style={
              m.sender_id === profile.id
                ? { background: 'var(--lavender)', border: 0 }
                : undefined
            }
          >
            <p className="ledger-desc">{m.body}</p>
            <p className="meta mt-1">
              {m.sender_id === profile.id ? 'You' : 'Them'} ·{' '}
              {new Date(m.created_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>
        ))}
      </div>

      <Composer threadId={thread.id} />
    </>
  );
}
