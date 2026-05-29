"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminAuditPage() {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  // KPIs
  const [kpis, setKpis] = useState({
    totalCount: 0,
    totalVolume: 0,
    maxAmount: 0,
    avgAmount: 0,
  });

  const loadTransferHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("transfer_history")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const logs = data || [];
      setHistory(logs);

      // Calcular KPIs
      const totalCount = logs.length;
      
      // Apenas transações monetárias (não contar dispensas na soma de volume se preferir, ou somar tudo que tem valor)
      const monetaryTrans = logs.filter(l => l.amount > 0);
      const totalVolume = monetaryTrans.reduce((sum, item) => sum + parseFloat(item.amount), 0);
      
      const maxAmount = monetaryTrans.length > 0 
        ? Math.max(...monetaryTrans.map(item => parseFloat(item.amount))) 
        : 0;

      const avgAmount = monetaryTrans.length > 0 
        ? totalVolume / monetaryTrans.length 
        : 0;

      setKpis({
        totalCount,
        totalVolume,
        maxAmount,
        avgAmount,
      });

    } catch (err) {
      console.error("Erro ao carregar histórico de transferências:", err);
      alert("Erro ao carregar logs de auditoria: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransferHistory();
  }, []);

  const getTransferTypeLabel = (type) => {
    switch (type) {
      case "buyout":
        return { text: "Multa Rescisória", style: "bg-orange-500/10 text-orange-400 border-orange-500/20" };
      case "immediate_buy":
        return { text: "Compra Direta", style: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
      case "auction":
        return { text: "Leilão", style: "bg-purple-500/10 text-purple-400 border-purple-500/20" };
      case "trade":
        return { text: "Troca", style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
      case "loan":
        return { text: "Empréstimo", style: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" };
      case "release":
        return { text: "Dispensa", style: "bg-gray-500/10 text-gray-400 border-gray-500/20" };
      default:
        return { text: type, style: "bg-white/5 text-white border-white/10" };
    }
  };

  // Filtrar histórico baseado na busca e tipo
  const filteredHistory = history.filter((item) => {
    const matchesSearch = item.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.from_team_name && item.from_team_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (item.to_team_name && item.to_team_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === "all" || item.transfer_type === filterType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Auditoria Financeira & Logs
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Acompanhe o fluxo financeiro global, transações de mercado e movimentações do elenco.
          </p>
        </div>

        <button
          onClick={loadTransferHistory}
          className="rounded-xl border border-white/10 hover:bg-white/5 px-4 py-2 text-xs font-bold text-gray-300 transition-all flex items-center gap-2"
        >
          🔄 Atualizar
        </button>
      </div>

      {/* Grid de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-white/5 bg-[#090d16]/40 backdrop-blur-md space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total de Transações</p>
          <p className="text-2xl font-extrabold text-white">{kpis.totalCount}</p>
          <span className="text-[10px] text-gray-500">Registradas no sistema</span>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#090d16]/40 backdrop-blur-md space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Volume Movimentado</p>
          <p className="text-2xl font-extrabold text-emerald-400">
            R$ {kpis.totalVolume.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-emerald-500/70">Soma de valores negociados</span>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#090d16]/40 backdrop-blur-md space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Maior Transação</p>
          <p className="text-2xl font-extrabold text-purple-400">
            R$ {kpis.maxAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-purple-500/70">Recorde de valor monetário</span>
        </div>

        <div className="p-5 rounded-2xl border border-white/5 bg-[#090d16]/40 backdrop-blur-md space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Média por Negócio</p>
          <p className="text-2xl font-extrabold text-blue-400">
            R$ {kpis.avgAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-blue-500/70">Valor médio das transferências</span>
        </div>
      </div>

      {/* Filtros e Barra de Busca */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#090d16]/30 p-4 rounded-xl border border-white/5">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Buscar por Jogador/Time</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Ex: Neymar, Real Madrid..."
            className="w-full bg-[#070b13] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#10b981] transition-all"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Filtrar por Tipo</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full bg-[#070b13] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#10b981] transition-all"
          >
            <option value="all">Todas as Negociações</option>
            <option value="buyout">Multa Rescisória</option>
            <option value="immediate_buy">Compra Direta</option>
            <option value="auction">Leilão</option>
            <option value="trade">Troca</option>
            <option value="loan">Empréstimo</option>
            <option value="release">Dispensa / Reembolso</option>
          </select>
        </div>

        <div className="flex items-end justify-end">
          <span className="text-xs text-gray-400">
            Mostrando <strong className="text-white">{filteredHistory.length}</strong> de{" "}
            <strong className="text-white">{history.length}</strong> registros
          </span>
        </div>
      </div>

      {/* Lista de Registros da Auditoria */}
      <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Jogador</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">De (Origem)</th>
                <th className="px-6 py-4">Para (Destino)</th>
                <th className="px-6 py-4 text-right">Valor / Compensação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs sm:text-sm text-gray-200">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                    Nenhuma transação encontrada correspondente aos filtros.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((log) => {
                  const badge = getTransferTypeLabel(log.transfer_type);
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                      {/* Data */}
                      <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </td>

                      {/* Jogador */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white/5 overflow-hidden border border-white/10 flex items-center justify-center text-xs text-gray-400">
                            {log.player_face_url ? (
                              <img src={log.player_face_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              "🏃‍♂️"
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{log.player_name}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold">
                              {log.player_position || "--"} • Rating: {log.player_rating || "--"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.style}`}>
                          {badge.text}
                        </span>
                      </td>

                      {/* De */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.from_team_name ? (
                          <div className="flex items-center gap-1.5">
                            <span>🛡️</span>
                            <span className="font-medium text-white">{log.from_team_name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500 italic">Agente Livre / Sistema</span>
                        )}
                      </td>

                      {/* Para */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.to_team_name ? (
                          <div className="flex items-center gap-1.5">
                            <span>🛡️</span>
                            <span className="font-medium text-white">{log.to_team_name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500 italic">Dispensa / Reembolso</span>
                        )}
                      </td>

                      {/* Valor */}
                      <td className="px-6 py-4 whitespace-nowrap text-right font-extrabold text-white text-xs sm:text-sm">
                        {parseFloat(log.amount) === 0 ? (
                          <span className="text-gray-500 font-normal italic">Sem custo</span>
                        ) : (
                          <span className={log.transfer_type === "release" ? "text-red-400" : "text-emerald-400"}>
                            {log.transfer_type === "release" ? "-" : ""}R$ {parseFloat(log.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        )}
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
