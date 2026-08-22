"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { generateRoundRobinFixtures } from "@/lib/domain/round-robin";
import { competitionService } from "@/services/competitionService";
import { adminService } from "@/services/adminService";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useConfirmation } from "@/hooks/useConfirmation";
import { AppImage } from "@/components/ui/AppImage";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { AdminLeagueDialogs } from "@/app/admin/leagues/_components/AdminLeagueDialogs";
import { AdminLeaguesHeader } from "@/app/admin/leagues/_components/AdminLeaguesHeader";

export function AdminLeaguesView({ model }) {
  const {
    triggerAlert,
    loadSeasons,
    loadAllTeams,
    loadLeagues,
    loadCups,
    loadCupMatches,
    loadLeagueTeams,
    loadLeagueMatches,
    handleCreateSeason,
    handleCreateLeague,
    handleAddTeamToLeague,
    handleRemoveTeamFromLeague,
    handleGenerateMatches,
    handleGenerateCup,
    handleGenerateNextCupPhase,
    handleToggleRoundRelease,
    handleMoveTeam,
    seasons,
    setSeasons,
    selectedSeason,
    setSelectedSeason,
    leagues,
    setLeagues,
    selectedLeague,
    setSelectedLeague,
    teams,
    setTeams,
    leagueTeams,
    setLeagueTeams,
    activeMatches,
    setActiveMatches,
    loading,
    setLoading,
    newSeasonName,
    setNewSeasonName,
    newLeagueName,
    setNewLeagueName,
    newLeagueDivision,
    setNewLeagueDivision,
    showSeasonModal,
    setShowSeasonModal,
    showLeagueModal,
    setShowLeagueModal,
    showTeamModal,
    setShowTeamModal,
    doubleRoundMatchGen,
    setDoubleRoundMatchGen,
    alert,
    setAlert,
    activePageTab,
    setActivePageTab,
    newCupName,
    setNewCupName,
    selectedCupTeams,
    setSelectedCupTeams,
    cupStartPhase,
    setCupStartPhase,
    showCupModal,
    setShowCupModal,
    allCups,
    setAllCups,
    selectedCup,
    setSelectedCup,
    cupMatches,
    setCupMatches,
    generatingCup,
    setGeneratingCup,
    movingTeam,
    setMovingTeam,
    targetLeagueId,
    setTargetLeagueId,
    requestConfirmation,
    confirmationProps,
  } = model;

  return (
    <div className="space-y-8">
      <ConfirmDialog {...confirmationProps} />
      <AdminLeaguesHeader
        activePageTab={activePageTab}
        alert={alert}
        onCreateCup={() => setShowCupModal(true)}
        onCreateLeague={() => setShowLeagueModal(true)}
        onCreateSeason={() => setShowSeasonModal(true)}
        onSelectTab={setActivePageTab}
      />

      {activePageTab === "leagues" && (
        <>
          {/* Barra de Seleção Rápida de Ligas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 rounded-2xl bg-[#090d16]/40 border border-white/5">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-400 tracking-wider mb-2">Temporada Ativa</label>
              <select
                value={selectedSeason?.id || ""}
                onChange={(e) => {
                  const season = seasons.find(s => s.id === e.target.value);
                  setSelectedSeason(season);
                }}
                className="w-full bg-[#0d1527] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#10b981] transition-all"
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status === "active" ? "ATIVA" : "FINALIZADA"})
                  </option>
                ))}
                {seasons.length === 0 && <option value="">Nenhuma temporada cadastrada</option>}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-400 tracking-wider mb-2">Divisão / Liga</label>
              <select
                value={selectedLeague?.id || ""}
                onChange={(e) => {
                  const league = leagues.find(l => l.id === e.target.value);
                  setSelectedLeague(league);
                }}
                className="w-full bg-[#0d1527] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#10b981] transition-all"
                disabled={leagues.length === 0}
              >
                {leagues.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} - (Série {l.division})
                  </option>
                ))}
                {leagues.length === 0 && <option value="">Nenhuma liga criada para esta temporada</option>}
              </select>
            </div>
          </div>

          {selectedLeague && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Coluna 1 e 2: Gerenciar Times e Rodadas */}
              <div className="lg:col-span-2 space-y-8">
                {/* Lista de Times Vinculados */}
                <div className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-white">Times na Liga ({leagueTeams.length})</h2>
                      <p className="text-xs text-gray-400 mt-0.5">Clubes disputando a {selectedLeague.name}.</p>
                    </div>
                    <button
                      onClick={() => setShowTeamModal(true)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"
                    >
                      ➕ Adicionar Time
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-300">
                      <thead className="text-xs font-semibold uppercase text-gray-400 border-b border-white/5">
                        <tr>
                          <th className="py-3 px-4">Time na Liga</th>
                          <th className="py-3 px-4">Clube Real (EA FC)</th>
                          <th className="py-3 px-4 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {leagueTeams.map((lt) => (
                          <tr key={lt.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2">
                              <span className="text-lg">🛡️</span> {lt.teams?.name}
                            </td>
                            <td className="py-3.5 px-4 text-gray-400">{lt.teams?.real_club_name}</td>
                            <td className="py-3.5 px-4">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => setMovingTeam(lt)}
                                  className="text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                                  title="Subir/Rebaixar para outra Liga"
                                >
                                  🔄 Mover / Acesso
                                </button>
                                <button
                                  onClick={() => handleRemoveTeamFromLeague(lt.id)}
                                  className="text-xs text-red-400 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-all"
                                >
                                  Remover
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {leagueTeams.length === 0 && (
                          <tr>
                            <td colSpan="3" className="py-8 text-center text-gray-500 text-sm">
                              Nenhum time adicionado a esta liga.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Gerador e Visualizador de Partidas */}
                <div className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5 space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-white">Jogos & Rodadas ({activeMatches.length})</h2>
                      <p className="text-xs text-gray-400 mt-0.5">Tabela de confrontos da liga.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={doubleRoundMatchGen}
                          onChange={(e) => setDoubleRoundMatchGen(e.target.checked)}
                          className="rounded border-white/10 bg-[#0d1527] text-[#10b981] focus:ring-0 cursor-pointer h-4 w-4"
                        />
                        Turno e Returno
                      </label>
                      <button
                        onClick={handleGenerateMatches}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#10b981] text-white hover:bg-emerald-600 shadow-lg shadow-[#10b981]/25 transition-all"
                      >
                        🎲 Gerar Tabela de Jogos
                      </button>
                    </div>
                  </div>

                  {/* Tabela de Jogos */}
                  <div className="max-h-[500px] overflow-y-auto space-y-4 pr-2 scrollbar-thin">
                    {Object.entries(
                      activeMatches.reduce((groups, match) => {
                        const round = match.round_number;
                        if (!groups[round]) groups[round] = [];
                        groups[round].push(match);
                        return groups;
                      }, {})
                    ).map(([round, matches]) => {
                      const isRoundReleased = matches.every(m => m.released);
                      return (
                        <div key={round} className="space-y-2">
                          <div className="flex justify-between items-center bg-[#0d1527]/80 px-3 py-2 rounded-lg border border-white/5">
                            <h3 className="text-xs font-bold text-gray-400">
                              RODADA {round}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                isRoundReleased 
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                  : "bg-red-500/10 text-red-400 border-red-500/20"
                              }`}>
                                {isRoundReleased ? "🔓 Liberada" : "🔒 Bloqueada"}
                              </span>
                              <button
                                onClick={() => handleToggleRoundRelease(round, isRoundReleased, true)}
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-all ${
                                  isRoundReleased
                                    ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30"
                                    : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                }`}
                              >
                                {isRoundReleased ? "Bloquear" : "Liberar"}
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {matches.map((m) => (
                              <div
                                key={m.id}
                                className="p-3.5 rounded-xl bg-[#0d1527]/50 border border-white/5 flex justify-between items-center gap-3"
                              >
                                <div className="flex-1 text-right truncate font-medium text-sm text-gray-200">
                                  {m.home_team?.name}
                                </div>
                                <div className="flex items-center gap-2 bg-[#060913] border border-white/10 px-3 py-1 rounded-lg text-xs font-bold min-w-[70px] justify-center text-emerald-400 shadow-inner">
                                  {m.status === "confirmed" ? (
                                    <span>
                                      {m.home_score} - {m.away_score}
                                    </span>
                                  ) : m.status === "dispute" ? (
                                    <span className="text-red-400 animate-pulse">DISPUTA</span>
                                  ) : (
                                    <span className="text-gray-400 text-[10px] uppercase">PENDENTE</span>
                                  )}
                                </div>
                                <div className="flex-1 text-left truncate font-medium text-sm text-gray-200">
                                  {m.away_team?.name}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {activeMatches.length === 0 && (
                      <div className="py-12 text-center text-gray-500 text-sm border border-dashed border-white/5 rounded-xl">
                        Nenhum jogo gerado ainda para esta liga. Clique em &quot;Gerar Tabela de Jogos&quot;.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Coluna 3: Subida/Descida Manual (Acesso) & Infos */}
              <div className="space-y-8">
                {movingTeam ? (
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 space-y-4">
                    <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                      🔄 Movimentação Manual
                    </h3>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      Defina o destino do time <strong className="text-white">{movingTeam.teams.name}</strong> para promover, rebaixar ou reposicionar de divisão.
                    </p>

                    <form noValidate onSubmit={handleMoveTeam} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1.5">Liga de Destino</label>
                        <select
                          value={targetLeagueId}
                          onChange={(e) => setTargetLeagueId(e.target.value)}
                          className="w-full bg-[#0d1527] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                          required
                        >
                          <option value="">Selecione a liga destino...</option>
                          {leagues
                            .filter(l => l.id !== selectedLeague.id)
                            .map(l => (
                              <option key={l.id} value={l.id}>
                                {l.name} - (Série {l.division})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-amber-400 text-black hover:bg-amber-500 transition-all"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setMovingTeam(null)}
                          className="py-2 px-3 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5 space-y-4 text-sm text-gray-400">
                    <h3 className="font-bold text-white text-base">Regras de Campeonatos</h3>
                    <p className="leading-relaxed text-xs">
                      Como administrador, você tem total autonomia para movimentar equipes ao final da temporada.
                    </p>
                    <div className="space-y-2 border-t border-white/5 pt-4 text-xs">
                      <div className="flex items-start gap-2">
                        <span>🏆</span>
                        <span>Os times ganham 3 pontos por vitória, 1 por empate e 0 por derrota.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span>🔁</span>
                        <span>Você pode mover times individualmente entre divisões usando o botão &quot;Mover/Acesso&quot;.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span>📅</span>
                        <span>Ao iniciar uma nova temporada, lembre-se de criar as ligas correspondentes e vincular os clubes adequados antes de gerar os novos confrontos.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activePageTab === "cups" && (
        <>
          {/* Barra de Seleção Rápida de Copas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 rounded-2xl bg-[#090d16]/40 border border-white/5">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-400 tracking-wider mb-2">Temporada Ativa</label>
              <select
                value={selectedSeason?.id || ""}
                onChange={(e) => {
                  const season = seasons.find(s => s.id === e.target.value);
                  setSelectedSeason(season);
                }}
                className="w-full bg-[#0d1527] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#10b981] transition-all"
              >
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status === "active" ? "ATIVA" : "FINALIZADA"})
                  </option>
                ))}
                {seasons.length === 0 && <option value="">Nenhuma temporada cadastrada</option>}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-gray-400 tracking-wider mb-2">Selecionar Copa Mata-Mata</label>
              <select
                value={selectedCup}
                onChange={(e) => setSelectedCup(e.target.value)}
                className="w-full bg-[#0d1527] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#10b981] transition-all"
                disabled={allCups.length === 0}
              >
                {allCups.map((cup) => (
                  <option key={cup} value={cup}>
                    {cup}
                  </option>
                ))}
                {allCups.length === 0 && <option value="">Nenhuma copa criada nesta temporada</option>}
              </select>
            </div>
          </div>

          {selectedCup ? (
            <div className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5 space-y-6">
              <div className="border-b border-white/5 pb-4">
                <h2 className="text-xl font-bold text-white">Chaves & Resultados: {selectedCup}</h2>
                <p className="text-xs text-gray-400 mt-0.5">Acompanhe as fases eliminatórias do torneio.</p>
              </div>

              {/* Bracket Visual da Copa */}
              <div className="overflow-x-auto pb-4 pt-2">
                <div className="flex flex-row justify-center items-center gap-12 min-w-[800px] py-4">
                  {/* Quartas de Final */}
                  {cupMatches.some(m => m.round_number === 1) && (() => {
                    const phaseMatches = cupMatches.filter(m => m.round_number === 1);
                    const isPhaseReleased = phaseMatches.every(m => m.released);
                    return (
                      <div className="flex flex-col justify-between gap-6 h-[520px] w-[260px]">
                        <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2 flex flex-col items-center gap-2">
                          <span>Quartas de Final</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                              isPhaseReleased 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : "bg-red-500/10 text-red-400 border-red-500/20"
                            }`}>
                              {isPhaseReleased ? "🔓 Liberada" : "🔒 Bloqueada"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleRoundRelease(1, isPhaseReleased, false)}
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-lg border transition-all ${
                                isPhaseReleased
                                  ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30"
                                  : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              }`}
                            >
                              {isPhaseReleased ? "Bloquear" : "Liberar"}
                            </button>
                          </div>
                          {phaseMatches.every(m => m.status === "confirmed") && (
                            <button
                              type="button"
                              onClick={() => handleGenerateNextCupPhase(1)}
                              className="px-3 py-1 rounded-lg text-[9px] font-bold bg-[#10b981] hover:bg-emerald-600 text-white transition-all shadow"
                            >
                              🎲 Sortear Semifinais
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col justify-between h-full py-4 gap-4">
                          {phaseMatches.map((m) => {
                            const isHomeWinner = m.status === "confirmed" && m.home_score > m.away_score;
                            const isAwayWinner = m.status === "confirmed" && m.away_score > m.home_score;
                            return (
                              <div
                                key={m.id}
                                className="p-3 rounded-xl bg-[#0b0f19] border border-white/5 hover:border-[#10b981]/30 transition-all flex flex-col gap-2 relative overflow-hidden shadow-lg shadow-black/20"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 truncate">
                                    {m.home_team?.badge_url ? (
                                      <AppImage src={m.home_team.badge_url} alt="" className="w-5 h-5 object-contain" />
                                    ) : (
                                      <span className="text-xs">🛡️</span>
                                    )}
                                    <span className={`text-xs font-semibold truncate ${m.status === "confirmed" && !isHomeWinner ? "text-gray-500" : "text-gray-200"}`}>
                                      {m.home_team?.name || "A definir"}
                                    </span>
                                  </div>
                                  {m.status === "confirmed" ? (
                                    <span className={`text-xs font-extrabold ${isHomeWinner ? "text-emerald-400" : "text-gray-500"}`}>
                                      {m.home_score}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-600 font-bold">-</span>
                                  )}
                                </div>
                                <div className="border-t border-white/5 my-0.5"></div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 truncate">
                                    {m.away_team?.badge_url ? (
                                      <AppImage src={m.away_team.badge_url} alt="" className="w-5 h-5 object-contain" />
                                    ) : (
                                      <span className="text-xs">🛡️</span>
                                    )}
                                    <span className={`text-xs font-semibold truncate ${m.status === "confirmed" && !isAwayWinner ? "text-gray-500" : "text-gray-200"}`}>
                                      {m.away_team?.name || "A definir"}
                                    </span>
                                  </div>
                                  {m.status === "confirmed" ? (
                                    <span className={`text-xs font-extrabold ${isAwayWinner ? "text-emerald-400" : "text-gray-500"}`}>
                                      {m.away_score}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-600 font-bold">-</span>
                                  )}
                                </div>
                                {m.status === "pending" && <div className="absolute top-0 right-0 h-1 w-full bg-blue-500/30"></div>}
                                {m.status === "dispute" && <div className="absolute top-0 right-0 h-1 w-full bg-red-500 animate-pulse"></div>}
                                {m.status === "confirmed" && <div className="absolute top-0 right-0 h-1 w-full bg-emerald-500/50"></div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Semifinais */}
                  {cupMatches.some(m => m.round_number === 2) && (() => {
                    const phaseMatches = cupMatches.filter(m => m.round_number === 2);
                    const isPhaseReleased = phaseMatches.every(m => m.released);
                    return (
                      <div className="flex flex-col justify-between gap-6 h-[520px] w-[260px]">
                        <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2 flex flex-col items-center gap-2">
                          <span>Semifinais</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                              isPhaseReleased 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : "bg-red-500/10 text-red-400 border-red-500/20"
                            }`}>
                              {isPhaseReleased ? "🔓 Liberada" : "🔒 Bloqueada"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleRoundRelease(2, isPhaseReleased, false)}
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-lg border transition-all ${
                                isPhaseReleased
                                  ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30"
                                  : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              }`}
                            >
                              {isPhaseReleased ? "Bloquear" : "Liberar"}
                            </button>
                          </div>
                          {phaseMatches.every(m => m.status === "confirmed") && (
                            <button
                              type="button"
                              onClick={() => handleGenerateNextCupPhase(2)}
                              className="px-3 py-1 rounded-lg text-[9px] font-bold bg-[#10b981] hover:bg-emerald-600 text-white transition-all shadow"
                            >
                              🎲 Sortear Final
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col justify-around h-full py-8 gap-8">
                          {phaseMatches.map((m) => {
                            const isHomeWinner = m.status === "confirmed" && m.home_score > m.away_score;
                            const isAwayWinner = m.status === "confirmed" && m.away_score > m.home_score;
                            return (
                              <div
                                key={m.id}
                                className="p-3 rounded-xl bg-[#0b0f19] border border-white/5 hover:border-[#10b981]/30 transition-all flex flex-col gap-2 relative overflow-hidden shadow-lg shadow-black/20"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 truncate">
                                    {m.home_team?.badge_url ? (
                                      <AppImage src={m.home_team.badge_url} alt="" className="w-5 h-5 object-contain" />
                                    ) : (
                                      <span className="text-xs">🛡️</span>
                                    )}
                                    <span className={`text-xs font-semibold truncate ${m.status === "confirmed" && !isHomeWinner ? "text-gray-500" : "text-gray-200"}`}>
                                      {m.home_team?.name || "A definir"}
                                    </span>
                                  </div>
                                  {m.status === "confirmed" ? (
                                    <span className={`text-xs font-extrabold ${isHomeWinner ? "text-emerald-400" : "text-gray-500"}`}>
                                      {m.home_score}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-600 font-bold">-</span>
                                  )}
                                </div>
                                <div className="border-t border-white/5 my-0.5"></div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 truncate">
                                    {m.away_team?.badge_url ? (
                                      <AppImage src={m.away_team.badge_url} alt="" className="w-5 h-5 object-contain" />
                                    ) : (
                                      <span className="text-xs">🛡️</span>
                                    )}
                                    <span className={`text-xs font-semibold truncate ${m.status === "confirmed" && !isAwayWinner ? "text-gray-500" : "text-gray-200"}`}>
                                      {m.away_team?.name || "A definir"}
                                    </span>
                                  </div>
                                  {m.status === "confirmed" ? (
                                    <span className={`text-xs font-extrabold ${isAwayWinner ? "text-emerald-400" : "text-gray-500"}`}>
                                      {m.away_score}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-600 font-bold">-</span>
                                  )}
                                </div>
                                {m.status === "pending" && <div className="absolute top-0 right-0 h-1 w-full bg-blue-500/30"></div>}
                                {m.status === "dispute" && <div className="absolute top-0 right-0 h-1 w-full bg-red-500 animate-pulse"></div>}
                                {m.status === "confirmed" && <div className="absolute top-0 right-0 h-1 w-full bg-emerald-500/50"></div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Grande Final */}
                  {cupMatches.some(m => m.round_number === 3) && (() => {
                    const phaseMatches = cupMatches.filter(m => m.round_number === 3);
                    const isPhaseReleased = phaseMatches.every(m => m.released);
                    return (
                      <div className="flex flex-col justify-between gap-6 h-[520px] w-[260px]">
                        <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2 flex flex-col items-center gap-2">
                          <span>Grande Final</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                              isPhaseReleased 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : "bg-red-500/10 text-red-400 border-red-500/20"
                            }`}>
                              {isPhaseReleased ? "🔓 Liberada" : "🔒 Bloqueada"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleRoundRelease(3, isPhaseReleased, false)}
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-lg border transition-all ${
                                isPhaseReleased
                                  ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30"
                                  : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                              }`}
                            >
                              {isPhaseReleased ? "Bloquear" : "Liberar"}
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col justify-center h-full">
                          {phaseMatches.map((m) => {
                            const isHomeWinner = m.status === "confirmed" && m.home_score > m.away_score;
                            const isAwayWinner = m.status === "confirmed" && m.away_score > m.home_score;
                            return (
                              <div
                                key={m.id}
                                className="p-3 rounded-xl bg-gradient-to-br from-[#1b233a] to-[#0b0f19] border border-amber-500/30 hover:border-amber-500/50 transition-all flex flex-col gap-2 relative overflow-hidden shadow-xl shadow-amber-500/5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 truncate">
                                    {m.home_team?.badge_url ? (
                                      <AppImage src={m.home_team.badge_url} alt="" className="w-5 h-5 object-contain" />
                                    ) : (
                                      <span className="text-xs">🛡️</span>
                                    )}
                                    <span className={`text-xs font-semibold truncate ${m.status === "confirmed" && !isHomeWinner ? "text-gray-500" : "text-gray-200"}`}>
                                      {m.home_team?.name || "A definir"}
                                    </span>
                                  </div>
                                  {m.status === "confirmed" ? (
                                    <span className={`text-xs font-extrabold ${isHomeWinner ? "text-amber-400" : "text-gray-500"}`}>
                                      {m.home_score}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-600 font-bold">-</span>
                                  )}
                                </div>
                                <div className="border-t border-white/5 my-0.5"></div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 truncate">
                                    {m.away_team?.badge_url ? (
                                      <AppImage src={m.away_team.badge_url} alt="" className="w-5 h-5 object-contain" />
                                    ) : (
                                      <span className="text-xs">🛡️</span>
                                    )}
                                    <span className={`text-xs font-semibold truncate ${m.status === "confirmed" && !isAwayWinner ? "text-gray-500" : "text-gray-200"}`}>
                                      {m.away_team?.name || "A definir"}
                                    </span>
                                  </div>
                                  {m.status === "confirmed" ? (
                                    <span className={`text-xs font-extrabold ${isAwayWinner ? "text-amber-400" : "text-gray-500"}`}>
                                      {m.away_score}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-600 font-bold">-</span>
                                  )}
                                </div>
                                {m.status === "pending" && <div className="absolute top-0 right-0 h-1 w-full bg-amber-500/30"></div>}
                                {m.status === "dispute" && <div className="absolute top-0 right-0 h-1 w-full bg-red-500 animate-pulse"></div>}
                                {m.status === "confirmed" && <div className="absolute top-0 right-0 h-1 w-full bg-amber-500"></div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-gray-500 text-sm border border-dashed border-white/5 rounded-2xl bg-[#090d16]/20">
              <span className="text-4xl block mb-2">🏆</span>
              <p>Nenhuma copa mata-mata ativa nesta temporada.</p>
              <p className="text-xs text-gray-400 mt-1">Clique em &quot;Criar Copa / Playoff&quot; acima para sortear os confrontos iniciais.</p>
            </div>
          )}
        </>
      )}

      <AdminLeagueDialogs
        model={{
          triggerAlert,
          loadSeasons,
          loadAllTeams,
          loadLeagues,
          loadCups,
          loadCupMatches,
          loadLeagueTeams,
          loadLeagueMatches,
          handleCreateSeason,
          handleCreateLeague,
          handleAddTeamToLeague,
          handleRemoveTeamFromLeague,
          handleGenerateMatches,
          handleGenerateCup,
          handleGenerateNextCupPhase,
          handleToggleRoundRelease,
          handleMoveTeam,
          seasons,
          setSeasons,
          selectedSeason,
          setSelectedSeason,
          leagues,
          setLeagues,
          selectedLeague,
          setSelectedLeague,
          teams,
          setTeams,
          leagueTeams,
          setLeagueTeams,
          activeMatches,
          setActiveMatches,
          loading,
          setLoading,
          newSeasonName,
          setNewSeasonName,
          newLeagueName,
          setNewLeagueName,
          newLeagueDivision,
          setNewLeagueDivision,
          showSeasonModal,
          setShowSeasonModal,
          showLeagueModal,
          setShowLeagueModal,
          showTeamModal,
          setShowTeamModal,
          doubleRoundMatchGen,
          setDoubleRoundMatchGen,
          alert,
          setAlert,
          activePageTab,
          setActivePageTab,
          newCupName,
          setNewCupName,
          selectedCupTeams,
          setSelectedCupTeams,
          cupStartPhase,
          setCupStartPhase,
          showCupModal,
          setShowCupModal,
          allCups,
          setAllCups,
          selectedCup,
          setSelectedCup,
          cupMatches,
          setCupMatches,
          generatingCup,
          setGeneratingCup,
          movingTeam,
          setMovingTeam,
          targetLeagueId,
          setTargetLeagueId,
          requestConfirmation,
          confirmationProps,
        }}
      />
    </div>
  );

}
