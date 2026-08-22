"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AppImage } from "@/components/ui/AppImage";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { TeamRosterModal } from "@/components/features/TeamRosterModal";

// ─── Tooltip ℹ️ ─────────────────────────────────
function Tooltip({ content }) {
  const [visible, setVisible] = useState(false);
  return (
    <span 
      className="relative inline-block ml-1 cursor-pointer group text-gray-500 hover:text-white select-none z-10"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      ℹ️
      {visible && (
        <span className="absolute z-[100] w-64 p-3 text-[10px] font-normal text-gray-200 bg-[#0c101d] border border-white/10 rounded-xl shadow-2xl top-6 left-1/2 -translate-x-1/2 leading-relaxed transition-opacity animate-fadeIn normal-case whitespace-normal">
          {content}
        </span>
      )}
    </span>
  );
}

export function MatchesView({ model }) {
  const {
    showToast,
    loadH2hMatches,
    calculateH2hStats,
    handleViewTeamRoster,
    getViewingFormationSlots,
    triggerAlert,
    loadData,
    openReportForm,
    addEvent,
    removeEvent,
    updateEvent,
    handleSubmitReport,
    handleConfirmMatch,
    handleDisputeMatch,
    getFilteredMatches,
    filteredMatches,
    userProfile,
    setUserProfile,
    myTeam,
    setMyTeam,
    activeTab,
    setActiveTab,
    matches,
    setMatches,
    loading,
    setLoading,
    toast,
    setToast,
    confirmModal,
    setConfirmModal,
    reportingMatch,
    setReportingMatch,
    homeScore,
    setHomeScore,
    awayScore,
    setAwayScore,
    homeSquad,
    setHomeSquad,
    awaySquad,
    setAwaySquad,
    matchSuspensions,
    setMatchSuspensions,
    events,
    setEvents,
    motmPlayerId,
    setMotmPlayerId,
    disputingMatch,
    setDisputingMatch,
    disputeReason,
    setDisputeReason,
    disputeProofUrl,
    setDisputeProofUrl,
    alert,
    setAlert,
    viewingTeam,
    setViewingTeam,
    viewingPlayers,
    setViewingPlayers,
    viewingCoach,
    setViewingCoach,
    viewingLoading,
    setViewingLoading,
    allTeams,
    setAllTeams,
    selectedOpponentId,
    setSelectedOpponentId,
    h2hMatches,
    setH2hMatches,
    h2hLoading,
    setH2hLoading,
  } = model;

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Meus Confrontos</h1>
        <p className="text-gray-400 text-sm mt-1">Reporte seus resultados, confirme placares e acompanhe seu histórico.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 gap-2">
        <button
          onClick={() => setActiveTab("next")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "next"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          <span>⚽ Próximos Jogos</span>
          <Tooltip content="Partidas agendadas que ainda precisam ter o placar reportado por um dos treinadores." />
        </button>
        <button
          onClick={() => setActiveTab("handshake")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "handshake"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          <span>🤝 Validação (Handshake)</span>
          {matches.filter(m => m.status === "pending" && m.reported_by && m.reported_by !== userProfile?.id).length > 0 && (
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping"></span>
          )}
          <Tooltip content="Partidas já reportadas aguardando confirmação ou contestação do adversário." />
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "history"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          <span>📜 Histórico</span>
          <Tooltip content="Partidas homologadas e em disputa (sob arbitragem)." />
        </button>
        <button
          onClick={() => {
            setActiveTab("classicos");
            setSelectedOpponentId("");
            setH2hMatches([]);
          }}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "classicos"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          <span>⚔️ Retrospecto</span>
          <Tooltip content="Estatísticas H2H e histórico detalhado contra outros clubes." />
        </button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
        </div>
      ) : activeTab === "classicos" ? (
        <div className="space-y-6 animate-fadeIn">
          {/* Seletor de adversário */}
          <div className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Selecionar Adversário</h3>
            <select
              value={selectedOpponentId}
              onChange={(e) => {
                const oppId = e.target.value;
                setSelectedOpponentId(oppId);
                loadH2hMatches(oppId);
              }}
              className="w-full md:w-72 bg-[#060913] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#10b981]"
            >
              <option value="">Selecione um clube...</option>
              {allTeams
                .filter((t) => t.id !== myTeam?.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>

          {h2hLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
            </div>
          ) : selectedOpponentId ? (
            h2hMatches.length > 0 ? (
              <div className="space-y-6">
                {/* Painel de Estatísticas KPIs */}
                {(() => {
                  const stats = calculateH2hStats();
                  const opponentName = allTeams.find(t => t.id === selectedOpponentId)?.name || "Adversário";
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                        <div className="text-2xl font-bold text-emerald-400">{stats.myWins}</div>
                        <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mt-1">Minhas Vitórias</div>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                        <div className="text-2xl font-bold text-gray-300">{stats.draws}</div>
                        <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mt-1">Empates</div>
                      </div>
                      <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-center">
                        <div className="text-2xl font-bold text-red-400">{stats.oppWins}</div>
                        <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mt-1">Vitórias do {opponentName}</div>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                        <div className="text-2xl font-bold text-blue-400">{stats.myGols}</div>
                        <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mt-1">Meus Gols</div>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
                        <div className="text-2xl font-bold text-amber-400">{stats.oppGols}</div>
                        <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mt-1">Gols do {opponentName}</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Lista de Partidas H2H */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Histórico de Jogos</h4>
                  <div className="space-y-3">
                    {h2hMatches.map((match) => {
                      const isHome = match.home_team_id === myTeam?.id;
                      return (
                        <div
                          key={match.id}
                          className="p-5 rounded-2xl bg-[#090d16]/40 border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-gray-400 bg-white/5 px-2.5 py-0.5 rounded">
                                Rodada {match.round_number}
                              </span>
                              <span className="text-[9px] font-bold text-[#10b981] bg-[#10b981]/15 px-2.5 py-0.5 rounded">
                                {match.seasons?.name} - {match.cup_name || "Liga"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm font-semibold text-white mt-1">
                              <button
                                onClick={() => handleViewTeamRoster(match.home_team)}
                                className={`hover:text-[#10b981] transition-all text-left flex items-center gap-1.5 focus:outline-none ${match.home_team_id === myTeam?.id ? "text-[#10b981]" : ""}`}
                                title="Ver elenco e tática"
                              >
                                {match.home_team?.badge_url && (
                                  <AppImage src={match.home_team.badge_url} alt="" className="w-4 h-4 object-contain inline-block" />
                                )}
                                <span>{match.home_team?.name}</span>
                              </button>
                              <span className="bg-white/5 px-2 py-0.5 rounded text-xs font-bold">
                                {match.home_score} - {match.away_score}
                              </span>
                              <button
                                onClick={() => handleViewTeamRoster(match.away_team)}
                                className={`hover:text-[#10b981] transition-all text-left flex items-center gap-1.5 focus:outline-none ${match.away_team_id === myTeam?.id ? "text-[#10b981]" : ""}`}
                                title="Ver elenco e tática"
                              >
                                {match.away_team?.badge_url && (
                                  <AppImage src={match.away_team.badge_url} alt="" className="w-4 h-4 object-contain inline-block" />
                                )}
                                <span>{match.away_team?.name}</span>
                              </button>
                            </div>
                          </div>
                          {match.motm_player_id && (
                            <div className="text-[10px] text-gray-400">
                              ⭐ MOTM: {match.motm_player_id === match.home_team?.motm_player_id ? match.home_team?.name : match.away_team?.name}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-gray-500 text-sm border border-dashed border-white/5 rounded-2xl">
                Nenhum confronto direto registrado e confirmado entre vocês ainda.
              </div>
            )
          ) : (
            <div className="text-center py-16 text-gray-500 text-sm border border-dashed border-white/5 rounded-2xl">
              Selecione um adversário para ver o retrospecto.
            </div>
          )}
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
            const isMatchLocked = match.released === false && match.status !== "confirmed";

            return (
              <div
                key={match.id}
                className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
              >
                {/* Info do Confronto */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-gray-400 bg-white/5 px-2.5 py-0.5 rounded border border-white/5">
                      Rodada {match.round_number}
                    </span>
                    <span className="text-[10px] font-bold text-[#10b981] bg-[#10b981]/15 px-2.5 py-0.5 rounded border border-[#10b981]/20">
                      {match.seasons?.name} - {match.cup_name || match.leagues?.name || "Copa"}
                    </span>
                    {isMatchLocked && (
                      <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded border border-red-500/20">
                        🔒 Bloqueada pelo Admin
                      </span>
                    )}
                    {match.status === "dispute" && (
                      <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded border border-red-500/20">
                        Sob Dispute / Análise do Admin
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-white font-semibold">
                    <button
                      onClick={() => handleViewTeamRoster(match.home_team)}
                      className={`hover:text-[#10b981] transition-all text-left flex items-center gap-1.5 focus:outline-none ${isHome ? "text-[#10b981]" : ""}`}
                      title="Ver elenco e tática"
                    >
                      {match.home_team?.badge_url && (
                        <AppImage src={match.home_team.badge_url} alt="" className="w-4 h-4 object-contain inline-block" />
                      )}
                      <span>{match.home_team?.name}</span>
                    </button>
                    <span className="text-gray-400 bg-white/5 px-3 py-1 rounded-lg text-sm font-bold min-w-[50px] text-center">
                      {match.home_score !== null ? `${match.home_score} - ${match.away_score}` : "vs"}
                    </span>
                    <button
                      onClick={() => handleViewTeamRoster(match.away_team)}
                      className={`hover:text-[#10b981] transition-all text-left flex items-center gap-1.5 focus:outline-none ${!isHome ? "text-[#10b981]" : ""}`}
                      title="Ver elenco e tática"
                    >
                      {match.away_team?.badge_url && (
                        <AppImage src={match.away_team.badge_url} alt="" className="w-4 h-4 object-contain inline-block" />
                      )}
                      <span>{match.away_team?.name}</span>
                    </button>
                  </div>

                  {match.motm_player && (
                    <div className="text-[10px] text-gray-400 mt-2 flex items-center gap-1 font-semibold">
                      ⭐ <span className="text-amber-400">Craque do Jogo (MOTM):</span> {match.motm_player.name}
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex gap-3 flex-shrink-0 w-full md:w-auto">
                  {isMatchLocked ? (
                    <span className="text-xs font-semibold text-gray-400 bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 flex items-center gap-1.5">
                      🔒 Rodada Bloqueada
                    </span>
                  ) : (
                    <>
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
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-4 py-2.5 rounded-xl">
                            🕒 Aguardando validação do adversário
                          </span>
                          <button
                            onClick={() => openReportForm(match)}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 hover:bg-[#3b82f6]/20 transition-all active:scale-[0.98] flex items-center gap-1.5"
                          >
                            📝 Editar Reporte
                          </button>
                        </div>
                      )}
                    </>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 overflow-y-auto">
          <div className="w-full max-w-2xl p-6 rounded-2xl bg-[#090d16] border border-white/10 shadow-2xl space-y-6 my-8">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Reportar Ficha Técnica do Jogo</h3>
                <p className="text-xs text-gray-400 mt-0.5">Selecione os gols, assistências e cartões da partida.</p>
              </div>
              <button onClick={() => setReportingMatch(null)} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>

            <form noValidate onSubmit={handleSubmitReport} className="space-y-6">
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
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center">
                    <span>Acontecimentos do Jogo</span>
                    <Tooltip content="Gols, assistências e cartões da partida. Os dados inseridos alimentam os rankings individuais da liga e controlam suspensões automáticas." />
                  </span>
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
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center">
                  <span>⭐ Melhor Jogador em Campo (MOTM)</span>
                  <Tooltip content="Voto no destaque da partida para o ranking acumulativo de Craque do Campeonato (Man of the Match)." />
                </label>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#090d16] border border-white/10 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h3 className="text-lg font-bold text-white">Contestar Resultado de Jogo</h3>
              <button onClick={() => setDisputingMatch(null)} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>

            <form noValidate onSubmit={handleDisputeMatch} className="space-y-4">
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
      <TeamRosterModal
        team={viewingTeam}
        players={viewingPlayers}
        coach={viewingCoach}
        loading={viewingLoading}
        getFormationSlots={getViewingFormationSlots}
        onClose={() => {
          setViewingTeam(null);
          setViewingPlayers([]);
          setViewingCoach(null);
        }}
      />

      {/* Toast flutuante */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-[9999] max-w-sm rounded-xl border bg-[#090d16]/90 p-4 shadow-2xl animate-slideIn flex gap-3 items-start border-l-4 ${
          toast.type === "success" ? "border-l-[#10b981] border-emerald-500/20" :
          toast.type === "error" ? "border-l-red-500 border-red-500/20" :
          "border-l-blue-500 border-blue-500/20"
        }`}>
          <div className="text-base flex-shrink-0 pt-0.5">
            {toast.type === "success" ? "✅" : toast.type === "error" ? "❌" : "ℹ️"}
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-xs font-bold text-white leading-tight">
              {toast.type === "success" ? "Sucesso" : toast.type === "error" ? "Erro" : "Informação"}
            </p>
            <p className="text-[10.5px] text-gray-400 leading-relaxed whitespace-pre-line">{toast.message}</p>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-gray-500 hover:text-gray-300 text-xs font-bold px-1 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* ConfirmModal customizado */}
      {confirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4 animate-fadeIn">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 bg-[#090d16]/95 shadow-2xl relative text-left">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <span>❓</span> {confirmModal.title}
            </h3>
            <p className="text-xs text-gray-300 mb-6 whitespace-pre-line leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="w-2/3 rounded-xl bg-gradient-to-r from-[#10b981] to-[#3b82f6] hover:from-[#059669] hover:to-blue-600 py-3 text-xs font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.onCancel) confirmModal.onCancel();
                  setConfirmModal(null);
                }}
                className="w-1/3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-3 text-xs font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
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

