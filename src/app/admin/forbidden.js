import Link from "next/link";

export default function AdminForbidden() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090d16] px-6 text-gray-100">
      <div className="max-w-md rounded-xl border border-gray-800 bg-[#111827] p-8">
        <p className="font-mono text-sm text-amber-400">403</p>
        <h1 className="mt-2 text-2xl font-semibold">Acesso administrativo necessário</h1>
        <p className="mt-3 text-sm leading-6 text-gray-400">Sua sessão é válida, mas este perfil não tem permissão para acessar a administração da liga.</p>
        <Link href="/dashboard" className="mt-6 inline-flex min-h-10 items-center rounded-lg bg-[#10b981] px-4 text-sm font-semibold text-[#04130e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Voltar ao painel do clube</Link>
      </div>
    </main>
  );
}
