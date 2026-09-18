import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, className = "", children, ...props }, ref) => {
    const selectId = id || props.name;
    return (
      <div className="text-left">
        <label htmlFor={selectId} className="block text-sm font-medium text-ink mb-1.5">
          {label}
        </label>
        <select
          ref={ref}
          id={selectId}
          className={`w-full rounded-lg border bg-card px-3.5 py-2.5 text-ink
            focus:outline-none focus:ring-2 focus:ring-pine/40 focus:border-pine
            ${error ? "border-brick" : "border-line"} ${className}`}
          {...props}
        >
          {children}
        </select>
        {error && <p className="mt-1.5 text-sm text-brick">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";

export default Select;
