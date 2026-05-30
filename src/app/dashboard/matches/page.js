"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function MatchesPage() {
  const [userProfile, setUserProfile] = useState(null);
  const [myTeam, setMyTeam] = useState(null);
  const [activeTab, setActiveTab] = useState("next"); // "next", "handshake", "history"
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados do Form de Reporte
  const [reportingMatch, setReportingMatch] = useState(null);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [homeSquad, setHomeSquad] = useState([]);
  const [awaySquad, setAwaySquad] = useState([]);
  const [matchSuspensions, setMatchSuspensions] = useState([]); // IDs de jogadores suspensos neste jogo
  const [events, setEvents] = useState([]); // Array de { id, player_id, team_id, event_type, minute }
  const [motmPlayerId, setMotmPlayerId] = useState("");

  // Estados de Contestação (Disputa)
  const [disputingMatch, setDisputingMatch] = useState(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeProofUrl, setDisputeProofUrl] = useState("");

  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Perfil
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      setUserProfile(profile);

      // Meu Time
      const { data: team } = await supabase
        .from("teams")
        .select("*")
        .eq("user_id", session.user.id)
        .single();
      setMyTeam(team);

      if (team) {
        // Carregar Partidas do meu time
        const { data: matchesData } = await supabase
          .from("matches")
          .select(`
            *,
            home_team:teams!home_team_id(*),
            away_team:teams!away_team_id(*),
            seasons!season_id(name),
            leagues!league_id(name),
            motm_player:players!motm_player_id(name)
          `)
          .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
          .order("round_number", { ascending: true });

        if (matchesData) {
          setMatches(matchesData);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Carregar elencos ao abrir formulário de reporte
  const openReportForm = async (match) => {
    setReportingMatch(match);
    setHomeScore("");
    setAwayScore("");
    setEvents([]);
    setMotmPlayerId("");

    // 1. Carregar jogadores do time de casa
    const { data: homePlayers } = await supabase
      .from("players")
      .select("*")
      .eq("team_id", match.home_team_id)
      .order("rating", { ascending: false });

    // 2. Carregar jogadores do time de fora
    const { data: awayPlayers } = await supabase
      .from("players")
      .select("*")
      .eq("team_id", match.away_team_id)
      .order("rating", { ascending: false });

    // 3. Carregar suspensões para essa partida
    const { data: suspensions } = await supabase
      .from("suspensions")
      .select("player_id")
      .eq("match_id", match.id);

    setHomeSquad(homePlayers || []);
    setAwaySquad(awayPlayers || []);
    setMatchSuspensions(suspensions ? suspensions.map(s => s.player_id) : []);
  };

  const addEvent = () => {
    setEvents([
      ...events,
      {
        id: Math.random().toString(36).substr(2, 9),
        player_id: "",
        team_id: reportingMatch.home_team_id,
        event_type: "goal",
        minute: "",
      },
    ]);
  };

  const removeEvent = (id) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const updateEvent = (id, field, value) => {
    setEvents(
      events.map(e => {
        if (e.id === id) {
          const updated = { ...e, [field]: value };
          // Se mudou o jogador, definir o time correto automaticamente
          if (field === "player_id") {
            const isHome = homeSquad.some(p => p.id.toString() === value.toString());
            updated.team_id = isHome ? reportingMatch.home_team_id : reportingMatch.away_team_id;
          }
          return updated;
        }
        return e;
      })
    );
  };

  // Enviar Reporte de Partida
  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (homeScore === "" || awayScore === "") {
      triggerAlert("error", "Favor preencher os gols de ambos os times.");
      return;
    }

    try {
      // 1. Placar, reportado por e MOTM
      const { error: matchError } = await supabase
        .from("matches")
        .update({
          home_score: parseInt(homeScore),
          away_score: parseInt(awayScore),
          reported_by: userProfile.id,
          motm_player_id: motmPlayerId ? parseInt(motmPlayerId) : null,
        })
        .eq("id", reportingMatch.id);

      if (matchError) throw matchError;

      // 2. Inserir Eventos da Partida
      // Filtrar eventos válidos (que possuem jogador selecionado)
      const validEvents = events
        .filter(ev => ev.player_id !== "")
        .map(ev => ({
          match_id: reportingMatch.id,
          team_id: ev.team_id,
          player_id: parseInt(ev.player_id),
          event_type: ev.event_type,
          minute: ev.minute ? parseInt(ev.minute) : null,
        }));

      if (validEvents.length > 0) {
        const { error: eventsError } = await supabase
          .from("match_events")
          .insert(validEvents);

        if (eventsError) throw eventsError;
      }

      // Notificar o adversário
      const isHome = reportingMatch.home_team_id === myTeam.id;
      const opponentUserId = isHome ? reportingMatch.away_team?.user_id : reportingMatch.home_team?.user_id;

      if (opponentUserId) {
        await supabase.from("notifications").insert({
          user_id: opponentUserId,
          title: "Resultado de Confronto Reportado ⚽",
          content: `O time ${myTeam.name} reportou o placar da Rodada ${reportingMatch.round_number} (${homeScore} x ${awayScore}). Por favor, acesse Confrontos para validar o resultado.`
        });
      }

      triggerAlert("success", "Placar reportado! Aguardando confirmação do adversário.");
      setReportingMatch(null);
      loadData();
    } catch (err) {
      triggerAlert("error", "Erro ao reportar placar: " + err.message);
    }
  };

  // Confirmar Partida (Handshake)
  const handleConfirmMatch = async (matchId) => {
    const confirm = window.confirm("Deseja confirmar este resultado? Isso atualizará a classificação oficial da liga.");
    if (!confirm) return;

    const matchObj = matches.find(m => m.id === matchId);

    const { data, error } = await supabase.rpc("confirm_match", { p_match_id: matchId });

    if (error || (data && !data.success)) {
      triggerAlert("error", "Erro ao confirmar partida: " + (error?.message || data?.message));
    } else {
      // Notificar o outro usuário que reportou
      if (matchObj && matchObj.reported_by) {
        await supabase.from("notifications").insert({
          user_id: matchObj.reported_by,
          title: "Resultado de Confronto Confirmado ✅",
          content: `O time ${myTeam.name} confirmou o resultado do jogo da Rodada ${matchObj.round_number}. A partida foi homologada.`
        });
      }
      triggerAlert("success", "Partida homologada com sucesso!");
      loadData();
    }
  };

  // Contestar Partida (Disputa)
  const handleDisputeMatch = async (e) => {
    e.preventDefault();
    if (!disputeReason.trim()) {
      triggerAlert("error", "Por favor, explique o motivo da contestação.");
      return;
    }

    const { data, error } = await supabase.rpc("dispute_match", {
      p_match_id: disputingMatch.id,
      p_user_id: userProfile.id,
      p_reason: disputeReason,
      p_proof_url: disputeProofUrl || null,
    });

    if (error || (data && !data.success)) {
      triggerAlert("error", "Erro ao abrir disputa: " + (error?.message || data?.message));
    } else {
      // Notificar o outro usuário de que o placar foi contestado
      if (disputingMatch.reported_by) {
        await supabase.from("notifications").insert({
          user_id: disputingMatch.reported_by,
          title: "Resultado Contestado ⚠️",
          content: `O time ${myTeam.name} contestou o resultado reportado da Rodada ${disputingMatch.round_number}. O jogo foi para arbitragem.`
        });
      }
      triggerAlert("success", "Disputa registrada. O administrador irá analisar as provas.");
      setDisputingMatch(null);
      setDisputeReason("");
      setDisputeProofUrl("");
      loadData();
    }
  };

  // Filtrar partidas por tab
  const getFilteredMatches = () => {
    if (!myTeam) return [];
    if (activeTab === "next") {
      // Pendentes onde ninguém reportou ainda
      return matches.filter(m => m.status === "pending" && !m.reported_by);
    }
    if (activeTab === "handshake") {
      // Pendentes onde alguém já reportou, aguardando validação do outro
      return matches.filter(m => m.status === "pending" && m.reported_by);
    }
    // Histórico: confirmados ou em disputa
    return matches.filter(m => m.status === "confirmed" || m.status === "dispute");
  };

  const filteredMatches = getFilteredMatches();

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Meus Confrontos</h1>
        <p className="text-gray-400 text-sm mt-1">Reporte seus resultados, confirme placares e acompanhe seu histórico.</p>
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

      {/* Tabs */}
      <div className="flex border-b border-white/5 gap-2">
        <button
          onClick={() => setActiveTab("next")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
            activeTab === "next"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          ⚽ Próximos Jogos
        </button>
        <button
          onClick={() => setActiveTab("handshake")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "handshake"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          🤝 Validação (Handshake)
          {matches.filter(m => m.status === "pending" && m.reported_by && m.reported_by !== userProfile?.id).length > 0 && (
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
            activeTab === "history"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          📜 Histórico
        </button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMatches.map((match) => {
            const isHome = match.home_team_id === myTeam.id;
            const myScore = isHome ? match.home_score : match.away_score;
            const oppScore = isHome ? match.away_score : match.home_score;
            const opponentTeam = isHome ? match.away_team : match.home_team;
            const waitingMyHandshake = match.status === "pending" && match.reported_by && match.reported_by !== userProfile?.id;
            const waitingOppHandshake = match.status === "pending" && match.reported_by && match.reported_by === userProfile?.id;

            return (
              <div
                key={match.id}
                className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5 backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
              >
                {/* Info do Confronto */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 bg-white/5 px-2.5 py-0.5 rounded border border-white/5">
                      Rodada {match.round_number}
                    </span>
                    <span className="text-[10px] font-bold text-[#10b981] bg-[#10b981]/15 px-2.5 py-0.5 rounded border border-[#10b981]/20">
                      {match.seasons?.name} - {match.cup_name || match.leagues?.name || "Copa"}
                    </span>
                    {match.status === "dispute" && (
                      <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded border border-red-500/20">
                        Sob Dispute / Análise do Admin
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-white font-semibold">
                    <span className={isHome ? "text-[#10b981]" : ""}>{match.home_team?.name}</span>
                    <span className="text-gray-400 bg-white/5 px-3 py-1 rounded-lg text-sm font-bold min-w-[50px] text-center">
                      {match.home_score !== null ? `${match.home_score} - ${match.away_score}` : "vs"}
                    </span>
                    <span className={!isHome ? "text-[#10b981]" : ""}>{match.away_team?.name}</span>
                  </div>

                  {match.motm_player && (
                    <div className="text-[10px] text-gray-400 mt-2 flex items-center gap-1 font-semibold">
                      ⭐ <span className="text-amber-400">Craque do Jogo (MOTM):</span> {match.motm_player.name}
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex gap-3 flex-shrink-0 w-full md:w-auto">
                  {/* Próximos Jogos: Reportar */}
                  {activeTab === "next" && (
                    <button
                      onClick={() => openReportForm(match)}
                      className="w-full md:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-[#10b981] text-white hover:bg-emerald-600 shadow-lg shadow-[#10b981]/15 transition-all"
                    >
                      Reportar Placar
                    </button>
                  )}

                  {/* Validação: Handshake Pendente */}
                  {activeTab === "handshake" && waitingMyHandshake && (
                    <div className="flex gap-2 w-full md:w-auto">
                      <button
                        onClick={() => handleConfirmMatch(match.id)}
                        className="flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-[#10b981] text-white hover:bg-emerald-600 transition-all"
                      >
                        Confirmar Placar
                      </button>
                      <button
                        onClick={() => setDisputingMatch(match)}
                        className="flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                      >
                        Contestar
                      </button>
                    </div>
                  )}

                  {activeTab === "handshake" && waitingOppHandshake && (
                    <span className="text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-4 py-2.5 rounded-xl">
                      🕒 Aguardando validação do adversário
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {filteredMatches.length === 0 && (
            <div className="text-center py-16 text-gray-500 text-sm border border-dashed border-white/5 rounded-2xl">
              Nenhuma partida encontrada nesta aba.
            </div>
          )}
        </div>
      )}

      {/* FORM MODAL: Reportar Placar */}
      {reportingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl p-6 rounded-2xl bg-[#090d16] border border-white/10 shadow-2xl space-y-6 my-8">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Reportar Ficha Técnica do Jogo</h3>
                <p className="text-xs text-gray-400 mt-0.5">Selecione os gols, assistências e cartões da partida.</p>
              </div>
              <button onClick={() => setReportingMatch(null)} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-6">
              {/* Placar Rápido */}
              <div className="grid grid-cols-5 items-center gap-2 p-4 rounded-xl bg-[#0d1527]/50 border border-white/5">
                <div className="col-span-2 text-right font-semibold text-sm truncate text-white">
                  {reportingMatch.home_team?.name}
                </div>
                <div className="col-span-1 flex items-center gap-2 justify-center">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={homeScore}
                    onChange={(e) => setHomeScore(e.target.value)}
                    className="w-12 h-10 bg-[#060913] border border-white/10 rounded-lg text-center font-bold text-lg text-white"
                    required
                  />
                  <span className="text-gray-500 font-bold">-</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={awayScore}
                    onChange={(e) => setAwayScore(e.target.value)}
                    className="w-12 h-10 bg-[#060913] border border-white/10 rounded-lg text-center font-bold text-lg text-white"
                    required
                  />
                </div>
                <div className="col-span-2 text-left font-semibold text-sm truncate text-white">
                  {reportingMatch.away_team?.name}
                </div>
              </div>

              {/* Ficha Técnica / Eventos */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Acontecimentos do Jogo</span>
                  <button
                    type="button"
                    onClick={addEvent}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all"
                  >
                    ➕ Adicionar Gol/Cartão/Assist.
                  </button>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {events.map((ev) => (
                    <div key={ev.id} className="grid grid-cols-12 gap-2 items-center bg-[#0d1527]/30 p-2.5 rounded-xl border border-white/5">
                      {/* Seleção do Jogador */}
                      <div className="col-span-5">
                        <select
                          value={ev.player_id}
                          onChange={(e) => updateEvent(ev.id, "player_id", e.target.value)}
                          className="w-full bg-[#060913] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          required
                        >
                          <option value="">Selecione o jogador...</option>
                          <optgroup label={reportingMatch.home_team?.name}>
                            {homeSquad.map(p => {
                              const isSuspended = matchSuspensions.includes(p.id);
                              return (
                                <option key={p.id} value={p.id} disabled={isSuspended}>
                                  {p.name} {isSuspended ? "(SUSPENSO 🔴)" : `(${p.position} - Rtg: ${p.rating})`}
                                </option>
                              );
                            })}
                          </optgroup>
                          <optgroup label={reportingMatch.away_team?.name}>
                            {awaySquad.map(p => {
                              const isSuspended = matchSuspensions.includes(p.id);
                              return (
                                <option key={p.id} value={p.id} disabled={isSuspended}>
                                  {p.name} {isSuspended ? "(SUSPENSO 🔴)" : `(${p.position} - Rtg: ${p.rating})`}
                                </option>
                              );
                            })}
                          </optgroup>
                        </select>
                      </div>

                      {/* Tipo de Evento */}
                      <div className="col-span-4">
                        <select
                          value={ev.event_type}
                          onChange={(e) => updateEvent(ev.id, "event_type", e.target.value)}
                          className="w-full bg-[#060913] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="goal">⚽ Gol</option>
                          <option value="assist">👟 Assistência</option>
                          <option value="yellow_card">🟨 Cartão Amarelo</option>
                          <option value="red_card">🟥 Cartão Vermelho</option>
                        </select>
                      </div>

                      {/* Minuto */}
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="Min"
                          min="1"
                          max="120"
                          value={ev.minute}
                          onChange={(e) => updateEvent(ev.id, "minute", e.target.value)}
                          className="w-full bg-[#060913] border border-white/10 rounded-lg px-2 py-1.5 text-center text-xs text-white"
                        />
                      </div>

                      {/* Ações */}
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeEvent(ev.id)}
                          className="text-red-400 hover:text-red-500 text-sm"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}

                  {events.length === 0 && (
                    <div className="text-center py-6 text-xs text-gray-500">
                      Nenhum detalhe inserido. Opcionalmente adicione gols/cartões para computar estatísticas e artilharia.
                    </div>
                  )}
                </div>
              </div>

              {/* Votação de Melhor em Campo (MOTM) */}
              <div className="space-y-2 bg-[#0d1527]/30 p-4 rounded-xl border border-white/5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">⭐ Melhor Jogador em Campo (MOTM)</label>
                <select
                  value={motmPlayerId}
                  onChange={(e) => setMotmPlayerId(e.target.value)}
                  className="w-full bg-[#060913] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="">Selecione o craque da partida (opcional)...</option>
                  <optgroup label={reportingMatch.home_team?.name}>
                    {homeSquad.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.position} - Over {p.rating})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={reportingMatch.away_team?.name}>
                    {awaySquad.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.position} - Over {p.rating})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Botões do Form */}
              <div className="flex justify-end gap-3 border-t border-white/5 pt-4">
                <button
                  type="button"
                  onClick={() => setReportingMatch(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#10b981] text-white hover:bg-emerald-600 shadow-md shadow-[#10b981]/25"
                >
                  Confirmar Envio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG MODAL: Contestar Partida */}
      {disputingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#090d16] border border-white/10 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h3 className="text-lg font-bold text-white">Contestar Resultado de Jogo</h3>
              <button onClick={() => setDisputingMatch(null)} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>

            <form onSubmit={handleDisputeMatch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Motivo da Contestação</label>
                <textarea
                  placeholder="Explique o que está divergente (ex: 'O adversário lançou 2 gols pro jogador errado' ou 'Resultado correto foi 2x2, não 2x1')..."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full bg-[#0d1527] border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-red-500 h-24 resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Link do Print de Tela (Prova)</label>
                <input
                  type="url"
                  placeholder="URL da imagem (ex: upload no Imgur ou discord)..."
                  value={disputeProofUrl}
                  onChange={(e) => setDisputeProofUrl(e.target.value)}
                  className="w-full bg-[#0d1527] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDisputingMatch(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500 text-white hover:bg-red-600"
                >
                  Abrir Disputa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
