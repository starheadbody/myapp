import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Venturing',
  description:
    'A progress engine that matches founders to validated project needs.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <div className="sheet">
            <div className="topbar">
              <Link href="/" className="wordmark">
                venturing
              </Link>
              <button className="menu-lines" aria-label="Menu">
                <span />
                <span />
              </button>
            </div>
            <div className="sheet-inner">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
