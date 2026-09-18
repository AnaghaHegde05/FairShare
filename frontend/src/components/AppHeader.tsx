import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Household } from "../types";
import { CopyIcon, CheckIcon } from "./icons";
import Button from "./ui/Button";
import NotificationBell from "./NotificationBell";

interface AppHeaderProps {
  household: Household | null;
  /** Page heading shown under the household name. Defaults to "Chores". */
  title?: string;
  /** Which nav link to highlight as current. */
  active?: "chores" | "dashboard" | "activity" | "household";
}

export default function AppHeader({ household, title = "Chores", active = "chores" }: AppHeaderProps) {
  const { user, logout } = useAuth();
  const [copied, setCopied] = useState(false);

  function handleCopyInvite() {
    if (!household) return;
    navigator.clipboard.writeText(household.inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const navLinkClasses = (isActive: boolean) =>
    `text-sm font-medium px-1 pb-0.5 border-b-2 transition-colors ${
      isActive
        ? "border-pine text-ink"
        : "border-transparent text-muted hover:text-ink"
    }`;

  return (
    <header className="border-b border-line bg-card/60">
      <div className="max-w-4xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted font-medium">
            {household?.name || "FairShare"}
          </p>
          <h1 className="font-display text-lg font-semibold text-ink truncate">
            {title}
          </h1>
        </div>

        <nav className="flex items-center gap-4 order-3 w-full sm:order-none sm:w-auto">
          <Link to="/chores" className={navLinkClasses(active === "chores")}>
            Chores
          </Link>
          <Link to="/dashboard" className={navLinkClasses(active === "dashboard")}>
            Dashboard
          </Link>
          <Link to="/activity" className={navLinkClasses(active === "activity")}>
            Activity
          </Link>
          <Link to="/members" className={navLinkClasses(active === "household")}>
            Household
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <NotificationBell />
          {household && (
            <button
              type="button"
              onClick={handleCopyInvite}
              className="ticket flex items-center gap-2 px-3 py-1.5 text-sm font-mono tracking-widest text-ink hover:bg-paper transition-colors"
              title="Copy invite code"
            >
              {household.inviteCode}
              {copied ? (
                <CheckIcon className="h-3.5 w-3.5 text-pine" />
              ) : (
                <CopyIcon className="h-3.5 w-3.5 text-muted" />
              )}
            </button>
          )}
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-ink leading-none">{user?.name}</p>
            {user?.username && (
              <p className="text-xs text-muted leading-none mt-1">@{user.username}</p>
            )}
          </div>
          <Button variant="ghost" onClick={logout} type="button">
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
