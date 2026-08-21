export function Badge({ children, variant = "default", className = "", ...props }) {
  const baseStyles = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide";
  
  const variants = {
    default: "bg-gray-800 text-gray-300 border border-gray-700",
    success: "bg-emerald-950/40 text-emerald-400 border border-emerald-900/50",
    warning: "bg-amber-950/40 text-amber-400 border border-amber-900/50",
    danger: "bg-rose-950/40 text-rose-400 border border-rose-900/50",
    info: "bg-blue-950/40 text-blue-400 border border-blue-900/50"
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}
