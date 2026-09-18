import { ReactNode } from "react";

// Shared frame for the signup/login screens. The stamped "FS" mark and
// baseline-ruled backdrop (see index.css) carry the ledger/chore-chart
// motif before the user has any real data to look at yet.
export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="ticket flex h-12 w-12 items-center justify-center">
            <span className="font-display text-lg font-semibold text-pine">FS</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-muted text-center">{subtitle}</p>
        </div>

        <div className="rounded-card border border-line bg-card p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
