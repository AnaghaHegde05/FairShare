import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { ApiError, useAuth } from "../context/AuthContext";
import type { Household } from "../types";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import ErrorBanner from "../components/ui/ErrorBanner";

const HOUSEHOLD_NAME_MAX = 100;

type Mode = "create" | "join";

export default function HouseholdSetupPage() {
  const { user, setHouseholdId, logout } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("create");
  const [householdName, setHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!householdName.trim()) {
      setFormError("Household name is required");
      return;
    }
    if (householdName.trim().length > HOUSEHOLD_NAME_MAX) {
      setFormError(`Household name must be ${HOUSEHOLD_NAME_MAX} characters or fewer`);
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await api.post<{ household: Household }>("/api/households", {
        name: householdName.trim(),
      });
      setHouseholdId(data.household.id);
      navigate("/chores", { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't create the household");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!inviteCode.trim()) {
      setFormError("Invite code is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await api.post<{ household: Household }>("/api/households/join", {
        inviteCode: inviteCode.trim(),
      });
      setHouseholdId(data.household.id);
      navigate("/chores", { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't join that household");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm text-muted">Signed in as</p>
            <p className="font-semibold text-ink">{user?.name}</p>
          </div>
          <Button variant="ghost" onClick={logout} type="button">
            Log out
          </Button>
        </div>

        <h1 className="text-2xl font-semibold text-ink mb-1">One more step</h1>
        <p className="text-sm text-muted mb-6">
          Create a household to start tracking chores, or join one with an invite code.
        </p>

        <div className="rounded-card border border-line bg-card p-6 shadow-sm">
          <div className="mb-6 flex rounded-lg border border-line bg-paper p-1">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                mode === "create" ? "bg-pine text-white" : "text-muted hover:text-ink"
              }`}
            >
              Create household
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                mode === "join" ? "bg-pine text-white" : "text-muted hover:text-ink"
              }`}
            >
              Join with code
            </button>
          </div>

          <ErrorBanner message={formError} />

          {mode === "create" ? (
            <form onSubmit={handleCreate} className="space-y-4 mt-4" noValidate>
              <TextField
                label="Household name"
                name="householdName"
                placeholder="e.g. The Maple Street Apartment"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                maxLength={HOUSEHOLD_NAME_MAX}
              />
              <Button type="submit" isLoading={isSubmitting} className="w-full">
                Create household
              </Button>
            </form>
          ) : (
            <form onSubmit={handleJoin} className="space-y-4 mt-4" noValidate>
              <TextField
                label="Invite code"
                name="inviteCode"
                placeholder="e.g. 7F3K9Q"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="font-mono tracking-[0.2em] uppercase"
                maxLength={6}
              />
              <Button type="submit" isLoading={isSubmitting} className="w-full">
                Join household
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
