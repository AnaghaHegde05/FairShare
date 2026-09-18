import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { ApiError, useAuth } from "../context/AuthContext";
import type { Household } from "../types";
import { useToast } from "../components/ui/Toast";
import AppHeader from "../components/AppHeader";
import Button from "../components/ui/Button";
import TextField from "../components/ui/TextField";
import ErrorBanner from "../components/ui/ErrorBanner";
import { TrashIcon } from "../components/icons";

const HOUSEHOLD_NAME_MAX = 100;

type LoadState = "loading" | "ready" | "error";

export default function HouseholdMembersPage() {
  const { user, setHouseholdId } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [household, setHousehold] = useState<Household | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [nameDraft, setNameDraft] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);

  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  async function load() {
    setLoadState("loading");
    setLoadError(null);
    try {
      const res = await api.get<{ household: Household }>("/api/households/me");
      setHousehold(res.household);
      setNameDraft(res.household.name);
      setLoadState("ready");
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load your household");
      setLoadState("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isOwner = household?.users?.find((u) => u.id === user?.id)?.role === "OWNER";
  const isSoleMember = (household?.users?.length ?? 0) <= 1;

  async function handleSaveName(e: FormEvent) {
    e.preventDefault();
    setNameError(null);
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameError("Household name is required");
      return;
    }
    if (trimmed.length > HOUSEHOLD_NAME_MAX) {
      setNameError(`Household name must be ${HOUSEHOLD_NAME_MAX} characters or fewer`);
      return;
    }
    setIsSavingName(true);
    try {
      const res = await api.put<{ household: Household }>("/api/households/me", { name: trimmed });
      setHousehold((prev) => (prev ? { ...prev, name: res.household.name } : prev));
      setIsEditingName(false);
      showToast("Household renamed");
    } catch (err) {
      setNameError(err instanceof ApiError ? err.message : "Couldn't rename the household");
    } finally {
      setIsSavingName(false);
    }
  }

  async function handleRemoveMember(memberId: string, memberName: string) {
    if (!confirm(`Remove ${memberName} from the household? They'll need a new invite code to rejoin.`)) {
      return;
    }
    setRemovingUserId(memberId);
    try {
      await api.delete(`/api/households/members/${memberId}`);
      setHousehold((prev) =>
        prev ? { ...prev, users: prev.users?.filter((u) => u.id !== memberId) } : prev
      );
      showToast(`${memberName} was removed`);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't remove that member", "error");
    } finally {
      setRemovingUserId(null);
    }
  }

  async function handleLeave() {
    const warning = isOwner
      ? "Leave this household? Since you're the owner and the only member, the household will be left without any members."
      : "Leave this household? You'll need a new invite code to rejoin.";
    if (!confirm(warning)) return;
    setIsLeaving(true);
    try {
      await api.post("/api/households/leave");
      setHouseholdId(null);
      navigate("/household", { replace: true });
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't leave the household", "error");
    } finally {
      setIsLeaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader household={household} title="Household" active="household" />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {loadState === "loading" && (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-pine border-t-transparent" />
          </div>
        )}

        {loadState === "error" && (
          <div className="space-y-4">
            <ErrorBanner message={loadError} />
            <Button onClick={load}>Try again</Button>
          </div>
        )}

        {loadState === "ready" && household && (
          <div className="space-y-8">
            <section className="rounded-card border border-line bg-card p-5">
              <h2 className="text-sm font-semibold text-ink mb-3">Household name</h2>
              {isEditingName ? (
                <form onSubmit={handleSaveName} className="space-y-3" noValidate>
                  <ErrorBanner message={nameError} />
                  <TextField
                    label="Household name"
                    name="householdName"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    maxLength={HOUSEHOLD_NAME_MAX}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button type="submit" isLoading={isSavingName}>
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setIsEditingName(false);
                        setNameDraft(household.name);
                        setNameError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-ink font-medium">{household.name}</p>
                  {isOwner && (
                    <Button variant="secondary" onClick={() => setIsEditingName(true)}>
                      Rename
                    </Button>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-card border border-line bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-ink">
                  Members ({household.users?.length ?? 0})
                </h2>
                <span className="font-mono text-xs text-muted">
                  Invite code: {household.inviteCode}
                </span>
              </div>
              <div className="space-y-2">
                {household.users?.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg border border-line px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">
                        {member.name}
                        {member.id === user?.id && <span className="text-muted"> (you)</span>}
                      </p>
                      <p className="text-xs text-muted">@{member.username}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          member.role === "OWNER"
                            ? "bg-gold/20 text-ink"
                            : "bg-pine-light text-pine-dark"
                        }`}
                      >
                        {member.role === "OWNER" ? "Owner" : "Member"}
                      </span>
                      {isOwner && member.id !== user?.id && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id, member.name)}
                          disabled={removingUserId === member.id}
                          aria-label={`Remove ${member.name}`}
                          className="p-1.5 text-muted hover:text-brick rounded-md hover:bg-brick-light disabled:opacity-40"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-card border border-line bg-card p-5">
              <h2 className="text-sm font-semibold text-ink mb-2">Leave household</h2>
              {isOwner && !isSoleMember ? (
                <p className="text-sm text-muted">
                  As the owner, you can't leave while other members are still here — remove them
                  first, or the household would be left without an owner.
                </p>
              ) : (
                <Button variant="danger" onClick={handleLeave} isLoading={isLeaving}>
                  Leave household
                </Button>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
