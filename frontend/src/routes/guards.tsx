import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function FullScreenSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-pine border-t-transparent" />
    </div>
  );
}

// Blocks access until we know whether a stored token is valid. Without this,
// a signed-in user hitting /chores on a fresh page load would flash to
// /login while AuthContext is still checking GET /api/auth/me.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Most of the app (chores, dashboard) is meaningless without a household —
// mirrors the backend's requireHousehold middleware.
export function RequireHousehold({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.householdId) return <Navigate to="/household" replace />;
  return <>{children}</>;
}

// The household setup page itself: once a user already belongs to one,
// send them on to the chores screen instead of letting them try to
// create/join a second household.
export function RequireNoHousehold({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.householdId) return <Navigate to="/chores" replace />;
  return <>{children}</>;
}
