"use client";

import { useId } from "react";

export function FormField({ label, hint, error, required, children }) {
  const descriptionId = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-gray-200">
          {label}{required && <span className="ml-1 text-red-400" aria-hidden="true">*</span>}
        </label>
        {hint && <span className="text-xs text-gray-500">{hint}</span>}
      </div>
      {typeof children === "function" ? children({ "aria-describedby": error ? descriptionId : undefined, "aria-invalid": Boolean(error) }) : children}
      {error && <p id={descriptionId} className="text-xs text-red-400" role="alert">{error}</p>}
    </div>
  );
}
