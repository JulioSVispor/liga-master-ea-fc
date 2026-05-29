"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function UserDashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [team, setTeam] = useState(null);
  const [wageSum, setWageSum] = useState(0);

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

          // Calcular soma dos salários do elenco do time
          const { data: players } = await supabase
            .from("players")
            .select("wage")
            .eq("team_id", teamData.id);

          const totalWages = players ? players.reduce((sum, p) => sum + parseFloat(p.wage || 0), 0) : 0;
          setWageSum(totalWages);
        }
      } catch (err) {
        console.error("Erro ao carregar dados do painel:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router, pathname]); // Recarregar finanças ao mudar de página para manter atualizado

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
    { name: "Meu Clube", path: "/dashboard", icon: "🛡️" },
    { name: "Olheiro / Scout", path: "/dashboard/scouting", icon: "🏃‍♂️" },
    { name: "Mercado", path: "/dashboard/market", icon: "💱" },
    { name: "Partidas", path: "/dashboard/matches", icon: "⚽" },
    { name: "Classificação", path: "/dashboard/standings", icon: "📈" },
  ];

  // Calcular porcentagem do teto de salários
  const wageCapPercent = team ? Math.min(Math.round((wageSum / parseFloat(team.max_wage_cap)) * 100), 100) : 0;

  return (
    <div className="flex min-h-screen bg-[#060913] text-gray-100">
      {/* Sidebar */}
      <aside className="w-68 border-r border-white/5 bg-[#090d16]/80 backdrop-blur-md hidden lg:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-white/5 justify-between">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-[#10b981] to-[#3b82f6] bg-clip-text text-transparent">
            LIGA MASTER
          </Link>
          {userProfile?.role === "admin" && (
            <Link
              href="/admin"
              className="text-[10px] uppercase font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20"
            >
              Admin
            </Link>
          )}
        </div>

        {/* Informações do Time & Finanças */}
        {team && (
          <div className="p-6 border-b border-white/5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] flex items-center justify-center font-bold border border-[#3b82f6]/20 text-lg">
                🛡️
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{team.name}</p>
                <p className="text-xs text-gray-400 truncate">{team.real_club_name}</p>
              </div>
            </div>

            {/* Finanças rápidas */}
            <div className="space-y-3 pt-2">
              {/* Orçamento */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                  <span>Orçamento Saldo</span>
                  <span className="font-semibold text-emerald-400">
                    R$ {parseFloat(team.budget).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Teto Salarial */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Folha Salarial (Teto)</span>
                  <span className={`font-semibold ${wageSum > team.max_wage_cap ? "text-red-400" : "text-gray-200"}`}>
                    {wageSum.toLocaleString("pt-BR")} / {parseFloat(team.max_wage_cap).toLocaleString("pt-BR")}
                  </span>
                </div>
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
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/5">
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
          <div className="flex items-center gap-3">
            {team && (
              <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                R$ {(team.budget / 1e6).toFixed(1)}M
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-red-400 px-3 py-1.5 rounded-lg bg-red-500/10"
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
        </div>

        {/* Conteúdo Dinâmico */}
        <main className="p-6 md:p-8 max-w-7xl w-full mx-auto flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
