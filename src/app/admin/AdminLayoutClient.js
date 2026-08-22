"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const MENU_GROUPS = [
  {
    items: [
      { name: "Visão Geral", path: "/admin", icon: "📊" },
    ],
  },
  {
    label: "TEMPORADA",
    items: [
      { name: "Competições", path: "/admin/leagues", icon: "🏆" },
      { name: "Janela de Mercado", path: "/admin/market-window", icon: "🔄" },
      { name: "Finalizar Temporada", path: "/admin/season", icon: "🏁" },
    ],
  },
  {
    label: "PESSOAS & TIMES",
    items: [
      { name: "Treinadores & Equipes", path: "/admin/users", icon: "👥" },
      { name: "Participantes", path: "/admin/invites", icon: "✉️" },
      { name: "Lista de Espera", path: "/admin/waitlist", icon: "📋" },
      { name: "Arbitragem", path: "/admin/arbitration", icon: "⚖️" },
    ],
  },
  {
    label: "FERRAMENTAS",
    items: [
      { name: "Importar Jogadores", path: "/admin/import", icon: "📥" },
      { name: "Mural de Notícias", path: "/admin/news", icon: "📰" },
      { name: "Troféus", path: "/admin/trophies", icon: "🏅" },
      { name: "Patrocínios", path: "/admin/sponsorships", icon: "💼" },
      { name: "Escudos", path: "/admin/shields", icon: "🛡️" },
      { name: "Auditoria Financeira", path: "/admin/audit", icon: "🧾" },
    ],
  },
];

export default function AdminLayoutClient({ children, initialAdmin }) {
  const router = useRouter();
  const pathname = usePathname();
  const [adminName] = useState(initialAdmin.displayName);
  const [adminRole] = useState(initialAdmin.role);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const allItems = MENU_GROUPS.flatMap((g) => g.items);

  return (
    <div className="flex min-h-screen bg-[#060913] text-gray-100">

      {/* ── SIDEBAR DESKTOP ── */}
      <aside className="w-64 border-r border-white/5 bg-[#090d16]/80 hidden md:flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-[#10b981] to-[#3b82f6] bg-clip-text text-transparent">
            LIGA ADMIN
          </Link>
        </div>

        {/* Perfil do admin */}
        <div className="p-5 border-b border-white/5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-[#10b981]/15 text-[#10b981] flex items-center justify-center font-bold border border-[#10b981]/30 text-sm flex-shrink-0">
            {adminName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-none truncate">{adminName}</p>
            <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
              {adminRole === "master" ? "Dono da Liga" : "Super Admin"}
            </span>
          </div>
        </div>

        {/* Menu agrupado */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {MENU_GROUPS.map((group, gi) => (
            <div key={gi} className={gi > 0 ? "pt-3" : ""}>
              {group.label && (
                <p className="px-3 pb-1.5 text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20"
                        : "text-gray-400 hover:bg-white/5 hover:text-white border border-transparent"
                    }`}
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    <span className="leading-none">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Rodapé da sidebar */}
        <div className="p-3 border-t border-white/5 space-y-1">
          <Link
            href="/admin/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
              pathname === "/admin/settings"
                ? "bg-white/10 text-white border-white/10"
                : "text-gray-400 hover:bg-white/5 hover:text-white border-transparent"
            }`}
          >
            <span className="text-base leading-none">⚙️</span>
            <span>Configurações</span>
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#10b981] hover:bg-[#10b981]/10 transition-all border border-transparent"
          >
            <span className="text-base leading-none">🛡️</span>
            <span>Painel do Clube</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all border border-transparent"
          >
            <span className="text-base leading-none">🚪</span>
            <span>Sair do Painel</span>
          </button>
        </div>
      </aside>

      {/* ── ÁREA PRINCIPAL ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Header mobile */}
        <header className="h-16 border-b border-white/5 bg-[#090d16]/80 flex items-center justify-between px-4 md:hidden sticky top-0 z-30">
          <span className="text-lg font-bold bg-gradient-to-r from-[#10b981] to-[#3b82f6] bg-clip-text text-transparent">
            LIGA ADMIN
          </span>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-xs font-semibold text-[#10b981] px-3 py-1.5 rounded-lg bg-[#10b981]/10">
              Clube
            </Link>
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="p-2 rounded-lg bg-white/5 text-gray-300 hover:text-white transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </header>

        {/* Menu mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#090d16]/95 border-b border-white/5 p-3 space-y-1 z-20">
            {MENU_GROUPS.map((group, gi) => (
              <div key={gi} className={gi > 0 ? "pt-2" : ""}>
                {group.label && (
                  <p className="px-2 pb-1 text-[9px] font-bold text-gray-600 uppercase tracking-widest">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => {
                  const isActive = pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive ? "bg-[#10b981]/10 text-[#10b981]" : "text-gray-400"
                      }`}
                    >
                      <span>{item.icon}</span>
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            ))}
            <div className="pt-2 border-t border-white/5 space-y-1">
              <Link href="/admin/settings" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400">
                <span>⚙️</span>Configurações
              </Link>
              <button onClick={handleLogout} className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400">
                <span>🚪</span>Sair
              </button>
            </div>
          </div>
        )}

        {/* Conteúdo da página */}
        <main className="p-5 md:p-8 max-w-7xl w-full mx-auto flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
