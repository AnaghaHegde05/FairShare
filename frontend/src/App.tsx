import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { RequireAuth, RequireHousehold, RequireNoHousehold, FullScreenSpinner } from "./routes/guards";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import HouseholdSetupPage from "./pages/HouseholdSetupPage";
import ChoresPage from "./pages/ChoresPage";
import DashboardPage from "./pages/DashboardPage";
import ActivityPage from "./pages/ActivityPage";
import NotificationsPage from "./pages/NotificationsPage";
import HouseholdMembersPage from "./pages/HouseholdMembersPage";

// Sends "/" somewhere sensible based on session state, rather than
// rendering its own content — logged-out visitors land on login, logged-in
// visitors land on their household's chores (or household setup if they
// haven't joined one yet).
function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.householdId ? "/chores" : "/household"} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/household"
          element={
            <RequireNoHousehold>
              <HouseholdSetupPage />
            </RequireNoHousehold>
          }
        />
        <Route
          path="/chores"
          element={
            <RequireHousehold>
              <ChoresPage />
            </RequireHousehold>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireHousehold>
              <DashboardPage />
            </RequireHousehold>
          }
        />
        <Route
          path="/activity"
          element={
            <RequireHousehold>
              <ActivityPage />
            </RequireHousehold>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireHousehold>
              <NotificationsPage />
            </RequireHousehold>
          }
        />
        {/* Member list, owner-only rename/removal, and self-service
            leave. Deliberately a separate path from /household (which
            is the pre-join setup flow, guarded by RequireNoHousehold —
            the opposite precondition). */}
        <Route
          path="/members"
          element={
            <RequireHousehold>
              <HouseholdMembersPage />
            </RequireHousehold>
          }
        />
        {/* Anything else that requires auth but isn't a real page yet
            (e.g. a stale bookmark to a future /dashboard route) falls back
            through RequireAuth so it at least resolves to a sane place. */}
        <Route
          path="*"
          element={
            <RequireAuth>
              <RootRedirect />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
