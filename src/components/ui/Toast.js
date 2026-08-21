export function Toast({ title, message, tone = "info", onDismiss }) {
  const tones = {
    success: "border-emerald-500/40",
    warning: "border-amber-500/40",
    error: "border-red-500/40",
    info: "border-blue-500/40",
  };
  return (
    <div className={`rounded-lg border bg-[#111827] p-4 shadow-xl ${tones[tone]}`} role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          {title && <p className="text-sm font-semibold text-gray-100">{title}</p>}
          <p className="mt-0.5 text-sm text-gray-300">{message}</p>
        </div>
        {onDismiss && <button type="button" onClick={onDismiss} className="rounded p-1 text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="Fechar aviso">×</button>}
      </div>
    </div>
  );
}
