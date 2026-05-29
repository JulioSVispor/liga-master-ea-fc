"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NegotiationsHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [transfers, setTransfers] = useState([]);
  const [team, setTeam] = useState(null);
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

          // 2. Carregar histórico de transferências envolvendo este time
          const { data: history, error: historyErr } = await supabase
            .from("transfer_history")
            .select("*")
            .or(`from_team_id.eq.${teamData.id},to_team_id.eq.${teamData.id}`)
            .order("created_at", { ascending: false });

          if (historyErr) throw historyErr;
          setTransfers(history || []);
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
            Histórico de Negociações
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Acompanhe o log de todas as contratações, vendas, trocas e dispensas do seu time.
          </p>
        </div>

        {/* Filtro por tipo de transação */}
        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "all", name: "Todos" },
            { id: "immediate_buy", name: "Compra Direta" },
            { id: "auction", name: "Leilão" },
            { id: "trade", name: "Troca" },
            { id: "release", name: "Dispensa" },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFilterType(btn.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                filterType === btn.id
                  ? "bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30"
                  : "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white"
              }`}
            >
              {btn.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de logs */}
      <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Jogador</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Origem</th>
                <th className="px-6 py-4">Destino</th>
                <th className="px-6 py-4 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-gray-200">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                    <span className="text-3xl block mb-2">📋</span>
                    Nenhuma negociação encontrada para este filtro.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((item) => {
                  const typeInfo = translateType(item.transfer_type);
                  const isIncoming = item.to_team_id === team.id;
                  const isRelease = item.transfer_type === "release";
                  const dateStr = new Date(item.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.01] transition-colors">
                      {/* Data */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                        {dateStr}
                      </td>

                      {/* Jogador */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                            {item.player_face_url ? (
                              <img
                                src={item.player_face_url}
                                alt={item.player_name}
                                className="h-full w-full object-cover scale-110"
                              />
                            ) : (
                              <span className="text-lg">👤</span>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-white text-xs">{item.player_name}</p>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">
                              {item.player_position} • Rating {item.player_rating}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${typeInfo.color}`}>
                          {typeInfo.name}
                        </span>
                      </td>

                      {/* Origem */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-300">
                        {item.from_team_name ? (
                          <span className={item.from_team_id === team.id ? "text-[#3b82f6] font-semibold" : ""}>
                            {item.from_team_name}
                          </span>
                        ) : (
                          <span className="text-gray-500 italic">Agente Livre</span>
                        )}
                      </td>

                      {/* Destino */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-300">
                        {item.to_team_name ? (
                          <span className={item.to_team_id === team.id ? "text-emerald-400 font-semibold" : ""}>
                            {item.to_team_name}
                          </span>
                        ) : (
                          <span className="text-gray-500 italic">Dispensado (Livre)</span>
                        )}
                      </td>

                      {/* Valor */}
                      <td className={`px-6 py-4 whitespace-nowrap text-right font-bold text-xs ${
                        isRelease 
                          ? "text-emerald-400" 
                          : isIncoming 
                            ? "text-red-400" 
                            : "text-[#3b82f6]"
                      }`}>
                        {isRelease ? "+" : isIncoming ? "-" : ""}R${" "}
                        {parseFloat(item.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
