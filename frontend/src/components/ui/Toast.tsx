import { createContext, useCallback, useContext, useState, ReactNode } from "react";

interface ToastMessage {
  id: number;
  text: string;
  tone: "success" | "error";
}

interface ToastContextValue {
  showToast: (text: string, tone?: ToastMessage["tone"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3000;

// Lightweight, dependency-free toast used for transient confirmations like
// "Chore marked done" — feedback the user needs after an action, but that
// shouldn't require a dedicated page or block the UI like an alert() would.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, tone: ToastMessage["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`rounded-lg px-4 py-2.5 text-sm font-medium shadow-md border animate-[fadein_0.15s_ease-out] ${
              t.tone === "success"
                ? "bg-pine text-white border-pine-dark"
                : "bg-brick text-white border-brick-dark"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
