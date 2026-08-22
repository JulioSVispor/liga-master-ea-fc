"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useConfirmation } from "@/hooks/useConfirmation";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { AppImage } from "@/components/ui/AppImage";

export default function AdminArbitrationPage() {
  const [activeTab, setActiveTab] = useState("matches"); // "matches" | "trades"
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [trades, setTrades] = useState([]);
  const [teams, setTeams] = useState([]);
  const [filterMatch, setFilterMatch] = useState("all"); // "all" | "dispute" | "pending"
  
  // Estados para modal de arbitragem de partida
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [homeSquad, setHomeSquad] = useState([]);
  const [awaySquad, setAwaySquad] = useState([]);
  const [events, setEvents] = useState([]);
  const [motmPlayerId, setMotmPlayerId] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  // Estados para W.O.
  const [showWoModal, setShowWoModal] = useState(false);
  const [selectedMatchForWo, setSelectedMatchForWo] = useState(null);

  // Alerta inline
  const [alert, setAlert] = useState(null);
  const { requestConfirmation, confirmationProps } = useConfirmation();

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === "matches") {
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
          .in("status", ["pending", "dispute"])
          .order("match_date", { ascending: false });

        if (error) throw error;
        setMatches(data || []);
      } else {
        const { data, error } = await supabase
          .from("trade_offers")
          .select(`
            *,
            sender:teams!sender_team_id(*),
            receiver:teams!receiver_team_id(*),
            trade_players(
              direction,
              players(*)
            )
          `)
          .eq("status", "pending")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setTrades(data || []);
      }
    } catch (err) {
      console.error(err);
      triggerAlert("error", "Erro ao carregar dados: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useDeferredEffect(() => loadData(), activeTab);

  // Carregar elencos ao abrir modal de reporte
  const openMatchArbitration = async (match) => {
    setSelectedMatch(match);
    setHomeScore(match.home_score !== null ? match.home_score.toString() : "");
    setAwayScore(match.away_score !== null ? match.away_score.toString() : "");
    setMotmPlayerId(match.motm_player_id ? match.motm_player_id.toString() : "");
    setEvents([]);

    try {
      // 1. Carregar elenco mandante
      const { data: homePlayers } = await supabase
        .from("players")
        .select("*")
        .eq("team_id", match.home_team_id)
        .order("rating", { ascending: false });

      // 2. Carregar elenco visitante
      const { data: awayPlayers } = await supabase
        .from("players")
        .select("*")
        .eq("team_id", match.away_team_id)
        .order("rating", { ascending: false });

      // 3. Carregar eventos salvos se já existirem
      const { data: savedEvents } = await supabase
        .from("match_events")
        .select("*")
        .eq("match_id", match.id);

      setHomeSquad(homePlayers || []);
      setAwaySquad(awayPlayers || []);
      
      if (savedEvents && savedEvents.length > 0) {
        setEvents(savedEvents.map(ev => ({
          id: ev.id || Math.random().toString(36).substr(2, 9),
          player_id: ev.player_id.toString(),
          team_id: ev.team_id,
          event_type: ev.event_type,
          minute: ev.minute ? ev.minute.toString() : ""
        })));
      }
    } catch (err) {
      console.error(err);
      triggerAlert("error", "Erro ao carregar elencos: " + err.message);
    }
  };

  const addEvent = () => {
    if (!selectedMatch) return;
    setEvents([
      ...events,
      {
        id: Math.random().toString(36).substr(2, 9),
        player_id: "",
        team_id: selectedMatch.home_team_id,
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
          if (field === "player_id") {
            const isHome = homeSquad.some(p => p.id.toString() === value.toString());
            updated.team_id = isHome ? selectedMatch.home_team_id : selectedMatch.away_team_id;
          }
          return updated;
        }
        return e;
      })
    );
  };

  // Salvar Arbitração de Partida
  const handleConfirmMatchArbitration = async (e) => {
    e.preventDefault();
    if (!selectedMatch) return;
    if (homeScore === "" || awayScore === "") {
      triggerAlert("error", "Favor preencher os placares.");
      return;
    }

    setActionLoading(selectedMatch.id);
    try {
      const validEvents = events
        .filter(ev => ev.player_id !== "")
        .map(ev => ({
          team_id: ev.team_id,
          player_id: Number.parseInt(ev.player_id, 10),
          event_type: ev.event_type,
          minute: ev.minute ? Number.parseInt(ev.minute, 10) : null,
        }));

      const { data: rpcData, error: rpcError } = await supabase.rpc("resolve_match", {
        p_match_id: selectedMatch.id,
        p_resolution: {
          home_score: Number.parseInt(homeScore, 10),
          away_score: Number.parseInt(awayScore, 10),
          motm_player_id: motmPlayerId ? Number.parseInt(motmPlayerId, 10) : null,
          events: validEvents,
          reason: "Homologação administrativa",
        },
      });

      if (rpcError || (rpcData && !rpcData.success)) {
        throw new Error(rpcError?.message || rpcData?.message || "Falha na homologação do jogo.");
      }

      triggerAlert("success", "Partida homologada com sucesso pelo Admin!");
      setSelectedMatch(null);
      loadData();
    } catch (err) {
      console.error(err);
      triggerAlert("error", "Erro ao arbitrar partida: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Resetar partida (voltar a pendente)
  const handleResetMatch = async (match) => {
    const confirmed = await requestConfirmation({
      title: "Reabrir partida",
      message: "Placar e eventos serão removidos, e a partida voltará a aguardar um novo reporte.",
      confirmLabel: "Reabrir partida",
      intent: "danger",
    });
    if (!confirmed) return;

    setActionLoading(match.id);
    try {
      const { error } = await supabase.rpc("reopen_match", {
        p_match_id: match.id,
        p_reason: "Reabertura administrativa para novo reporte",
      });

      if (error) throw error;

      triggerAlert("success", "Partida resetada com sucesso!");
      loadData();
    } catch (err) {
      triggerAlert("error", "Erro ao resetar: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Forçar aceitação de Troca
  const handleForceAcceptTrade = async (trade) => {
    const confirmed = await requestConfirmation({
      title: "Aprovar troca pela administração",
      message: `A troca entre ${trade.sender?.name} e ${trade.receiver?.name} será processada imediatamente, com validações financeiras e de elenco.`,
      confirmLabel: "Aprovar troca",
      intent: "danger",
    });
    if (!confirmed) return;

    setActionLoading(trade.id);
    try {
      const { data, error } = await supabase.rpc("accept_trade_offer", {
        p_trade_id: trade.id
      });

      if (error || (data && !data.success)) {
        throw new Error(error?.message || data?.message || "Erro desconhecido na aprovação.");
      }

      triggerAlert("success", "Troca aprovada com sucesso!");
      loadData();
    } catch (err) {
      triggerAlert("error", "Erro ao aprovar troca: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Cancelar Troca
  const handleCancelTrade = async (trade) => {
    const confirmed = await requestConfirmation({
      title: "Cancelar proposta",
      message: "A proposta será encerrada e não poderá mais ser aceita.",
      confirmLabel: "Cancelar proposta",
      intent: "danger",
    });
    if (!confirmed) return;

    setActionLoading(trade.id);
    try {
      const { error } = await supabase.rpc("cancel_trade_offer", { p_trade_id: trade.id });

      if (error) throw error;

      triggerAlert("success", "Troca cancelada com sucesso!");
      loadData();
    } catch (err) {
      triggerAlert("error", "Erro ao cancelar troca: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Funções de W.O.
  const openWoModal = (match) => {
    setSelectedMatchForWo(match);
    setShowWoModal(true);
  };

  const handleConfirmWo = async (winnerSide) => {
    if (!selectedMatchForWo) return;
    setActionLoading(selectedMatchForWo.id);
    try {
      const { applyWalkover } = await import("@/actions/adminActions");
      await applyWalkover(selectedMatchForWo.id, winnerSide);

      triggerAlert("success", "W.O. aplicado e classificação recalculada.");
      setShowWoModal(false);
      setSelectedMatchForWo(null);
      loadData();
    } catch (err) {
      console.error(err);
      triggerAlert("error", "Erro ao aplicar W.O.: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Filtrar partidas
  const filteredMatches = matches.filter(m => {
    if (filterMatch === "all") return true;
    if (filterMatch === "dispute") return m.status === "dispute";
    if (filterMatch === "pending") return m.status === "pending";
    return true;
  });

  return (
    <div className="space-y-8">
      <ConfirmDialog {...confirmationProps} />
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Arbitragem Administrativa</h1>
        <p className="text-gray-400 text-sm mt-1">Intervenha em partidas não resolvidas, resolva contestações e controle trocas travadas.</p>
      </div>

      {/* Alerta */}
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

      {/* Abas */}
      <div className="flex border-b border-white/5 gap-2">
        <button
          onClick={() => setActiveTab("matches")}
          className={`px-5 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "matches"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          ⚽ Arbitrar Partidas
        </button>
        <button
          onClick={() => setActiveTab("trades")}
          className={`px-5 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "trades"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          🔄 Arbitrar Trocas
        </button>
      </div>

      {/* Filtros de Partida */}
      {activeTab === "matches" && (
        <div className="flex gap-2">
          {["all", "dispute", "pending"].map(f => (
            <button
              key={f}
              onClick={() => setFilterMatch(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                filterMatch === f
                  ? "bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30"
                  : "bg-white/5 text-gray-400 border-transparent hover:bg-white/10"
              }`}
            >
              {f === "all" ? "Todas" : f === "dispute" ? "⚠️ Apenas Disputas" : "🕒 Apenas Pendentes"}
            </button>
          ))}
        </div>
      )}

      {/* Conteúdo Principal */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {activeTab === "matches" ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredMatches.map(match => (
                <div
                  key={match.id}
                  className={`p-6 rounded-2xl bg-[#090d16]/40 border flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all ${
                    match.status === "dispute"
                      ? "border-red-500/30 bg-red-500/5 shadow-md shadow-red-500/5"
                      : "border-white/5"
                  }`}
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400 bg-white/5 px-2.5 py-0.5 rounded border border-white/5">
                        Rodada {match.round_number}
                      </span>
                      <span className="text-[10px] font-bold text-[#10b981] bg-[#10b981]/15 px-2.5 py-0.5 rounded border border-[#10b981]/20">
                        {match.seasons?.name} - {match.cup_name || match.leagues?.name || "Copa"}
                      </span>
                      {match.status === "dispute" && (
                        <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded border border-red-500/20 animate-pulse">
                          Divergência / Disputa Aberta
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-white font-semibold">
                      <span>{match.home_team?.name}</span>
                      <span className="text-gray-400 bg-white/5 px-3 py-1 rounded-lg text-sm font-bold min-w-[50px] text-center">
                        {match.home_score !== null ? `${match.home_score} - ${match.away_score}` : "vs"}
                      </span>
                      <span>{match.away_team?.name}</span>
                    </div>

                    {match.status === "dispute" && (
                      <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/10 px-3 py-2 rounded-lg italic">
                        Motivo da disputa: &quot;{match.dispute_reason}&quot;
                        {match.dispute_proof_url && (
                          <a
                            href={match.dispute_proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[#3b82f6] hover:underline font-semibold not-italic mt-1.5"
                          >
                            🖼️ Ver print da tela final ↗
                          </a>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-shrink-0 w-full md:w-auto">
                    <button
                      onClick={() => openMatchArbitration(match)}
                      disabled={actionLoading !== null}
                      className="flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-[#10b981] text-white hover:bg-emerald-600 shadow-lg shadow-[#10b981]/10 transition-all"
                    >
                      ⚡ Arbitrar Placar
                    </button>
                    <button
                      onClick={() => openWoModal(match)}
                      disabled={actionLoading !== null}
                      className="flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500 hover:text-black transition-all"
                    >
                      🏳️ Dar W.O.
                    </button>
                    {match.reported_by && (
                      <button
                        onClick={() => handleResetMatch(match)}
                        disabled={actionLoading !== null}
                        className="flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                      >
                        🔄 Resetar Jogo
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {filteredMatches.length === 0 && (
                <div className="text-center py-16 text-gray-500 text-sm border border-dashed border-white/5 rounded-2xl">
                  Nenhuma partida pendente ou em disputa no momento.
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {trades.map(trade => {
                const sendPlayers = trade.trade_players?.filter(p => p.direction === "send") || [];
                const receivePlayers = trade.trade_players?.filter(p => p.direction === "receive") || [];

                return (
                  <div key={trade.id} className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5 flex flex-col justify-between gap-6">
                    <div>
                      {/* Título da Proposta */}
                      <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-4">
                        <div>
                          <p className="text-xs text-gray-400">Proponente</p>
                          <p className="text-sm font-bold text-white">{trade.sender?.name}</p>
                        </div>
                        <span className="text-lg">➡️</span>
                        <div className="text-right">
                          <p className="text-xs text-gray-400 font-medium">Destinatário</p>
                          <p className="text-sm font-bold text-white">{trade.receiver?.name}</p>
                        </div>
                      </div>

                      {/* Conteúdo da Proposta */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Envia */}
                        <div className="space-y-2 border-r border-white/5 pr-2">
                          <p className="text-[10px] font-bold text-[#10b981] uppercase tracking-wider">Oferece:</p>
                          {sendPlayers.map(p => (
                            <div key={p.players?.id} className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white/5 border border-white/5">
                              {p.players?.face_url ? (
                                <AppImage src={p.players.face_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                              ) : (
                                <span className="text-xs">👤</span>
                              )}
                              <div className="truncate">
                                <p className="text-xs font-semibold text-white truncate">{p.players?.name}</p>
                                <p className="text-[9px] text-gray-400">{p.players?.position} | Over {p.players?.rating}</p>
                              </div>
                            </div>
                          ))}
                          {parseFloat(trade.offered_money) > 0 && (
                            <p className="text-xs text-emerald-400 font-bold mt-1">
                              + R$ {parseFloat(trade.offered_money).toLocaleString("pt-BR")}
                            </p>
                          )}
                          {sendPlayers.length === 0 && parseFloat(trade.offered_money) === 0 && (
                            <p className="text-xs text-gray-500 italic">Nenhum jogador/valor</p>
                          )}
                        </div>

                        {/* Recebe */}
                        <div className="space-y-2 pl-2">
                          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Pede em Troca:</p>
                          {receivePlayers.map(p => (
                            <div key={p.players?.id} className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white/5 border border-white/5">
                              {p.players?.face_url ? (
                                <AppImage src={p.players.face_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                              ) : (
                                <span className="text-xs">👤</span>
                              )}
                              <div className="truncate">
                                <p className="text-xs font-semibold text-white truncate">{p.players?.name}</p>
                                <p className="text-[9px] text-gray-400">{p.players?.position} | Over {p.players?.rating}</p>
                              </div>
                            </div>
                          ))}
                          {parseFloat(trade.requested_money) > 0 && (
                            <p className="text-xs text-blue-400 font-bold mt-1">
                              + R$ {parseFloat(trade.requested_money).toLocaleString("pt-BR")}
                            </p>
                          )}
                          {receivePlayers.length === 0 && parseFloat(trade.requested_money) === 0 && (
                            <p className="text-xs text-gray-500 italic">Nenhum jogador/valor</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2 border-t border-white/5 pt-4">
                      <button
                        onClick={() => handleForceAcceptTrade(trade)}
                        disabled={actionLoading !== null}
                        className="flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all text-center"
                      >
                        ✅ Forçar Aprovação
                      </button>
                      <button
                        onClick={() => handleCancelTrade(trade)}
                        disabled={actionLoading !== null}
                        className="flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all text-center"
                      >
                        ❌ Cancelar Troca
                      </button>
                    </div>
                  </div>
                );
              })}

              {trades.length === 0 && (
                <div className="col-span-2 text-center py-16 text-gray-500 text-sm border border-dashed border-white/5 rounded-2xl">
                  Nenhuma proposta de troca pendente na liga.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Arbitragem de Jogo */}
      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 overflow-y-auto">
          <div className="w-full max-w-2xl p-6 rounded-2xl bg-[#090d16] border border-white/10 shadow-2xl space-y-6 my-8">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Arbitragem Oficial da Partida</h3>
                <p className="text-xs text-gray-400 mt-0.5">Preencha o placar e os eventos do jogo para homologação imediata.</p>
              </div>
              <button
                onClick={() => setSelectedMatch(null)}
                className="text-gray-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <form noValidate onSubmit={handleConfirmMatchArbitration} className="space-y-6">
              {/* Placar */}
              <div className="grid grid-cols-5 items-center gap-2 p-4 rounded-xl bg-[#0d1527]/50 border border-white/5">
                <div className="col-span-2 text-right font-semibold text-sm truncate text-white">
                  {selectedMatch.home_team?.name}
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
                  {selectedMatch.away_team?.name}
                </div>
              </div>

              {/* Ficha Técnica / Eventos */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Ficha do Jogo (Gols, Assistências, Cartões)</span>
                  <button
                    type="button"
                    onClick={addEvent}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all"
                  >
                    ➕ Adicionar Acontecimento
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
                          <optgroup label={selectedMatch.home_team?.name}>
                            {homeSquad.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.position} - Over {p.rating})
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label={selectedMatch.away_team?.name}>
                            {awaySquad.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.position} - Over {p.rating})
                              </option>
                            ))}
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

                      {/* Deletar */}
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
                      Nenhum acontecimento inserido ainda.
                    </div>
                  )}
                </div>
              </div>

              {/* Craque do Jogo */}
              <div className="space-y-2 bg-[#0d1527]/30 p-4 rounded-xl border border-white/5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">⭐ Craque do Jogo (MOTM)</label>
                <select
                  value={motmPlayerId}
                  onChange={(e) => setMotmPlayerId(e.target.value)}
                  className="w-full bg-[#060913] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="">Selecione o craque da partida (opcional)...</option>
                  <optgroup label={selectedMatch.home_team?.name}>
                    {homeSquad.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.position} - Over {p.rating})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={selectedMatch.away_team?.name}>
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
                  onClick={() => setSelectedMatch(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading !== null}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#10b981] text-white hover:bg-emerald-600 shadow-md shadow-[#10b981]/25 disabled:opacity-50"
                >
                  {actionLoading ? "Homologando..." : "Confirmar e Homologar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Aplicar W.O. */}
      {showWoModal && selectedMatchForWo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 overflow-y-auto">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#090d16] border border-white/10 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h3 className="text-lg font-bold text-white">Decretar W.O.</h3>
              <button onClick={() => { setShowWoModal(false); setSelectedMatchForWo(null); }} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>
            
            <div className="space-y-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                Escolha qual time sairá vencedor pelo placar padrão de W.O. (3x0 ou 0x3). Esta ação irá atualizar a tabela de classificação e marcar a partida como homologada.
              </p>

              <div className="p-4 rounded-xl bg-[#0d1527]/50 border border-white/5 space-y-3">
                <div className="flex justify-between text-xs text-gray-400 font-semibold border-b border-white/5 pb-1">
                  <span>Mandante</span>
                  <span>Visitante</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white">
                  <span>{selectedMatchForWo.home_team?.name}</span>
                  <span>{selectedMatchForWo.away_team?.name}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleConfirmWo("home")}
                  disabled={actionLoading !== null}
                  className="py-3 px-4 rounded-xl text-xs font-bold bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 hover:bg-[#10b981] hover:text-white transition-all text-center flex flex-col items-center justify-center gap-1"
                >
                  <span className="text-lg">🏠 Vitória da Casa</span>
                  <span className="font-extrabold text-sm">3 x 0</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmWo("away")}
                  disabled={actionLoading !== null}
                  className="py-3 px-4 rounded-xl text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500 hover:text-white transition-all text-center flex flex-col items-center justify-center gap-1"
                >
                  <span className="text-lg">🚀 Vitória de Fora</span>
                  <span className="font-extrabold text-sm">0 x 3</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => { setShowWoModal(false); setSelectedMatchForWo(null); }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
