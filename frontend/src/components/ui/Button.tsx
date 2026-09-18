import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  isLoading?: boolean;
}

const VARIANT_CLASSES: Record<string, string> = {
  primary: "bg-pine text-white hover:bg-pine-dark disabled:bg-pine/50",
  secondary:
    "bg-transparent text-ink border border-line hover:bg-ink/5 disabled:opacity-50",
  ghost: "bg-transparent text-muted hover:text-ink disabled:opacity-50",
  danger: "bg-transparent text-brick hover:bg-brick-light disabled:opacity-50",
};

export default function Button({
  variant = "primary",
  isLoading,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold
        transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
