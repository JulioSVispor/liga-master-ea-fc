"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/FormField";

export function PasswordField({ id, label, hint, error, required = false, ...inputProps }) {
  const [visible, setVisible] = useState(false);

  return (
    <FormField label={label} hint={hint} error={error} required={required} htmlFor={id}>
      {(accessibilityProps) => (
        <div className="relative">
          <input
            id={id}
            type={visible ? "text" : "password"}
            className="block min-h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-20 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25"
            {...accessibilityProps}
            {...inputProps}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 min-w-16 px-3 text-xs font-semibold text-gray-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3b82f6]"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={visible}
          >
            {visible ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      )}
    </FormField>
  );
}
