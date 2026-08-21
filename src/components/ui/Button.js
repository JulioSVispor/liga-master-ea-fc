export function Button({
  children,
  type = "button",
  variant = "primary",
  intent,
  busy = false,
  busyLabel = "Processando…",
  className = "",
  disabled,
  ...props
}) {
  const resolvedVariant = intent === "danger" ? "destructive" : variant;
  const baseStyles = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090d16] disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    primary: "border border-[#10b981] bg-[#10b981] text-[#04130e] hover:border-[#34d399] hover:bg-[#34d399]",
    secondary: "bg-[#1f2937] text-gray-200 hover:bg-[#374151] hover:text-white border border-gray-700",
    destructive: "bg-red-900/50 text-red-400 hover:bg-red-900/80 hover:text-red-300 border border-red-800",
    ghost: "hover:bg-[#1f2937] text-gray-400 hover:text-gray-100",
    outline: "border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
  };

  return (
    <button
      type={type}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      className={`${baseStyles} ${variants[resolvedVariant] || variants.primary} ${className}`}
      {...props}
    >
      {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
      <span>{busy ? busyLabel : children}</span>
    </button>
  );
}
