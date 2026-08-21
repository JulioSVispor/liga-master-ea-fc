export function EmptyState({ title, description, action }) {
  return (
    <section className="rounded-xl border border-dashed border-gray-700 bg-[#111827]/60 px-6 py-10 text-center">
      <h2 className="text-base font-semibold text-gray-100">{title}</h2>
      {description && <p className="mx-auto mt-2 max-w-lg text-sm text-gray-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </section>
  );
}
