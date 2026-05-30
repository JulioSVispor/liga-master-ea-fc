"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function StatCard({ title, icon, children }) {
  return (
    <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-5 space-y-3">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3">
        <span className="text-lg">{icon}</span>
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function AdminSeasonPage() {
  const [loading, setLoading] = useState(true);
  const [activeSeason, setActiveSeason] = useState(null);
  const [topScorers, setTopScorers] = useState([]);
  const [topAssists, setTopAssists] = useState([]);
  const [topMotm, setTopMotm] = useState([]);
  const [standings, setStandings] = useState([]);

  const [finishing, setFinishing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [msg, setMsg] = useState({ text: "", type: "" });

  // Fases e Salários do Campeonato
  const [seasonStage, setSeasonStage] = useState("first_half");
  const [roundsPerHalf, setRoundsPerHalf] = useState(10);
  const [teamsList, setTeamsList] = useState([]);
  const [roundsToCharge, setRoundsToCharge] = useState(20);
  const [customDebits, setCustomDebits] = useState({});
  const [processingWages, setProcessingWages] = useState(false);

  const showMsg = (text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 6000);
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Temporada ativa
        const { data: seasonData } = await supabase
          .from("seasons")
          .select("*")
          .eq("status", "active")
          .maybeSingle();

        setActiveSeason(seasonData || null);

        // Configurações de Fases da Temporada
        const { data: settingsData } = await supabase
          .from("settings")
          .select("*")
          .in("key", ["season_stage", "season_rounds_per_half"]);

        const map = {};
        if (settingsData) {
          settingsData.forEach((s) => {
            map[s.key] = s.value;
          });
        }
        
        const stage = map.season_stage || "first_half";
        setSeasonStage(stage);
        
        const roundsVal = parseInt(map.season_rounds_per_half || "10");
        setRoundsPerHalf(roundsVal);
        setRoundsToCharge(roundsVal * 2);

        if (seasonData) {
          // Artilheiros (top 5 por gols)
          const { data: scorersData } = await supabase
            .from("match_events")
            .select("player_id, players(name, teams(name))")
            .eq("event_type", "goal")
            .eq("season_id", seasonData.id);

          if (scorersData) {
            const countMap = {};
            scorersData.forEach((ev) => {
              const key = ev.player_id;
              if (!countMap[key]) {
                countMap[key] = {
                  id: key,
                  name: ev.players?.name || "Desconhecido",
                  team: ev.players?.teams?.name || "—",
                  count: 0,
                };
              }
              countMap[key].count++;
            });
            setTopScorers(
              Object.values(countMap)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)
            );
          }

          // Assistências (top 5)
          const { data: assistsData } = await supabase
            .from("match_events")
            .select("player_id, players(name, teams(name))")
            .eq("event_type", "assist")
            .eq("season_id", seasonData.id);

          if (assistsData) {
            const countMap = {};
            assistsData.forEach((ev) => {
              const key = ev.player_id;
              if (!countMap[key]) {
                countMap[key] = {
                  id: key,
                  name: ev.players?.name || "Desconhecido",
                  team: ev.players?.teams?.name || "—",
                  count: 0,
                };
              }
              countMap[key].count++;
            });
            setTopAssists(
              Object.values(countMap)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)
            );
          }

          // Melhor em Campo (MOTM) (top 5)
          const { data: motmData } = await supabase
            .from("matches")
            .select("motm_player_id, players:players!motm_player_id(name, teams:teams!team_id(name))")
            .eq("season_id", seasonData.id)
            .eq("status", "confirmed")
            .not("motm_player_id", "is", null);

          if (motmData) {
            const countMap = {};
            motmData.forEach((m) => {
              const key = m.motm_player_id;
              if (m.players) {
                if (!countMap[key]) {
                  countMap[key] = {
                    id: key,
                    name: m.players.name || "Desconhecido",
                    team: m.players.teams?.name || "—",
                    count: 0,
                  };
                }
                countMap[key].count++;
              }
            });
            setTopMotm(
              Object.values(countMap)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)
            );
          }

          // Classificação
          const { data: standingsData } = await supabase
            .from("standings")
            .select("*, teams(name, badge_url)")
            .eq("season_id", seasonData.id)
            .order("points", { ascending: false })
            .order("goals_for", { ascending: false })
            .limit(10);

          setStandings(standingsData || []);
        }

        // Se estiver na fase de fechar salários, carregar lista de times
        if (stage === "season_end_wages") {
          const { data: teamsData, error: teamsError } = await supabase
            .from("teams")
            .select("id, name, budget, players(wage)")
            .order("name", { ascending: true });

          if (!teamsError && teamsData) {
            setTeamsList(teamsData);
            const debits = {};
            teamsData.forEach((team) => {
              const weeklyWage = team.players ? team.players.reduce((sum, p) => sum + parseFloat(p.wage || 0), 0) : 0;
              debits[team.id] = (weeklyWage * (roundsVal * 2)).toString();
            });
            setCustomDebits(debits);
          }
        }

      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const loadTeamsAndWages = async (roundsVal) => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, budget, players(wage)")
        .order("name", { ascending: true });

      if (error) throw error;
      if (data) {
        setTeamsList(data);
        const debits = {};
        data.forEach((team) => {
          const weeklyWage = team.players ? team.players.reduce((sum, p) => sum + parseFloat(p.wage || 0), 0) : 0;
          debits[team.id] = (weeklyWage * roundsVal).toString();
        });
        setCustomDebits(debits);
      }
    } catch (err) {
      console.error("Erro ao carregar dados dos clubes:", err);
    }
  };

  const handleAdvanceStage = async (newStage, additionalSettings = []) => {
    try {
      const settingsUpsert = [
        { key: "season_stage", value: newStage },
        ...additionalSettings
      ];

      const { error } = await supabase
        .from("settings")
        .upsert(settingsUpsert, { onConflict: "key" });

      if (error) throw error;

      setSeasonStage(newStage);

      if (newStage === "season_end_wages") {
        await loadTeamsAndWages(roundsToCharge);
      }

      showMsg("Etapa do campeonato atualizada com sucesso!");
    } catch (err) {
      showMsg("Erro ao atualizar etapa: " + err.message, "error");
    }
  };

  const handleRoundsToChargeChange = (value) => {
    const rounds = parseInt(value) || 0;
    setRoundsToCharge(rounds);
    
    setCustomDebits((prev) => {
      const updated = { ...prev };
      teamsList.forEach((team) => {
        const weeklyWage = team.players ? team.players.reduce((sum, p) => sum + parseFloat(p.wage || 0), 0) : 0;
        updated[team.id] = (weeklyWage * rounds).toString();
      });
      return updated;
    });
  };

  const handleProcessWages = async () => {
    setProcessingWages(true);
    try {
      const teamIds = [];
      const amounts = [];

      teamsList.forEach((team) => {
        const val = parseFloat(customDebits[team.id]) || 0;
        teamIds.push(team.id);
        amounts.push(val);
      });

      const label = `${roundsToCharge} semanas cobradas`;

      const { data, error } = await supabase.rpc("deduct_custom_salaries", {
        p_team_ids: teamIds,
        p_amounts: amounts,
        p_rounds_label: label,
      });

      if (error) throw error;

      if (data && data.success) {
        showMsg(data.message || "Balanço concluído! Saldo de transferências dos times atualizados.");
        
        await supabase.from("settings").upsert([
          { key: "season_stage", value: "first_half" }
        ], { onConflict: "key" });
        setSeasonStage("first_half");

        // Abrir modal de confirmação final para encerrar a temporada
        setShowModal(true);
      } else {
        showMsg(data?.message || "Erro ao processar balanço financeiro.", "error");
      }
    } catch (err) {
      showMsg("Erro ao processar balanço financeiro: " + err.message, "error");
    } finally {
      setProcessingWages(false);
    }
  };

  const handleFinishSeason = async () => {
    if (confirmText !== "CONFIRMAR") {
      showMsg("Digite exatamente 'CONFIRMAR' para prosseguir.", "error");
      return;
    }
    if (!activeSeason) return;

    setFinishing(true);
    try {
      const { error } = await supabase
        .from("seasons")
        .update({ status: "completed" })
        .eq("id", activeSeason.id);

      if (error) throw error;

      setActiveSeason((prev) => ({ ...prev, status: "completed" }));
      setShowModal(false);
      setConfirmText("");
      showMsg("Temporada finalizada com sucesso! Uma nova temporada poderá ser criada.");
    } catch (err) {
      showMsg("Erro ao finalizar temporada: " + err.message, "error");
    } finally {
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Finalizar Temporada
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Visualize o resumo da temporada atual e finalize-a quando o campeonato terminar.
        </p>
      </div>

      {/* Feedback global */}
      {msg.text && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-2 ${
            msg.type === "error"
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          <span>{msg.type === "error" ? "⚠️" : "✅"}</span>
          {msg.text}
        </div>
      )}

      {/* Temporada Ativa */}
      {!activeSeason ? (
        <div className="glass-panel rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8 text-center space-y-2">
          <span className="text-4xl">🏁</span>
          <p className="text-white font-semibold">Nenhuma temporada ativa encontrada.</p>
          <p className="text-sm text-gray-400">
            Crie uma nova temporada na seção de Competições para começar.
          </p>
        </div>
      ) : (
        <>
          {/* Painel de Fases da Temporada */}
          <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-6 sm:p-8 space-y-6">
            <div className="border-b border-white/5 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                🎮 Painel de Fases do Campeonato
              </h2>
              <p className="text-xs text-gray-400">
                Acompanhe e avance as fases do campeonato. O mercado de transferências e cobranças financeiras são gerenciados por aqui.
              </p>
            </div>

            {/* Steps visual indicator */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Step 1 */}
              <div className={`p-4 rounded-xl border transition-all ${
                seasonStage === "first_half" 
                  ? "bg-blue-500/10 border-blue-500/30 text-white" 
                  : "bg-white/5 border-white/5 text-gray-500"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">Etapa 1</span>
                  <span className="text-sm">{seasonStage === "first_half" ? "🟢 Ativa" : ""}</span>
                </div>
                <h4 className="text-sm font-bold mt-2">⚽ Turno</h4>
                <p className="text-[11px] text-gray-400 mt-1">Jogos de ida e fases de grupo em andamento.</p>
              </div>

              {/* Step 2 */}
              <div className={`p-4 rounded-xl border transition-all ${
                seasonStage === "mid_season_market" 
                  ? "bg-amber-500/10 border-amber-500/30 text-white" 
                  : "bg-white/5 border-white/5 text-gray-500"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">Etapa 2</span>
                  <span className="text-sm">{seasonStage === "mid_season_market" ? "🟢 Aberta" : ""}</span>
                </div>
                <h4 className="text-sm font-bold mt-2">🔄 Janela Aberta</h4>
                <p className="text-[11px] text-gray-400 mt-1">Negociações, trocas e reajustes salariais liberados.</p>
              </div>

              {/* Step 3 */}
              <div className={`p-4 rounded-xl border transition-all ${
                seasonStage === "second_half" 
                  ? "bg-blue-500/10 border-blue-500/30 text-white" 
                  : "bg-white/5 border-white/5 text-gray-500"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">Etapa 3</span>
                  <span className="text-sm">{seasonStage === "second_half" ? "🟢 Ativa" : ""}</span>
                </div>
                <h4 className="text-sm font-bold mt-2">⚽ Returno</h4>
                <p className="text-[11px] text-gray-400 mt-1">Fases decisivas e finais da Liga e Copas.</p>
              </div>

              {/* Step 4 */}
              <div className={`p-4 rounded-xl border transition-all ${
                seasonStage === "season_end_wages" 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-white" 
                  : "bg-white/5 border-white/5 text-gray-500"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">Etapa 4</span>
                  <span className="text-sm">{seasonStage === "season_end_wages" ? "🟢 Pendente" : ""}</span>
                </div>
                <h4 className="text-sm font-bold mt-2">💰 Balanço Final</h4>
                <p className="text-[11px] text-gray-400 mt-1">Cobrança de salários do elenco e encerramento da temporada.</p>
              </div>
            </div>

            {/* Actions for changing stage */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-left w-full">
                <p className="text-xs font-bold text-white">Próximo Passo:</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {seasonStage === "first_half" && "Libere o mercado para os times reajustarem e negociarem no meio da temporada."}
                  {seasonStage === "mid_season_market" && "Feche as transferências e trave os orçamentos para iniciar o returno do campeonato."}
                  {seasonStage === "second_half" && "Avance para a etapa financeira após as finais do campeonato."}
                  {seasonStage === "season_end_wages" && "Defina as cobranças salariais de cada equipe abaixo para poder finalizar o campeonato."}
                </p>
              </div>

              <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
                {seasonStage === "first_half" && (
                  <button
                    onClick={() => handleAdvanceStage("mid_season_market", [
                      { key: "negotiations_enabled", value: "true" },
                      { key: "salary_window_open", value: "true" },
                      { key: "trade_enabled", value: "true" },
                      { key: "loan_enabled", value: "true" },
                      { key: "buyout_enabled", value: "true" }
                    ])}
                    className="w-full sm:w-auto rounded-xl bg-amber-500 hover:bg-amber-600 px-5 py-2.5 text-xs font-bold text-black transition-all active:scale-[0.98] flex-shrink-0 whitespace-nowrap"
                  >
                    🔓 Abrir Janela de Transferências
                  </button>
                )}
                {seasonStage === "mid_season_market" && (
                  <button
                    onClick={() => handleAdvanceStage("second_half", [
                      { key: "negotiations_enabled", value: "false" },
                      { key: "salary_window_open", value: "false" },
                      { key: "trade_enabled", value: "false" },
                      { key: "loan_enabled", value: "false" },
                      { key: "buyout_enabled", value: "false" }
                    ])}
                    className="w-full sm:w-auto rounded-xl bg-blue-500 hover:bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-all active:scale-[0.98] flex-shrink-0 whitespace-nowrap"
                  >
                    🔒 Fechar Mercado & Iniciar Returno
                  </button>
                )}
                {seasonStage === "second_half" && (
                  <button
                    onClick={() => handleAdvanceStage("season_end_wages")}
                    className="w-full sm:w-auto rounded-xl bg-emerald-500 hover:bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white transition-all active:scale-[0.98] flex-shrink-0 whitespace-nowrap"
                  >
                    💰 Processar Balanço Financeiro
                  </button>
                )}
                
                {/* Admin overrides: Allow going back manually to anywhere to maintain total freedom */}
                <select
                  value={seasonStage}
                  onChange={(e) => handleAdvanceStage(e.target.value)}
                  className="bg-[#090d16] border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none w-full sm:w-auto"
                  title="Alterar fase manualmente para qualquer etapa"
                >
                  <option value="first_half">Forçar: ⚽ Turno</option>
                  <option value="mid_season_market">Forçar: 🔄 Janela de Transf.</option>
                  <option value="second_half">Forçar: ⚽ Returno</option>
                  <option value="season_end_wages">Forçar: 💰 Balanço Salarial</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tabela de Balanço Financeiro e Salários */}
          {seasonStage === "season_end_wages" && (
            <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
                <div className="text-left">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    💵 Folha Salarial & Ajustes do Elenco
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Defina o período a cobrar ou ajuste o débito de cada time manualmente antes de confirmar o pagamento.
                  </p>
                </div>
                
                {/* Multiplicador Global */}
                <div className="flex items-center gap-2 bg-[#090d16] border border-white/10 rounded-xl px-4 py-2">
                  <span className="text-xs text-gray-400">Semanas a cobrar:</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={roundsToCharge}
                    onChange={(e) => handleRoundsToChargeChange(e.target.value)}
                    className="w-12 bg-transparent text-white text-xs font-bold text-center focus:outline-none"
                  />
                </div>
              </div>

              {teamsList.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">Carregando dados dos clubes...</p>
              ) : (
                <div className="space-y-4 text-left">
                  <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#090d16]/20">
                    <table className="w-full text-left text-sm text-gray-300 border-collapse">
                      <thead>
                        <tr className="text-[10px] font-bold uppercase text-gray-500 border-b border-white/5 bg-white/[0.01]">
                          <th className="py-3 px-4">Clube</th>
                          <th className="py-3 px-4 text-right">Folha Semanal</th>
                          <th className="py-3 px-4 text-right">Orçamento Atual</th>
                          <th className="py-3 px-4 text-center w-48">Débito Customizado (R$)</th>
                          <th className="py-3 px-4 text-right">Orçamento Estimado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {teamsList.map((team) => {
                          const weeklyWage = team.players ? team.players.reduce((sum, p) => sum + parseFloat(p.wage || 0), 0) : 0;
                          const customDebitVal = parseFloat(customDebits[team.id]) || 0;
                          const estimatedBudget = team.budget - customDebitVal;

                          return (
                            <tr key={team.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-2.5 px-4 font-bold text-white">{team.name}</td>
                              <td className="py-2.5 px-4 text-right text-xs">
                                R$ {weeklyWage.toLocaleString("pt-BR")}
                              </td>
                              <td className="py-2.5 px-4 text-right text-xs font-semibold text-gray-400">
                                R$ {parseFloat(team.budget).toLocaleString("pt-BR")}
                              </td>
                              <td className="py-2.5 px-4">
                                <input
                                  type="number"
                                  value={customDebits[team.id] || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomDebits((prev) => ({
                                      ...prev,
                                      [team.id]: val,
                                    }));
                                  }}
                                  placeholder="0.00"
                                  className="w-full bg-[#090d16] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white text-right focus:outline-none focus:border-emerald-500 font-bold"
                                />
                              </td>
                              <td className={`py-2.5 px-4 text-right text-xs font-bold ${estimatedBudget < 0 ? "text-red-400" : "text-emerald-400"}`}>
                                R$ {estimatedBudget.toLocaleString("pt-BR")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col md:flex-row justify-between items-center bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 gap-4">
                    <p className="text-[11px] text-emerald-400 max-w-lg text-left">
                      💡 <strong>Dica do ADM:</strong> Os valores acima são preenchidos por padrão multiplicando a folha semanal por {roundsToCharge} semanas. Modifique diretamente os inputs de débito caso precise debitar menos, mais ou aplicar alguma taxa customizada para um time.
                    </p>
                    <button
                      onClick={handleProcessWages}
                      disabled={processingWages}
                      className="w-full md:w-auto rounded-xl bg-emerald-500 hover:bg-emerald-600 px-6 py-3 text-xs font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 flex-shrink-0"
                    >
                      {processingWages ? "Processando..." : "💵 Executar Cobrança de Salários"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info da temporada */}
          <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#10b981]/10 border border-[#10b981]/20 flex items-center justify-center">
                  <span className="text-2xl">🏆</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{activeSeason.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {activeSeason.status === "active" ? "Em Andamento" : "Finalizada"}
                    </span>
                    {activeSeason.start_date && (
                      <span className="text-xs text-gray-400">
                        Início: {new Date(activeSeason.start_date).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {activeSeason.status === "active" && (
                <button
                  onClick={() => setShowModal(true)}
                  className="rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-5 py-2.5 text-sm font-bold text-red-400 transition-all self-start sm:self-center"
                >
                  🏁 Finalizar Temporada
                </button>
              )}
            </div>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Artilheiros */}
            <StatCard title="Artilheiros" icon="⚽">
              {topScorers.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">Sem dados de gols ainda.</p>
              ) : (
                <ol className="space-y-2">
                  {topScorers.map((p, i) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-5 text-center ${i === 0 ? "text-amber-400" : "text-gray-500"}`}>
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm text-white font-medium">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.team}</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-[#10b981]">{p.count} gol{p.count !== 1 ? "s" : ""}</span>
                    </li>
                  ))}
                </ol>
              )}
            </StatCard>

            {/* Assistências */}
            <StatCard title="Assistências" icon="🎯">
              {topAssists.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">Sem dados de assistências ainda.</p>
              ) : (
                <ol className="space-y-2">
                  {topAssists.map((p, i) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-5 text-center ${i === 0 ? "text-amber-400" : "text-gray-500"}`}>
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm text-white font-medium">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.team}</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-[#3b82f6]">{p.count} assist{p.count !== 1 ? "s" : ""}</span>
                    </li>
                  ))}
                </ol>
              )}
            </StatCard>

            {/* Melhor em Campo (MOTM) */}
            <StatCard title="Melhor em Campo (MOTM)" icon="⭐">
              {topMotm.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-4">Sem dados de melhor em campo ainda.</p>
              ) : (
                <ol className="space-y-2">
                  {topMotm.map((p, i) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-5 text-center ${i === 0 ? "text-amber-400" : "text-gray-500"}`}>
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm text-white font-medium">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.team}</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-amber-400">{p.count} vez{p.count !== 1 ? "es" : ""}</span>
                    </li>
                  ))}
                </ol>
              )}
            </StatCard>
          </div>

          {/* Classificação */}
          {standings.length > 0 && (
            <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-6 sm:p-8 space-y-4">
              <h3 className="text-base font-bold text-white border-b border-white/5 pb-3">
                🏅 Classificação (Top 10)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-white/5">
                      <th className="pb-2 pr-3">#</th>
                      <th className="pb-2 pr-3">Time</th>
                      <th className="pb-2 pr-3 text-center">Pts</th>
                      <th className="pb-2 pr-3 text-center">J</th>
                      <th className="pb-2 pr-3 text-center">V</th>
                      <th className="pb-2 pr-3 text-center">E</th>
                      <th className="pb-2 text-center">D</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {standings.map((s, i) => (
                      <tr key={s.id} className="hover:bg-white/3 transition-colors">
                        <td className="py-2.5 pr-3">
                          <span className={`text-xs font-bold ${i === 0 ? "text-amber-400" : i < 4 ? "text-[#10b981]" : "text-gray-400"}`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            {s.teams?.badge_url ? (
                              <img src={s.teams.badge_url} alt="" className="w-5 h-5 rounded object-contain" />
                            ) : (
                              <span className="text-sm">🛡️</span>
                            )}
                            <span className="text-white text-sm font-medium">{s.teams?.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-center font-bold text-white">{s.points}</td>
                        <td className="py-2.5 pr-3 text-center text-gray-400">{s.played}</td>
                        <td className="py-2.5 pr-3 text-center text-emerald-400">{s.wins}</td>
                        <td className="py-2.5 pr-3 text-center text-amber-400">{s.draws}</td>
                        <td className="py-2.5 text-center text-red-400">{s.losses}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de Confirmação */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-red-500/20 bg-[#090d16] p-6 space-y-5 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <span className="text-3xl">⚠️</span>
              </div>
              <h3 className="text-lg font-bold text-white">Finalizar Temporada</h3>
              <p className="text-sm text-gray-400">
                Esta ação é <strong className="text-red-400">irreversível</strong>. A temporada será marcada como concluída e não poderá ser reativada.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/15 text-xs text-red-300 space-y-1">
              <p>• Os resultados e estatísticas serão preservados.</p>
              <p>• Os contratos não serão automaticamente expirados.</p>
              <p>• Uma nova temporada deverá ser criada manualmente.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300">
                Digite <span className="text-red-400 font-bold">CONFIRMAR</span> para prosseguir:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="CONFIRMAR"
                className="w-full bg-[#090d16] border border-red-500/30 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowModal(false); setConfirmText(""); }}
                className="flex-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 text-xs font-semibold text-gray-300 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleFinishSeason}
                disabled={finishing || confirmText !== "CONFIRMAR"}
                className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 px-4 py-2.5 text-xs font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {finishing ? "Finalizando..." : "Finalizar Temporada"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
