"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import FinancialSummary from "@/features/dashboard/components/FinancialSummary";

export default function CentralFinanceiraPage() {
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState([]);
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // 1. Carregar time do usuário logado
        const { data: teamData } = await supabase
          .from("teams")
          .select("*")
          .eq("user_id", session.user.id)
          .single();

          if (teamData) {
          setTeam(teamData);

          // 2. Carregar jogadores do time para calcular folha
          const { data: playersData } = await supabase
            .from("players")
            .select("*")
            .eq("team_id", teamData.id);
          
          if (playersData) setPlayers(playersData);

          // 3. Carregar histórico de transferências
          const { data: history, error: historyErr } = await supabase
            .from("transfer_history")
            .select("*")
            .or(`from_team_id.eq.${teamData.id},to_team_id.eq.${teamData.id}`)
            .order("created_at", { ascending: false });

          if (historyErr) throw historyErr;

          // 4. Carregar todos os times para pegar os nomes dos técnicos
          const { data: allTeamsData } = await supabase
            .from("teams")
            .select("id, profiles(display_name)");
          
          if (allTeamsData && history) {
            const coachMap = {};
            allTeamsData.forEach(t => {
              if (t.profiles?.display_name) {
                coachMap[t.id] = t.profiles.display_name;
              }
            });
            const enhancedHistory = history.map(tx => ({
              ...tx,
              from_coach_name: coachMap[tx.from_team_id] || null,
              to_coach_name: coachMap[tx.to_team_id] || null,
            }));
            setTransfers(enhancedHistory || []);
          } else {
            setTransfers(history || []);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar histórico de transferências:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const translateType = (type) => {
    switch (type) {
      case "immediate_buy":
        return { name: "Compra Direta", color: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" };
      case "auction":
        return { name: "Leilão", color: "bg-amber-500/10 text-amber-400 border border-amber-500/25" };
      case "trade":
        return { name: "Troca", color: "bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/25" };
      case "release":
        return { name: "Dispensa", color: "bg-red-500/10 text-red-400 border border-red-500/25" };
      case "buyout":
        return { name: "Multa Rescisória", color: "bg-purple-500/10 text-purple-400 border border-purple-500/25" };
      case "loan":
        return { name: "Empréstimo", color: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/25" };
      default:
        return { name: type, color: "bg-gray-500/10 text-gray-400 border border-gray-500/25" };
    }
  };

  const filteredTransfers = transfers.filter((transfer) => {
    if (filterType === "all") return true;
    return transfer.transfer_type === filterType;
  });

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="glass-card p-8 text-center rounded-2xl max-w-xl mx-auto mt-10">
        <span className="text-4xl block mb-2">⚠️</span>
        <h2 className="text-xl font-bold text-white mb-2">Time Não Encontrado</h2>
        <p className="text-sm text-gray-400">
          Você precisa de uma equipe ativa para visualizar o histórico de negociações.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Extrato Financeiro
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Acompanhe o fluxo de caixa, orçamento, teto salarial e o extrato completo de transferências.
          </p>
        </div>
      </div>

      <FinancialSummary 
        team={team} 
        players={players} 
        financialHistory={transfers} 
        financialLoading={loading} 
      />
    </div>
  );
}
