import Link from 'next/link';
import { getSessionState } from '@/lib/session';

// View-only track for authenticated users without proof of work.
// They can read public ledgers (the trust mechanism is public by design)
// but are invisible to matching and cannot message anyone.
export default async function LearnPage() {
  const { profile } = await getSessionState();

  return (
    <>
      <p className="kicker">Learn track · view only</p>
      <h1 className="display">
        Watch how progress
        <br />
        gets proven.
      </h1>
      <p className="lede">
        Your account is not activated{profile ? '' : ' yet'}. You can study how
        founders log verifiable work, but you will not appear in the matching
        engine and cannot start conversations until you link proof of work.
      </p>

      <div className="card">
        <h3 className="card-title">What counts as proof of work</h3>
        <p className="ledger-desc mt-1">
          A GitHub repository, a shipped product, a pitch deck, published
          writing, or a financial model — one URL that shows you finish
          things. It becomes the anchor of your public ledger.
        </p>
      </div>
      <div className="card">
        <h3 className="card-title">Why there is no browsing</h3>
        <p className="ledger-desc mt-1">
          Venturing never shows a directory of people. Projects declare
          unfilled dependencies; the engine privately surfaces the top three
          to five candidates whose validated assets fill each one. Visibility
          is earned by evidence, not by networking.
        </p>
      </div>

      <div className="center mt-3">
        <Link href="/onboarding" className="btn">
          Activate with proof of work <span className="arrow">→</span>
        </Link>
      </div>
    </>
  );
}
