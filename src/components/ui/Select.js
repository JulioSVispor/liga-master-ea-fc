export function Select({ className = "", children, ...props }) {
  return (
    <select
      className={`min-h-10 w-full rounded-lg border border-gray-700 bg-[#111827] px-3 text-sm text-gray-100 outline-none transition-colors focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/30 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
