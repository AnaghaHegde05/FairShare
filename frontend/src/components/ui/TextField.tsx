import { InputHTMLAttributes, forwardRef } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

// Shared text input for every form in the app (auth, chore creation, invite
// codes). Keeping label/error rendering here means every form gets the same
// spacing and error styling for free.
const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, id, className = "", ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <div className="text-left">
        <label htmlFor={inputId} className="block text-sm font-medium text-ink mb-1.5">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-lg border bg-card px-3.5 py-2.5 text-ink placeholder:text-muted/60
            focus:outline-none focus:ring-2 focus:ring-pine/40 focus:border-pine
            ${error ? "border-brick" : "border-line"} ${className}`}
          {...props}
        />
        {error && <p className="mt-1.5 text-sm text-brick">{error}</p>}
      </div>
    );
  }
);
TextField.displayName = "TextField";

export default TextField;
