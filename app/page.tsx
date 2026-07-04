import Link from 'next/link';
import { getSessionState } from '@/lib/session';
import { supabaseServer } from '@/lib/supabase/server';
import { label } from '@/lib/tags';
import type { Match, Project } from '@/lib/types';

// The home surface is a WORKBENCH, not a feed: your projects, proposals
// addressed to you, your score. Nothing here enumerates other users.
export default async function Home() {
  const { authUser, profile } = await getSessionState();

  if (!authUser) {
    return (
      <>
        <div className="hero">
          <p className="kicker" style={{ color: '#f6efe6' }}>
            A progress engine, not a network
          </p>
          <h1 className="display">
            Build with people
            <br />
            who ship
          </h1>
          <span className="link-caps">
            Proof of work required <span className="arrow">→</span>
          </span>
        </div>
        <div className="band center">
          <h2 className="section-title">
            No browsing.
            <br />
            Only matched need.
          </h2>
          <p className="lede">
            Projects declare unfilled dependencies. Venturing surfaces the few
            people whose validated assets fill them. That is the entire
            product.
          </p>
          <p className="hint mt-2">
            Sign-in UI is future scope — sessions come from Supabase Auth.
          </p>
        </div>
      </>
    );
  }

  if (!profile) {
    // Authenticated but not activated: Learn track until proof of work exists.
    return (
      <div className="center mt-4">
        <p className="kicker">Account not yet activated</p>
        <h1 className="display">
          Activation starts <span className="accent">here.</span>
        </h1>
        <p className="lede">
          Select your assets and gaps, then link one piece of proof of work.
          Until then you have view-only access and cannot be matched or
          message anyone.
        </p>
        <div className="mt-3">
          <Link href="/onboarding" className="btn">
            Begin onboarding <span className="arrow">→</span>
          </Link>
        </div>
        <div className="mt-2">
          <Link href="/learn" className="link-caps">
            Continue view-only <span>→</span>
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await supabaseServer();
  const [{ data: projects }, { data: proposals }] = await Promise.all([
    supabase
      .from('projects')
      .select('*')
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('matches')
      .select('*, projects(problem_statement, current_phase)')
      .eq('user_id', profile.id)
      .eq('status', 'proposed'),
  ]);

  return (
    <>
      <p className="kicker">Founder&rsquo;s workbench</p>
      <h1 className="display">
        Progress is the
        <br />
        only profile.
      </h1>

      <div className="card">
        <div className="row">
          <div>
            <p className="ledger-type">Commitment score</p>
            <p className="score">{Number(profile.commitment_score).toFixed(1)}</p>
          </div>
          <Link href={`/u/${profile.id}`} className="link-caps">
            Your ledger <span>→</span>
          </Link>
        </div>
      </div>

      <div className="row mt-3">
        <p className="kicker" style={{ margin: 0, textAlign: 'left' }}>
          Your projects
        </p>
        <Link href="/projects/new" className="link-caps">
          New <span>→</span>
        </Link>
      </div>
      {(projects as Project[] | null)?.length ? (
        (projects as Project[]).map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <div className="card">
              <div className="row">
                <h3 className="card-title">{p.problem_statement.slice(0, 80)}</h3>
                <span className={`phase-pill ${p.current_phase}`}>
                  {p.current_phase}
                </span>
              </div>
              <div className="tag-grid" style={{ justifyContent: 'flex-start' }}>
                {p.active_dependencies.map((d) => (
                  <span key={d} className="tag static">
                    needs {label(d)}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))
      ) : (
        <p className="lede">No projects yet — declare one to start matching.</p>
      )}

      {(proposals as (Match & { projects: { problem_statement: string } })[] | null)
        ?.length ? (
        <>
          <p className="kicker mt-3" style={{ textAlign: 'left' }}>
            Proposals for you
          </p>
          {(proposals as (Match & { projects: { problem_statement: string } })[]).map(
            (m) => (
              <Link key={m.id} href={`/matches/${m.id}`}>
                <div className="card">
                  <p className="ledger-type">
                    matched on {label(m.matched_on)}
                  </p>
                  <p className="ledger-desc">
                    {m.projects.problem_statement.slice(0, 120)}
                  </p>
                </div>
              </Link>
            ),
          )}
        </>
      ) : null}
    </>
  );
}
