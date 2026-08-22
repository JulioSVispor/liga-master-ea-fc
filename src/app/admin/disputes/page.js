"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState(null);
  
  // Para forçar placar pelo admin
  const [forceHomeScore, setForceHomeScore] = useState("");
  const [forceAwayScore, setForceAwayScore] = useState("");
  
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadDisputes();
  }, []);

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const loadDisputes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("matches")
      .select(`
        *,
        home_team:teams!home_team_id(*),
        away_team:teams!away_team_id(*),
        reporter:profiles!reported_by(display_name),
        disputer:profiles!disputed_by(display_name),
        seasons!season_id(name),
        leagues!league_id(name)
      `)
      .eq("status", "dispute")
      .order("match_date", { ascending: false });

    if (!error && data) {
      setDisputes(data);
    }
    setLoading(false);
  };

  // 1. Confirmar placar reportado originalmente
  const handleConfirmOriginal = async (match) => {
    const confirm = window.confirm("Tem certeza que deseja confirmar o placar originalmente reportado?");
    if (!confirm) return;

    const { data, error } = await supabase.rpc("resolve_match", {
      p_match_id: match.id,
      p_resolution: {
        home_score: match.home_score,
        away_score: match.away_score,
        motm_player_id: match.motm_player_id,
        reason: "Placar originalmente reportado mantido pela arbitragem",
      },
    });

    if (error || (data && !data.success)) {
      triggerAlert("error", "Erro ao confirmar partida: " + (error?.message || data?.message));
    } else {
      triggerAlert("success", "Partida confirmada com sucesso!");
      setSelectedDispute(null);
      loadDisputes();
    }
  };

  // 2. Forçar novo placar e confirmar
  const handleForceScoreAndConfirm = async (e) => {
    e.preventDefault();
    if (!selectedDispute) return;
    if (forceHomeScore === "" || forceAwayScore === "") {
      triggerAlert("error", "Preencha os placares para forçar o resultado.");
      return;
    }

    const confirm = window.confirm(`Deseja forçar o placar de ${forceHomeScore} x ${forceAwayScore} e confirmar o jogo?`);
    if (!confirm) return;

    const { data, error } = await supabase.rpc("resolve_match", {
      p_match_id: selectedDispute.id,
      p_resolution: {
        home_score: Number.parseInt(forceHomeScore, 10),
        away_score: Number.parseInt(forceAwayScore, 10),
        motm_player_id: selectedDispute.motm_player_id,
        reason: "Placar definido pela arbitragem",
      },
    });

    if (error || (data && !data.success)) {
      triggerAlert("error", "Erro ao homologar partida: " + (error?.message || data?.message));
    } else {
      triggerAlert("success", "Partida forçada e homologada com sucesso!");
      setSelectedDispute(null);
      setForceHomeScore("");
      setForceAwayScore("");
      loadDisputes();
    }
  };

  // 3. Cancelar reporte e voltar para pendente
  const handleResetMatch = async (match) => {
    const confirm = window.confirm(
      "Deseja resetar esta partida? Isso apagará os gols, assistências, cartões e o placar, voltando o status para PENDENTE."
    );
    if (!confirm) return;

    const { error: matchError } = await supabase.rpc("reopen_match", {
      p_match_id: match.id,
      p_reason: "Disputa reaberta para novo reporte",
    });

    if (matchError) {
      triggerAlert("error", "Erro ao resetar partida: " + matchError.message);
    } else {
      triggerAlert("success", "Partida resetada com sucesso! Agora os jogadores podem reportar novamente.");
      setSelectedDispute(null);
      loadDisputes();
    }
  };

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Disputas de Jogos</h1>
        <p className="text-gray-400 text-sm mt-1">Modere partidas contestadas e resolva divergências de resultados.</p>
      </div>

      {/* Alertas */}
      {alert && (
        <div
          className={`p-4 rounded-xl text-sm border flex items-center gap-3 ${
            alert.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20"
          }`}
        >
          <span>{alert.type === "success" ? "✅" : "⚠️"}</span>
          <span>{alert.message}</span>
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Lista de Disputas */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5">
              <h2 className="text-lg font-bold text-white mb-4">Jogos em Contestação ({disputes.length})</h2>
              
              <div className="space-y-3">
                {disputes.map((dispute) => (
                  <div
                    key={dispute.id}
                    onClick={() => {
                      setSelectedDispute(dispute);
                      setForceHomeScore(dispute.home_score);
                      setForceAwayScore(dispute.away_score);
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col md:flex-row justify-between gap-4 items-start md:items-center ${
                      selectedDispute?.id === dispute.id
                        ? "bg-[#10b981]/5 border-[#10b981]/30 shadow-md shadow-[#10b981]/5"
                        : "bg-[#0d1527]/40 border-white/5 hover:border-white/10 hover:bg-[#0d1527]/70"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded">
                          {dispute.seasons?.name} - {dispute.leagues?.name || "Copa/Amistoso"}
                        </span>
                        <span className="text-[10px] font-bold text-red-400 uppercase bg-red-500/10 px-2 py-0.5 rounded animate-pulse">
                          Divergência
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <span>{dispute.home_team?.name}</span>
                        <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                          {dispute.home_score} - {dispute.away_score}
                        </span>
                        <span>{dispute.away_team?.name}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Contestado por: <strong className="text-gray-300">{dispute.disputer?.display_name || "Adversário"}</strong>
                      </p>
                    </div>

                    <div className="text-xs text-gray-500 text-left md:text-right">
                      <p>Data do reporte:</p>
                      <p className="text-gray-400 font-medium">
                        {new Date(dispute.match_date).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}

                {disputes.length === 0 && (
                  <div className="text-center py-12 text-gray-500 text-sm border border-dashed border-white/5 rounded-xl">
                    Nenhuma partida em disputa no momento. Bom sinal! 🤝
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Painel de Resolução */}
          <div>
            {selectedDispute ? (
              <div className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5 space-y-6">
                <div className="border-b border-white/5 pb-4">
                  <h2 className="text-lg font-bold text-white">Resolver Divergência</h2>
                  <p className="text-xs text-gray-400 mt-1">Avalie os argumentos e prints antes de aplicar uma decisão.</p>
                </div>

                {/* Relato */}
                <div className="space-y-3 text-xs bg-[#0d1527]/60 p-4 rounded-xl border border-white/5">
                  <div>
                    <span className="text-gray-400 uppercase font-semibold text-[9px] tracking-wider block">Reportado por:</span>
                    <span className="text-white font-medium">{selectedDispute.reporter?.display_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 uppercase font-semibold text-[9px] tracking-wider block">Contestado por:</span>
                    <span className="text-white font-medium">{selectedDispute.disputer?.display_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 uppercase font-semibold text-[9px] tracking-wider block">Motivo da Contestação:</span>
                    <span className="text-red-300 italic">"{selectedDispute.dispute_reason || "Sem descrição informada"}"</span>
                  </div>
                  {selectedDispute.dispute_proof_url && (
                    <div className="pt-2">
                      <span className="text-gray-400 uppercase font-semibold text-[9px] tracking-wider block mb-1">Link de Prova (Anexo):</span>
                      <a
                        href={selectedDispute.dispute_proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#3b82f6] hover:underline flex items-center gap-1.5"
                      >
                        🖼️ Abrir print de tela final ↗
                      </a>
                    </div>
                  )}
                </div>

                {/* Opções de Ação */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider">Ações Administrativas</h3>

                  {/* 1. Confirmar Placar Reportado */}
                  <button
                    onClick={() => handleConfirmOriginal(selectedDispute)}
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-[#10b981]/15 text-[#10b981] hover:bg-[#10b981] hover:text-white border border-[#10b981]/30 transition-all text-center"
                  >
                    ✅ Confirmar Placar Reportado ({selectedDispute.home_score}x{selectedDispute.away_score})
                  </button>

                  {/* 2. Resetar Jogo */}
                  <button
                    onClick={() => handleResetMatch(selectedDispute)}
                    className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all text-center"
                  >
                    🔄 Cancelar e Permitir Novo Envio
                  </button>

                  {/* 3. Forçar outro Placar */}
                  <div className="border-t border-white/5 pt-4 space-y-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Forçar Placar Diferente</span>
                    
                    <form noValidate onSubmit={handleForceScoreAndConfirm} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1 truncate">{selectedDispute.home_team?.name}</label>
                          <input
                            type="number"
                            min="0"
                            value={forceHomeScore}
                            onChange={(e) => setForceHomeScore(e.target.value)}
                            className="w-full bg-[#0d1527] border border-white/10 rounded-lg px-3 py-2 text-center text-sm text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1 truncate">{selectedDispute.away_team?.name}</label>
                          <input
                            type="number"
                            min="0"
                            value={forceAwayScore}
                            onChange={(e) => setForceAwayScore(e.target.value)}
                            className="w-full bg-[#0d1527] border border-white/10 rounded-lg px-3 py-2 text-center text-sm text-white"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-amber-400 text-black hover:bg-amber-500 transition-all text-center"
                      >
                        ⚡ Forçar Placar e Confirmar
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5 text-center py-12 text-sm text-gray-500">
                👉 Selecione uma partida da lista para abrir o painel de mediação.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
