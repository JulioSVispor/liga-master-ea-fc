"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    usersCount: 0,
    teamsCount: 0,
    playersCount: 0,
    marketWindowOpen: false,
  });
  const [loading, setLoading] = useState(true);
  const [updatingWindow, setUpdatingWindow] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        // 1. Obter número de exceções / disputas (matches.status = 'dispute')
        const { count: disputesCount } = await supabase
          .from("matches")
          .select("*", { count: "exact", head: true })
          .eq("status", "dispute");

        // 2. Obter pendências de Waitlist (waitlist.status = 'pending')
        const { count: waitlistCount } = await supabase
          .from("waitlist")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        // 3. Status da Janela de Transferências
        const { data: windowSetting } = await supabase
          .from("seasons")
          .select("status")
          .limit(1);

        const marketWindowOpen = windowSetting && windowSetting.length > 0 && windowSetting[0].status === "active";

        setStats({
          disputesCount: disputesCount || 0,
          waitlistCount: waitlistCount || 0,
          marketWindowOpen: !!marketWindowOpen,
        });
      } catch (err) {
        console.error("Erro ao carregar dados do admin:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const toggleMarketWindow = async () => {
    setUpdatingWindow(true);
    const newStatus = !stats.marketWindowOpen;

    try {
      // 1. Atualizar a temporada ativa no Supabase
      const { data: activeSeasons } = await supabase
        .from("seasons")
        .select("id")
        .eq("status", stats.marketWindowOpen ? "active" : "completed")
        .limit(1);

      if (activeSeasons && activeSeasons.length > 0) {
        await supabase
          .from("seasons")
          .update({ status: newStatus ? "active" : "completed" })
          .eq("id", activeSeasons[0].id);
      } else {
        // Criar uma temporada inicial se não existir nenhuma
        await supabase.from("seasons").insert([
          { name: "Temporada 1", status: newStatus ? "active" : "completed" }
        ]);
      }

      // 2. Sincronizar as tabelas de configurações globais
      const settingsUpsert = [
        { key: "negotiations_enabled", value: newStatus ? "true" : "false" },
        { key: "salary_window_open", value: newStatus ? "true" : "false" },
        { key: "trade_enabled", value: newStatus ? "true" : "false" },
        { key: "loan_enabled", value: newStatus ? "true" : "false" },
        { key: "buyout_enabled", value: newStatus ? "true" : "false" }
      ];

      await supabase
        .from("settings")
        .upsert(settingsUpsert, { onConflict: "key" });

      setStats((prev) => ({
        ...prev,
        marketWindowOpen: newStatus,
      }));
    } catch (err) {
      alert("Erro ao atualizar a janela de transferências: " + err.message);
    } finally {
      setUpdatingWindow(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Painel de Controle
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Visão geral da liga e ferramentas rápidas de gerenciamento.
        </p>
      </div>

      {/* Controle de Exceções e Triagem (Datadog Style) */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Partidas em Disputa */}
        <a href="/admin/disputes" className={`glass-card p-6 rounded-2xl block transition-all hover:bg-white/[0.02] ${stats.disputesCount > 0 ? "border-red-500/30" : "border-emerald-500/10"}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-400">Arbitragem / Disputas</span>
            <span className="text-2xl">{stats.disputesCount > 0 ? "🚨" : "⚖️"}</span>
          </div>
          <p className={`mt-4 text-3xl font-bold ${stats.disputesCount > 0 ? "text-red-400" : "text-white"}`}>{stats.disputesCount}</p>
          <span className="text-xs text-gray-500 mt-2 block">
            {stats.disputesCount > 0 ? "Placares contestados aguardando juiz" : "Nenhum conflito de placar"}
          </span>
        </a>

        {/* Fila de Inscrição */}
        <a href="/admin/waitlist" className={`glass-card p-6 rounded-2xl block transition-all hover:bg-white/[0.02] ${stats.waitlistCount > 0 ? "border-amber-500/30" : "border-white/5"}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-400">Lista de Espera</span>
            <span className="text-2xl">📝</span>
          </div>
          <p className={`mt-4 text-3xl font-bold ${stats.waitlistCount > 0 ? "text-amber-400" : "text-white"}`}>{stats.waitlistCount}</p>
          <span className="text-xs text-gray-500 mt-2 block">
            {stats.waitlistCount > 0 ? "Candidatos aguardando aprovação" : "Nenhum candidato pendente"}
          </span>
        </a>

        {/* Teto Salarial (Placeholder p/ query futura) */}
        <a href="/admin/audit" className="glass-card p-6 rounded-2xl block transition-all hover:bg-white/[0.02] border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-400">Auditoria (Excesso Teto)</span>
            <span className="text-2xl">💰</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-white">-</p>
          <span className="text-xs text-gray-500 mt-2 block">Monitoramento de compliance salarial</span>
        </a>
      </div>

      {/* Controle de Janela de Transferência */}
      <div className="glass-panel p-8 rounded-2xl border border-white/5 bg-[#090d16]/75 relative overflow-hidden">
        <div className="absolute top-0 right-0 h-32 w-32 -z-10 rounded-full bg-[#10b981]/5 blur-2xl" />
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="max-w-xl">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className={stats.marketWindowOpen ? "text-[#10b981]" : "text-red-400"}>
                ●
              </span>
              Mercado de Transferências: {stats.marketWindowOpen ? "ABERTO" : "FECHADO"}
            </h3>
            <p className="mt-2 text-sm text-gray-400 leading-relaxed">
              Quando aberta, a janela de transferências permite que os times realizem compras imediatas de agentes livres, 
              listem jogadores no mercado, participem de leilões e enviem propostas de trocas diretas.
            </p>
          </div>

          <button
            onClick={toggleMarketWindow}
            disabled={updatingWindow}
            className={`flex-shrink-0 px-6 py-3.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 ${
              stats.marketWindowOpen
                ? "bg-red-600 hover:bg-red-500 shadow-red-900/20"
                : "bg-[#10b981] hover:bg-[#059669] shadow-emerald-900/20"
            }`}
          >
            {updatingWindow 
              ? "Processando..." 
              : stats.marketWindowOpen 
                ? "Fechar Janela de Transferências" 
                : "Abrir Janela de Transferências"
            }
          </button>
        </div>
      </div>
    </div>
  );
}
