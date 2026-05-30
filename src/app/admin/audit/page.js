"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminAuditPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("logs"); // "logs" | "rules" | "rewards"
  const [history, setHistory] = useState([]);
  const [teams, setTeams] = useState([]);
  
  // Estados de Filtro para os Logs
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Estados de Criação de Premiação/Multa
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [actionType, setActionType] = useState("reward"); // "reward" | "fine"
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [applying, setApplying] = useState(false);

  // KPIs de Logs
  const [kpis, setKpis] = useState({
    totalCount: 0,
    totalVolume: 0,
    maxAmount: 0,
    avgAmount: 0,
  });

  const [msg, setMsg] = useState({ text: "", type: "" });

  const showMsg = (text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 5000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Carregar Histórico Financeiro Completo
      const { data: historyData, error: historyError } = await supabase
        .from("transfer_history")
        .select("*")
        .order("created_at", { ascending: false });

      if (historyError) throw historyError;
      setHistory(historyData || []);

      // Calcular KPIs
      const logs = historyData || [];
      const totalCount = logs.length;
      const monetaryTrans = logs.filter((l) => parseFloat(l.amount) > 0);
      const totalVolume = monetaryTrans.reduce((sum, item) => sum + parseFloat(item.amount), 0);
      const maxAmount = monetaryTrans.length > 0 ? Math.max(...monetaryTrans.map((item) => parseFloat(item.amount))) : 0;
      const avgAmount = monetaryTrans.length > 0 ? totalVolume / monetaryTrans.length : 0;

      setKpis({ totalCount, totalVolume, maxAmount, avgAmount });

      // 2. Carregar Times com seus jogadores para Auditoria de Regras
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("*, players:players!players_team_id_fkey(id, name, wage, rating), profiles(display_name)")
        .order("name", { ascending: true });

      if (teamsError) throw teamsError;
      setTeams(teamsData || []);

    } catch (err) {
      console.error(err);
      showMsg("Erro ao carregar dados: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Aplicar Bônus/Prêmio ou Multa a um Time
  const handleApplyAction = async (e) => {
    e.preventDefault();
    if (!selectedTeamId) {
      showMsg("Selecione um clube para aplicar a ação!", "error");
      return;
    }
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      showMsg("Insira um valor numérico válido maior que zero!", "error");
      return;
    }
    if (!reason.trim()) {
      showMsg("Descreva o motivo desta movimentação!", "error");
      return;
    }

    setApplying(true);
    try {
      const teamObj = teams.find((t) => t.id === selectedTeamId);
      if (!teamObj) throw new Error("Clube não encontrado.");

      // 1. Atualizar saldo do clube
      const newBudget = actionType === "reward" 
        ? parseFloat(teamObj.budget) + val 
        : parseFloat(teamObj.budget) - val;

      const { error: updateError } = await supabase
        .from("teams")
        .update({ budget: newBudget })
        .eq("id", selectedTeamId);

      if (updateError) throw updateError;

      // 2. Gravar no histórico de transferências (disparará o trigger de Notícias automáticas)
      const { error: historyError } = await supabase.from("transfer_history").insert({
        player_name: reason.trim(), // Usamos este campo para guardar o motivo da premiação/multa
        from_team_id: actionType === "fine" ? selectedTeamId : null,
        to_team_id: actionType === "reward" ? selectedTeamId : null,
        from_team_name: actionType === "fine" ? teamObj.name : "Liga Master (Organização)",
        to_team_name: actionType === "reward" ? teamObj.name : "Multas / Cobranças",
        amount: val,
        transfer_type: actionType, // 'reward' ou 'fine'
        player_id: null,
      });

      if (historyError) throw historyError;

      // 3. Criar notificação para o usuário do clube
      if (teamObj.user_id) {
        await supabase.from("notifications").insert({
          user_id: teamObj.user_id,
          title: actionType === "reward" ? "🏆 Bônus Creditado!" : "⚠️ Multa Aplicada!",
          content: actionType === "reward"
            ? `Seu clube recebeu R$ ${val.toLocaleString("pt-BR")} de bônus oficial da liga. Motivo: ${reason}`
            : `Seu clube foi multado em R$ ${val.toLocaleString("pt-BR")} pela organização da liga. Motivo: ${reason}`,
        });
      }

      showMsg(actionType === "reward" ? "Prêmio creditado com sucesso!" : "Multa aplicada com sucesso!");
      setAmount("");
      setReason("");
      
      // Recarregar dados
      await loadData();
    } catch (err) {
      console.error(err);
      showMsg("Erro ao processar movimentação: " + err.message, "error");
    } finally {
      setApplying(false);
    }
  };

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
      case "salary_charge":
        return { text: "Balanço Salarial", style: "bg-red-500/10 text-red-400 border-red-500/20" };
      case "reward":
        return { text: "Premiação / Bônus", style: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
      case "fine":
        return { text: "Multa Aplicada", style: "bg-red-500/10 text-red-400 border-red-500/20" };
      case "sponsorship":
        return { text: "Patrocínio", style: "bg-teal-500/10 text-teal-400 border-teal-500/20" };
      default:
        return { text: type, style: "bg-white/5 text-white border-white/10" };
    }
  };

  // Filtrar histórico baseado na busca e tipo
  const filteredHistory = history.filter((item) => {
    const searchString = searchTerm.toLowerCase();
    const matchesSearch = 
      (item.player_name && item.player_name.toLowerCase().includes(searchString)) ||
      (item.from_team_name && item.from_team_name.toLowerCase().includes(searchString)) ||
      (item.to_team_name && item.to_team_name.toLowerCase().includes(searchString));
    const matchesType = filterType === "all" || item.transfer_type === filterType;
    return matchesSearch && matchesType;
  });

  // Geração de Alertas de Auditoria de Regras
  const generateAlerts = () => {
    const alerts = [];
    teams.forEach((t) => {
      const squadWages = t.players ? t.players.reduce((sum, p) => sum + parseFloat(p.wage || 0), 0) : 0;
      const squadSize = t.players ? t.players.length : 0;
      
      // 1. Alerta de Teto Salarial Estourado
      if (squadWages > parseFloat(t.max_wage_cap)) {
        alerts.push({
          id: `${t.id}-wage-cap`,
          type: "danger",
          teamName: t.name,
          manager: t.profiles?.display_name || "Sem Técnico",
          title: "Folha Salarial acima do Teto permitido!",
          details: `Folha Salarial: R$ ${squadWages.toLocaleString("pt-BR")} | Teto Máximo: R$ ${parseFloat(t.max_wage_cap).toLocaleString("pt-BR")} (Excesso de R$ ${(squadWages - t.max_wage_cap).toLocaleString("pt-BR")})`,
        });
      }

      // 2. Alerta de Excesso de Jogadores (Elenco inchado)
      if (squadSize > 24) {
        alerts.push({
          id: `${t.id}-squad-size`,
          type: "warning",
          teamName: t.name,
          manager: t.profiles?.display_name || "Sem Técnico",
          title: "Número de Jogadores acima do Limite!",
          details: `Total de atletas no elenco: ${squadSize} (Limite máximo recomendado: 24 jogadores)`,
        });
      }

      // 3. Alerta de Orçamento Negativo
      if (parseFloat(t.budget) < 0) {
        alerts.push({
          id: `${t.id}-negative-budget`,
          type: "danger",
          teamName: t.name,
          manager: t.profiles?.display_name || "Sem Técnico",
          title: "Orçamento de Transferências Negativo!",
          details: `Saldo em caixa: R$ ${parseFloat(t.budget).toLocaleString("pt-BR")} (Risco de insolvência ou bloqueio de transferências)`,
        });
      }
    });
    return alerts;
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Auditoria & Finanças da Liga
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Monitore o fluxo de caixa, valide regras da liga e distribua premiações ou multas.
          </p>
        </div>

        <button
          onClick={loadData}
          className="rounded-xl border border-white/10 hover:bg-white/5 px-4 py-2 text-xs font-bold text-gray-300 transition-all flex items-center gap-2"
        >
          🔄 Atualizar Dados
        </button>
      </div>

      {/* Banner de Mensagens */}
      {msg.text && (
        <div
          className={`p-3 rounded-xl border text-sm flex items-center gap-2 ${
            msg.type === "error"
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          <span>{msg.type === "error" ? "⚠️" : "✅"}</span>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-white/5 gap-2">
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-6 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "logs" ? "border-[#10b981] text-[#10b981]" : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          🧾 Histórico Financeiro
        </button>
        <button
          onClick={() => setActiveTab("rules")}
          className={`px-6 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "rules" ? "border-[#10b981] text-[#10b981]" : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          🚨 Alertas de Regras ({generateAlerts().length})
        </button>
        <button
          onClick={() => setActiveTab("rewards")}
          className={`px-6 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "rewards" ? "border-[#10b981] text-[#10b981]" : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          🏆 Premiações & Multas
        </button>
      </div>

      {/* ABA 1: HISTÓRICO FINANCEIRO */}
      {activeTab === "logs" && (
        <div className="space-y-8">
          {/* Grid de KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border border-white/5 bg-[#090d16]/40 backdrop-blur-md space-y-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total de Registros</p>
              <p className="text-2xl font-extrabold text-white">{kpis.totalCount}</p>
              <span className="text-[10px] text-gray-500">Gravados no histórico</span>
            </div>

            <div className="p-5 rounded-2xl border border-white/5 bg-[#090d16]/40 backdrop-blur-md space-y-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Volume Transacionado</p>
              <p className="text-2xl font-extrabold text-emerald-400">
                R$ {kpis.totalVolume.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-emerald-500/70">Volume monetário negociado</span>
            </div>

            <div className="p-5 rounded-2xl border border-white/5 bg-[#090d16]/40 backdrop-blur-md space-y-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Maior Transação</p>
              <p className="text-2xl font-extrabold text-purple-400">
                R$ {kpis.maxAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-purple-500/70">Maior transferência comercial</span>
            </div>

            <div className="p-5 rounded-2xl border border-white/5 bg-[#090d16]/40 backdrop-blur-md space-y-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Média por Contrato</p>
              <p className="text-2xl font-extrabold text-blue-400">
                R$ {kpis.avgAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-blue-500/70">Média geral por negócio</span>
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
                placeholder="Ex: Neymar, Vasco da Gama..."
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
                <option value="release">Dispensa de Atleta</option>
                <option value="salary_charge">Balanço Salarial</option>
                <option value="reward">Premiações/Bônus</option>
                <option value="fine">Multas da Liga</option>
                <option value="sponsorship">Patrocínio</option>
              </select>
            </div>

            <div className="flex items-end justify-end">
              <span className="text-xs text-gray-400">
                Exibindo <strong className="text-white">{filteredHistory.length}</strong> de{" "}
                <strong className="text-white">{history.length}</strong> transações
              </span>
            </div>
          </div>

          {/* Tabela de Logs */}
          <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02] text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Jogador / Motivo</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Origem (Pagador)</th>
                    <th className="px-6 py-4">Destino (Recebedor)</th>
                    <th className="px-6 py-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs sm:text-sm text-gray-200">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                        Nenhuma transação financeira registrada correspondente aos filtros.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((log) => {
                      const badge = getTransferTypeLabel(log.transfer_type);
                      return (
                        <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-gray-400">
                            {new Date(log.created_at).toLocaleString("pt-BR")}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white/5 overflow-hidden border border-white/10 flex items-center justify-center text-xs text-gray-400">
                                {log.player_face_url ? (
                                  <img src={log.player_face_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  "💵"
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-white">{log.player_name}</p>
                                {log.player_position && (
                                  <p className="text-[10px] text-gray-400 uppercase font-bold">
                                    {log.player_position} • Rating: {log.player_rating}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.style}`}>
                              {badge.text}
                            </span>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                            {log.from_team_name || <span className="text-gray-500 italic">Sistema / Agente Livre</span>}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                            {log.to_team_name || <span className="text-gray-500 italic">Rescisão / Desconto</span>}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-right font-extrabold text-white">
                            R$ {parseFloat(log.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
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
      )}

      {/* ABA 2: AUDITORIA DE REGRAS */}
      {activeTab === "rules" && (
        <div className="space-y-6 text-left">
          <h3 className="text-lg font-bold text-white">🚨 Verificação de Regras da Liga</h3>
          <p className="text-xs text-gray-400">Varredura automática e em tempo real sobre infrações nos elencos das equipes.</p>

          {generateAlerts().length === 0 ? (
            <div className="glass-panel p-8 text-center rounded-2xl border border-emerald-500/10 bg-emerald-500/5 space-y-2">
              <span className="text-3xl">✅</span>
              <p className="font-bold text-white">Nenhuma infração detectada!</p>
              <p className="text-xs text-gray-400">Todas as equipes estão com as contas, elenco e folha salarial dentro das regras.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {generateAlerts().map((alert) => (
                <div
                  key={alert.id}
                  className={`p-5 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                    alert.type === "danger"
                      ? "bg-red-500/5 border-red-500/20 text-red-300"
                      : "bg-amber-500/5 border-amber-500/20 text-amber-300"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{alert.type === "danger" ? "🛑" : "⚠️"}</span>
                      <strong className="text-sm font-bold text-white">{alert.title}</strong>
                    </div>
                    <p className="text-xs text-gray-300">{alert.details}</p>
                    <div className="text-[10px] text-gray-400 mt-1">
                      Clube: <strong className="text-white">{alert.teamName}</strong> • Técnico: <strong className="text-white">{alert.manager}</strong>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded text-[9px] font-extrabold uppercase border ${
                    alert.type === "danger" ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  }`}>
                    {alert.type === "danger" ? "Irregularidade Crítica" : "Atenção"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA 3: PREMIAÇÃO E MULTAS */}
      {activeTab === "rewards" && (
        <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-6 sm:p-8 space-y-6 text-left">
          <div className="border-b border-white/5 pb-4">
            <h3 className="text-base font-bold text-white">🏆 Conceder Premiações, Bônus e Aplicar Multas</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Movimente saldos de clubes de forma customizada. A ação gerará automaticamente alertas e notícias no mural.
            </p>
          </div>

          <form onSubmit={handleApplyAction} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Selecionar Time */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">Selecionar Clube</label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full bg-[#090d16] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#10b981] transition-colors"
                >
                  <option value="">Selecione o time...</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#090d16] text-white">
                      {t.name} (Técnico: {t.profiles?.display_name || "Sem Técnico"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Ação */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">Tipo de Movimentação</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full bg-[#090d16] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#10b981] transition-colors"
                >
                  <option value="reward" className="bg-[#090d16] text-emerald-400 font-bold">🏆 Conceder Premiação / Bônus (+)</option>
                  <option value="fine" className="bg-[#090d16] text-red-400 font-bold">⚠️ Aplicar Multa / Cobrança (-)</option>
                </select>
              </div>

              {/* Valor R$ */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">Valor em Caixa (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ex: 5000000.00"
                  className="w-full bg-[#090d16] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#10b981] transition-colors"
                />
              </div>

              {/* Justificativa / Motivo */}
              <div className="md:col-span-3 space-y-1">
                <label className="text-xs font-semibold text-gray-300">Justificativa / Motivo</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Campeão da Série A, Vice-Campeão da Copa ou Multa por atraso de súmula..."
                  className="w-full bg-[#090d16] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#10b981] transition-colors"
                  maxLength={150}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={applying}
                className={`rounded-xl px-6 py-3 text-xs font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${
                  actionType === "reward" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {applying ? "Aplicando..." : actionType === "reward" ? "🏆 Creditar Bônus" : "⚠️ Aplicar Penalidade"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
