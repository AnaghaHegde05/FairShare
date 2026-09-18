import type { Chore } from "../types";
import Button from "./ui/Button";
import { EditIcon, TrashIcon, CheckIcon } from "./icons";
import { formatDateTime } from "../lib/time";

interface ChoreCardProps {
  chore: Chore;
  lastDoneLabel: string | null;
  isLoggingDone: boolean;
  isDeleting: boolean;
  onMarkDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

// Effort weight rendered as filled/empty dots rather than a bare number —
// the README frames effort as a 1-5 scale, so a quick visual read ("how
// heavy is this chore") matters more here than the exact digit.
function EffortDots({ weight }: { weight: number }) {
  return (
    <div className="flex items-center gap-1" title={`Effort weight ${weight} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`h-1.5 w-1.5 rounded-full ${n <= weight ? "bg-gold" : "bg-line"}`}
        />
      ))}
    </div>
  );
}

export default function ChoreCard({
  chore,
  lastDoneLabel,
  isLoggingDone,
  isDeleting,
  onMarkDone,
  onEdit,
  onDelete,
}: ChoreCardProps) {
  const completion = chore.completion ?? null;
  const isDone = completion !== null;

  return (
    <div
      className={`rounded-card border p-4 flex items-center justify-between gap-4 ${
        isDone ? "border-pine-light bg-pine-light/30" : "border-line bg-card"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className="font-semibold text-ink truncate">{chore.name}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-pine-light text-pine-dark font-medium capitalize">
            {chore.frequency}
          </span>
        </div>

        {isDone && completion ? (
          <div className="mt-1.5">
            <p className="text-sm text-pine-dark font-medium">
              Completed by {completion.userName}
            </p>
            <p className="text-xs text-muted mt-0.5">
              {formatDateTime(completion.completedAt)} · +{completion.effortWeightSnapshot} points
            </p>
          </div>
        ) : (
          <div className="mt-1.5 flex items-center gap-3">
            <EffortDots weight={chore.effortWeight} />
            <span className="text-xs text-muted">
              {lastDoneLabel ? `Last done ${lastDoneLabel}` : "Not logged yet"}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${chore.name}`}
          className="p-2 text-muted hover:text-ink rounded-md hover:bg-ink/5"
        >
          <EditIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label={`Delete ${chore.name}`}
          className="p-2 text-muted hover:text-brick rounded-md hover:bg-brick-light disabled:opacity-40"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
        {!isDone && (
          <Button
            type="button"
            onClick={onMarkDone}
            isLoading={isLoggingDone}
            disabled={isLoggingDone}
            className="ml-1"
          >
            <CheckIcon className="h-3.5 w-3.5" />
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
