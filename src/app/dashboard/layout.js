"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

import { useNotifications } from "@/hooks/useNotifications";
import { useTeamFinancials } from "@/hooks/useTeamFinancials";

export default function UserDashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [team, setTeam] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const {
    notifications,
    unreadCount,
    activeToast,
    setActiveToast,
    markAllRead
  } = useNotifications(userProfile?.id);

  const { wageSum, wageCapPercent } = useTeamFinancials(team?.id);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
 
        if (!session) {
          router.push("/login");
          return;
        }
 
        // Carregar Perfil
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
 
        setUserProfile(profile);

        // Carregar Time
        const { data: teamData } = await supabase
          .from("teams")
          .select("*")
          .eq("user_id", session.user.id)
          .single();

        if (teamData) {
          setTeam(teamData);
        }
      } catch (err) {
        console.error("Erro ao carregar dados do painel:", err);
      } finally {
        setLoading(false);
      }
    }
 
    loadData();
  }, [router, pathname]);

  // A lógica de Realtime foi movida para useNotifications

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060913]">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-gray-400">Carregando painel do clube...</p>
        </div>
      </div>
    );
  }

  const menuItems = [
    { name: "Painel do Clube", path: "/dashboard", icon: "🛡️" },
    { name: "Mural de Notícias", path: "/dashboard/news", icon: "📰" },
    { name: "Mercado de Atletas", path: "/dashboard/scouting", icon: "💱" },
    { name: "Central de Transferências", path: "/dashboard/market", icon: "🤝" },
    { name: "Partidas & Calendário", path: "/dashboard/matches", icon: "⚽" },
    { name: "Classificação", path: "/dashboard/standings", icon: "📈" },
    { name: "Extrato Financeiro", path: "/dashboard/negotiations", icon: "📋" },
  ];

  return (
    <div className="flex min-h-screen bg-[#060913] text-gray-100">
      {/* Sidebar */}
      <aside className="w-68 border-r border-white/5 bg-[#090d16]/80 hidden lg:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-white/5 justify-between gap-1">
          <Link href="/" className="text-base font-bold bg-gradient-to-r from-[#10b981] to-[#3b82f6] bg-clip-text text-transparent">
            LIGA MASTER
          </Link>
          
          <div className="flex items-center gap-2">
            {/* Sininho de Notificações Desktop */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all text-xs flex items-center justify-center"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute left-0 mt-2 w-72 rounded-xl border border-white/10 bg-[#090d16]/95 shadow-2xl p-3 z-50 text-left">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2">
                    <span className="text-[10px] font-bold text-white">Notificações</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[8.5px] text-[#10b981] hover:text-[#059669] font-bold"
                      >
                        Lidas
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                    {notifications.length === 0 ? (
                      <p className="text-[9px] text-gray-500 text-center py-3">Sem notificações.</p>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`p-2 rounded-lg border text-[10px] ${
                            n.read ? "bg-white/[0.01] border-white/5 opacity-60" : "bg-[#10b981]/5 border-[#10b981]/15"
                          }`}
                        >
                          <p className="font-bold text-white text-[10.5px] leading-tight mb-0.5">{n.title}</p>
                          <p className="text-gray-400 leading-tight">{n.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {userProfile?.role === "admin" && (
              <Link
                href="/admin"
                className="text-[9px] uppercase font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20"
              >
                Admin
              </Link>
            )}
          </div>
        </div>

        {/* Informações do Time & Finanças */}
        {team && (
          <div className="p-6 border-b border-white/5 space-y-4">
            <div className="flex items-center gap-3">
              {team.badge_url ? (
                <img
                  src={team.badge_url}
                  alt={team.name}
                  className="h-10 w-10 rounded-xl object-contain bg-white/5 border border-white/10"
                />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-[#3b82f6]/10 text-[#3b82f6] flex items-center justify-center font-bold border border-[#3b82f6]/20 text-lg">
                  🛡️
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{team.name}</p>
              </div>
            </div>

            {/* Finanças rápidas */}
            <div className="space-y-4 pt-2">
              {/* Orçamento */}
              <div className="flex flex-col text-xs text-gray-400">
                <span>Orçamento Disponível</span>
                <span className="font-bold text-emerald-400 text-[13px] mt-0.5">
                  R$ {parseFloat(team.budget).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Teto Salarial */}
              <div className="flex flex-col text-xs text-gray-400">
                <div className="flex justify-between mb-1">
                  <span>Folha Salarial (Teto)</span>
                </div>
                <span className={`font-bold text-[13px] mb-1.5 ${wageSum > team.max_wage_cap ? "text-red-400" : "text-gray-200"}`}>
                  R$ {wageSum.toLocaleString("pt-BR")} <span className="text-gray-500 font-normal">/ {parseFloat(team.max_wage_cap).toLocaleString("pt-BR")}</span>
                </span>
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      wageCapPercent > 90 ? "bg-red-500" : wageCapPercent > 70 ? "bg-yellow-500" : "bg-[#10b981]"
                    }`}
                    style={{ width: `${wageCapPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Menu de Navegação */}
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
          {userProfile?.role === "admin" && (
            <Link
              href="/admin"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-amber-400 hover:bg-amber-400/10 border border-transparent hover:border-amber-400/20"
            >
              <span>👑</span>
              Painel Admin
            </Link>
          )}
        </nav>
        {/* Footer Sidebar (Profile & Logout) */}
        <div className="p-4 border-t border-white/5 space-y-2">
          <Link
            href="/dashboard/profile"
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <span>⚙️</span>
            Configurações
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
          >
            <span>🚪</span>
            Sair
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header Mobile */}
        <header className="h-16 border-b border-white/5 bg-[#090d16]/80 flex lg:hidden items-center justify-between px-6">
          <span className="text-lg font-bold bg-gradient-to-r from-[#10b981] to-[#3b82f6] bg-clip-text text-transparent">
            LIGA MASTER
          </span>
          <div className="flex items-center gap-2">
            {/* Sininho de Notificações Mobile */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all text-xs flex items-center justify-center"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-white/10 bg-[#090d16]/95 shadow-2xl p-3 z-50 text-left">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2">
                    <span className="text-[10px] font-bold text-white">Notificações</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[8.5px] text-[#10b981] hover:text-[#059669] font-bold"
                      >
                        Lidas
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                    {notifications.length === 0 ? (
                      <p className="text-[9px] text-gray-500 text-center py-3">Sem notificações.</p>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`p-2 rounded-lg border text-[10px] ${
                            n.read ? "bg-white/[0.01] border-white/5 opacity-60" : "bg-[#10b981]/5 border-[#10b981]/15"
                          }`}
                        >
                          <p className="font-bold text-white text-[10.5px] leading-tight mb-0.5">{n.title}</p>
                          <p className="text-gray-400 leading-tight">{n.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {team && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
                R$ {(team.budget / 1e6).toFixed(1)}M
              </span>
            )}
            <Link
              href="/dashboard/profile"
              className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-white/5 border border-white/5 transition-colors"
            >
              ⚙️
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs font-bold text-red-400 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
            >
              Sair
            </button>
          </div>
        </header>

        {/* Menu Mobile Rápido */}
        <div className="flex lg:hidden bg-[#090d16]/50 border-b border-white/5 px-2 py-2 overflow-x-auto gap-2">
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
          {userProfile?.role === "admin" && (
            <Link
              href="/admin"
              className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20"
            >
              <span>👑</span>
              Admin
            </Link>
          )}
        </div>

        {/* Conteúdo Dinâmico */}
        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>

        {/* Toast flutuante Realtime */}
        {activeToast && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-emerald-500/30 bg-[#090d16]/90 p-4 shadow-2xl animate-slideIn flex gap-3 items-start border-l-4 border-l-[#10b981]">
            <div className="text-[#10b981] text-base flex-shrink-0 pt-0.5">🔔</div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <h4 className="text-xs font-bold text-white leading-tight">{activeToast.title}</h4>
              <p className="text-[10px] text-gray-400 leading-normal">{activeToast.content}</p>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-gray-500 hover:text-gray-300 text-xs font-bold px-1 transition-colors"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
