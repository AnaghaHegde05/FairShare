import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { ApiError } from "../context/AuthContext";
import type { Chore, ChoreLog, Household } from "../types";
import { timeAgo } from "../lib/time";
import { useToast } from "../components/ui/Toast";
import AppHeader from "../components/AppHeader";
import ChoreCard from "../components/ChoreCard";
import ChoreFormModal from "../components/ChoreFormModal";
import Button from "../components/ui/Button";
import ErrorBanner from "../components/ui/ErrorBanner";

type LoadState = "loading" | "ready" | "error";

export default function ChoresPage() {
  const { showToast } = useToast();

  const [household, setHousehold] = useState<Household | null>(null);
  const [chores, setChores] = useState<Chore[]>([]);
  const [logs, setLogs] = useState<ChoreLog[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingChore, setEditingChore] = useState<Chore | undefined>(undefined);
  // Only one "Mark Done" request is ever in flight at a time — this both
  // disables that chore's button while its request is pending and blocks
  // a second click from firing a second request before the first settles.
  const [loggingChoreId, setLoggingChoreId] = useState<string | null>(null);
  const [deletingChoreId, setDeletingChoreId] = useState<string | null>(null);

  async function loadAll() {
    setLoadState("loading");
    setLoadError(null);
    try {
      const [householdRes, choresRes, logsRes] = await Promise.all([
        api.get<{ household: Household }>("/api/households/me"),
        api.get<{ chores: Chore[] }>("/api/chores"),
        api.get<{ logs: ChoreLog[] }>("/api/chore-logs"),
      ]);
      setHousehold(householdRes.household);
      setChores(choresRes.chores);
      setLogs(logsRes.logs);
      setLoadState("ready");
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load your household");
      setLoadState("error");
    }
  }

  // Re-fetches just the chore list, e.g. after a 409 conflict on
  // "Mark Done" (someone else — or another tab — already completed it for
  // this occurrence), so the UI reflects the real current state instead of
  // silently disagreeing with the server.
  async function refreshChores() {
    try {
      const choresRes = await api.get<{ chores: Chore[] }>("/api/chores");
      setChores(choresRes.chores);
    } catch {
      // Best-effort — the next full loadAll() will catch anything this misses.
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Most recent completedAt per chore (from the full log history), used
  // only as a "Last done 2d ago" hint on still-pending chores — the
  // *current* occurrence's completion (if any) comes from `chore.completion`
  // instead, straight off the chores list.
  const lastDoneByChore = useMemo(() => {
    const map = new Map<string, string>();
    for (const log of logs) {
      if (!map.has(log.choreId)) map.set(log.choreId, log.completedAt);
    }
    return map;
  }, [logs]);

  const pendingChores = chores.filter((c) => !c.completion);
  const completedChores = chores.filter((c) => !!c.completion);

  function openAddForm() {
    setEditingChore(undefined);
    setIsFormOpen(true);
  }

  function openEditForm(chore: Chore) {
    setEditingChore(chore);
    setIsFormOpen(true);
  }

  function handleChoreSaved(chore: Chore) {
    const wasEditing = !!editingChore;
    setChores((prev) => {
      const existing = prev.find((c) => c.id === chore.id);
      // PUT (edit) responses don't include `completion` (only GET
      // /api/chores computes it) — default to pending here and immediately
      // resync below, since editing a chore's frequency can change which
      // occurrence "now" falls into, so blindly preserving the old
      // completion flag could be wrong.
      const normalized: Chore = { ...chore, completion: existing ? existing.completion : null };
      return existing ? prev.map((c) => (c.id === chore.id ? normalized : c)) : [...prev, normalized];
    });
    setIsFormOpen(false);
    showToast(wasEditing ? "Chore updated" : "Chore added");
    if (wasEditing) refreshChores();
  }

  async function handleMarkDone(chore: Chore) {
    if (loggingChoreId) return; // one in-flight completion request at a time
    setLoggingChoreId(chore.id);
    try {
      const data = await api.post<{ log: ChoreLog }>("/api/chore-logs", {
        choreId: chore.id,
      });
      const log = data.log;
      setChores((prev) =>
        prev.map((c) =>
          c.id === chore.id
            ? {
                ...c,
                completion: {
                  id: log.id,
                  userId: log.userId,
                  userName: log.user?.name ?? "Someone",
                  completedAt: log.completedAt,
                  effortWeightSnapshot: log.effortWeightSnapshot,
                },
              }
            : c
        )
      );
      setLogs((prev) => [log, ...prev]);
      showToast(`Marked "${chore.name}" as done · +${log.effortWeightSnapshot} points`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't log that chore";
      showToast(message, "error");
      // Someone else (or another tab) beat us to it — resync instead of
      // leaving the button in a stale "still pending" state.
      if (err instanceof ApiError && err.status === 409) {
        refreshChores();
      }
    } finally {
      setLoggingChoreId(null);
    }
  }

  async function handleDelete(chore: Chore) {
    if (!confirm(`Delete "${chore.name}"? This can't be undone.`)) return;
    setDeletingChoreId(chore.id);
    try {
      await api.delete(`/api/chores/${chore.id}`);
      setChores((prev) => prev.filter((c) => c.id !== chore.id));
      showToast("Chore deleted");
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Couldn't delete that chore", "error");
    } finally {
      setDeletingChoreId(null);
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader household={household} title="Chores" active="chores" />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {loadState === "loading" && (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-pine border-t-transparent" />
          </div>
        )}

        {loadState === "error" && (
          <div className="space-y-4">
            <ErrorBanner message={loadError} />
            <Button onClick={loadAll}>Try again</Button>
          </div>
        )}

        {loadState === "ready" && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-ink font-display">
                  {household?.name}'s chores
                </h2>
                <p className="text-sm text-muted">
                  {household?.users?.length ?? 0} member
                  {household?.users?.length === 1 ? "" : "s"} · share invite code{" "}
                  <span className="font-mono">{household?.inviteCode}</span> to add more
                </p>
              </div>
              <Button onClick={openAddForm}>+ Add chore</Button>
            </div>

            {chores.length === 0 ? (
              <div className="rounded-card border border-dashed border-line bg-card/50 p-10 text-center">
                <p className="font-semibold text-ink">No chores yet</p>
                <p className="mt-1 text-sm text-muted">
                  Add the first chore so the household can start logging who does what.
                </p>
                <Button onClick={openAddForm} className="mt-4">
                  + Add chore
                </Button>
              </div>
            ) : (
              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-semibold text-ink mb-3">
                    Pending ({pendingChores.length})
                  </h3>
                  {pendingChores.length === 0 ? (
                    <div className="rounded-card border border-dashed border-line bg-card/50 p-6 text-center">
                      <p className="text-sm text-muted">
                        Nothing pending right now — everything's been done for its current
                        period.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingChores.map((chore) => {
                        const lastDone = lastDoneByChore.get(chore.id);
                        return (
                          <ChoreCard
                            key={chore.id}
                            chore={chore}
                            lastDoneLabel={lastDone ? timeAgo(lastDone) : null}
                            isLoggingDone={loggingChoreId === chore.id}
                            isDeleting={deletingChoreId === chore.id}
                            onMarkDone={() => handleMarkDone(chore)}
                            onEdit={() => openEditForm(chore)}
                            onDelete={() => handleDelete(chore)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                {completedChores.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-ink mb-3">
                      Completed ({completedChores.length})
                    </h3>
                    <div className="space-y-3">
                      {completedChores.map((chore) => (
                        <ChoreCard
                          key={chore.id}
                          chore={chore}
                          lastDoneLabel={null}
                          isLoggingDone={false}
                          isDeleting={deletingChoreId === chore.id}
                          onMarkDone={() => handleMarkDone(chore)}
                          onEdit={() => openEditForm(chore)}
                          onDelete={() => handleDelete(chore)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {isFormOpen && (
        <ChoreFormModal
          chore={editingChore}
          onClose={() => setIsFormOpen(false)}
          onSaved={handleChoreSaved}
        />
      )}
    </div>
  );
}
