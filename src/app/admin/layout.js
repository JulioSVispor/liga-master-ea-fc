"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [adminName, setAdminName] = useState("");

  useEffect(() => {
    async function checkAdmin() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role, display_name")
          .eq("id", session.user.id)
          .single();

        if (error || !profile || profile.role !== "admin") {
          // Não é administrador, redireciona para o painel de usuário
          router.push("/dashboard");
          return;
        }

        setAdminName(profile.display_name || "Administrador");
        setAuthorized(true);
      } catch (err) {
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    }

    checkAdmin();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060913]">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-gray-400">Verificando credenciais...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return null; // Evita flash de tela antes do redirecionamento
  }

  const menuItems = [
    { name: "Visão Geral", path: "/admin", icon: "📊" },
    { name: "Ligas & Copas", path: "/admin/leagues", icon: "🏆" },
    { name: "Usuários & Times", path: "/admin/users", icon: "👥" },
    { name: "Importar Jogadores", path: "/admin/import", icon: "📥" },
    { name: "Disputas de Jogos", path: "/admin/disputes", icon: "⚔️" },
    { name: "Auditoria Financeira", path: "/admin/audit", icon: "🧾" },
    { name: "Configurações", path: "/admin/settings", icon: "⚙️" },
  ];

  return (
    <div className="flex min-h-screen bg-[#060913] text-gray-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#090d16]/80 backdrop-blur-md hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-[#10b981] to-[#3b82f6] bg-clip-text text-transparent">
            LIGA ADMIN
          </Link>
        </div>

        {/* Info do Admin */}
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-[#10b981]/15 text-[#10b981] flex items-center justify-center font-bold border border-[#10b981]/30">
            {adminName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">{adminName}</p>
            <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">Super Admin</span>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20"
                    : "text-gray-400 hover:bg-white/5 hover:text-white border border-transparent"
                }`}
              >
                <span>{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-white/5 space-y-1">
          <Link
            href="/dashboard"
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#10b981] hover:bg-[#10b981]/10 transition-all"
          >
            <span>🛡️</span>
            Painel do Clube
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
          >
            <span>🚪</span>
            Sair do Painel
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header Mobile */}
        <header className="h-16 border-b border-white/5 bg-[#090d16]/80 flex items-center justify-between px-6 md:hidden">
          <span className="text-lg font-bold bg-gradient-to-r from-[#10b981] to-[#3b82f6] bg-clip-text text-transparent">
            LIGA ADMIN
          </span>
          <div className="flex gap-2">
            <Link
              href="/dashboard"
              className="text-xs font-semibold text-[#10b981] px-3 py-1.5 rounded-lg bg-[#10b981]/10"
            >
              Clube
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-red-400 px-3 py-1.5 rounded-lg bg-red-500/10"
            >
              Sair
            </button>
          </div>
        </header>

        {/* Menu Mobile Rápido */}
        <div className="flex md:hidden bg-[#090d16]/50 border-b border-white/5 px-2 py-2 overflow-x-auto gap-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                  isActive ? "bg-[#10b981]/25 text-white" : "text-gray-400"
                }`}
              >
                <span>{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Página Dinâmica */}
        <main className="p-6 md:p-10 max-w-7xl w-full mx-auto flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
