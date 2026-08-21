export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-gray-800 ${className}`} aria-hidden="true" />;
}
