import { FormEvent, useState } from "react";
import { api } from "../lib/api";
import { ApiError } from "../context/AuthContext";
import type { Chore } from "../types";
import Modal from "./ui/Modal";
import TextField from "./ui/TextField";
import Select from "./ui/Select";
import Button from "./ui/Button";
import ErrorBanner from "./ui/ErrorBanner";

const FREQUENCY_OPTIONS = ["daily", "weekly", "biweekly", "monthly", "as-needed"];
const CHORE_NAME_MAX = 100;

interface ChoreFormModalProps {
  // Present when editing an existing chore; absent when creating a new one.
  chore?: Chore;
  onClose: () => void;
  onSaved: (chore: Chore) => void;
}

export default function ChoreFormModal({ chore, onClose, onSaved }: ChoreFormModalProps) {
  const isEditing = !!chore;

  const [name, setName] = useState(chore?.name ?? "");
  const [effortWeight, setEffortWeight] = useState(chore?.effortWeight ?? 3);
  const [frequency, setFrequency] = useState(chore?.frequency ?? "weekly");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Chore name is required");
      return;
    }
    if (name.trim().length > CHORE_NAME_MAX) {
      setFormError(`Chore name must be ${CHORE_NAME_MAX} characters or fewer`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = { name: name.trim(), effortWeight, frequency };
      const data = isEditing
        ? await api.put<{ chore: Chore }>(`/api/chores/${chore!.id}`, payload)
        : await api.post<{ chore: Chore }>("/api/chores", payload);
      onSaved(data.chore);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : `Couldn't ${isEditing ? "update" : "add"} the chore`
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={isEditing ? "Edit chore" : "Add a chore"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <ErrorBanner message={formError} />
        <TextField
          label="Chore name"
          name="name"
          placeholder="e.g. Clean bathroom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={CHORE_NAME_MAX}
          autoFocus
        />

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Effort weight — {effortWeight} of 5
          </label>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={effortWeight}
            onChange={(e) => setEffortWeight(Number(e.target.value))}
            className="w-full accent-pine"
          />
          <div className="flex justify-between text-xs text-muted mt-1">
            <span>Quick (wipe a counter)</span>
            <span>Heavy (deep clean)</span>
          </div>
        </div>

        <Select
          label="Frequency"
          name="frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
        >
          {FREQUENCY_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </Select>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} className="flex-1">
            {isEditing ? "Save changes" : "Add chore"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
