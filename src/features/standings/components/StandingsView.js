"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { AppImage } from "@/components/ui/AppImage";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { TeamRosterModal } from "@/components/features/TeamRosterModal";

// ─── Tooltip ℹ️ ─────────────────────────────────
function Tooltip({ content }) {
  const [visible, setVisible] = useState(false);
  return (
    <span 
      className="relative inline-block ml-1 cursor-pointer group text-gray-500 hover:text-white select-none z-10 font-normal"
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

// Helper to handle both object or array relation response
const getTeamData = (teamField) => {
  if (!teamField) return null;
  if (Array.isArray(teamField)) return teamField[0];
  return teamField;
};

export function StandingsView({ model }) {
  const {
    loadSeasons,
    loadLeagues,
    loadCups,
    loadCupMatches,
    loadLeagueData,
    handleViewTeamRoster,
    getViewingFormationSlots,
    renderBracketMatch,
    seasons,
    setSeasons,
    selectedSeason,
    setSelectedSeason,
    leagues,
    setLeagues,
    selectedLeague,
    setSelectedLeague,
    activeTab,
    setActiveTab,
    standings,
    setStandings,
    topScorers,
    setTopScorers,
    topAssists,
    setTopAssists,
    topMotm,
    setTopMotm,
    suspensions,
    setSuspensions,
    loading,
    setLoading,
    allCups,
    setAllCups,
    selectedCup,
    setSelectedCup,
    cupMatches,
    setCupMatches,
    viewingTeam,
    setViewingTeam,
    viewingPlayers,
    setViewingPlayers,
    viewingCoach,
    setViewingCoach,
    viewingLoading,
    setViewingLoading,
  } = model;

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Classificação & Estatísticas</h1>
          <p className="text-gray-400 text-sm mt-1">Acompanhe a tabela geral, líderes de gols, assistências e suspensões.</p>
        </div>

        {/* Seletores Rápidos de Temporada e Divisão */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <select
            value={selectedSeason?.id || ""}
            onChange={(e) => {
              const season = seasons.find(s => s.id === e.target.value);
              setSelectedSeason(season);
            }}
            className="bg-[#0d1527] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#10b981]"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={selectedLeague?.id || ""}
            onChange={(e) => {
              const league = leagues.find(l => l.id === e.target.value);
              setSelectedLeague(league);
            }}
            className="bg-[#0d1527] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#10b981]"
            disabled={leagues.length === 0}
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
            {leagues.length === 0 && <option value="">Nenhuma liga</option>}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 gap-2 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab("table")}
          className={`px-4 py-3 text-[11px] uppercase font-bold tracking-wider border-b-2 transition-all whitespace-nowrap ${
            activeTab === "table"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Tabela
        </button>
        <button
          onClick={() => setActiveTab("scorers")}
          className={`px-4 py-3 text-[11px] uppercase font-bold tracking-wider border-b-2 transition-all whitespace-nowrap ${
            activeTab === "scorers"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Artilharia
        </button>
        <button
          onClick={() => setActiveTab("assists")}
          className={`px-4 py-3 text-[11px] uppercase font-bold tracking-wider border-b-2 transition-all whitespace-nowrap ${
            activeTab === "assists"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Assistências
        </button>
        <button
          onClick={() => setActiveTab("motm")}
          className={`px-4 py-3 text-[11px] uppercase font-bold tracking-wider border-b-2 transition-all whitespace-nowrap ${
            activeTab === "motm"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Melhor em Campo
        </button>
        <button
          onClick={() => setActiveTab("suspensions")}
          className={`px-4 py-3 text-[11px] uppercase font-bold tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "suspensions"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Suspensões
          {suspensions.length > 0 && (
            <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
              {suspensions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("cups")}
          className={`px-4 py-3 text-[11px] uppercase font-bold tracking-wider border-b-2 transition-all whitespace-nowrap ${
            activeTab === "cups"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Copas Mata-Mata
        </button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5">
          {/* TAB 1: Tabela de Classificação */}
          {activeTab === "table" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-[10px] font-bold uppercase text-gray-400 border-b border-white/5 bg-white/[0.01]">
                  <tr>
                    <th className="py-3 px-2 text-center w-12">Pos</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-3 text-center text-emerald-400 text-[11px]">Pontos</th>
                    <th className="py-3 px-3 text-center">Jogos</th>
                    <th className="py-3 px-3 text-center">Vitórias</th>
                    <th className="py-3 px-3 text-center">Empates</th>
                    <th className="py-3 px-3 text-center">Derrotas</th>
                    <th className="py-3 px-3 text-center">Gols Marcados</th>
                    <th className="py-3 px-3 text-center">Gols Sofridos</th>
                    <th className="py-3 px-3 text-center">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                  {standings.map((lt, index) => {
                    const isZoneA = index < 2; // Zonas de promoção simbólicas
                    const isZoneB = index >= standings.length - 2 && standings.length > 4; // Rebaixamento
                    return (
                      <tr key={lt.id} className="hover:bg-white/5 transition-colors group relative">
                        <td className="py-2.5 px-2 text-center font-bold text-gray-400">
                          {/* Accent line on the left side of the row */}
                          <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                            isZoneA ? "bg-blue-500/70" : isZoneB ? "bg-red-500/70" : "bg-transparent"
                          }`} />
                          <span className={isZoneA ? "text-blue-400" : isZoneB ? "text-red-400" : ""}>{index + 1}</span>
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-white">
                          <button
                            onClick={() => handleViewTeamRoster(lt.teams)}
                            className="flex items-center gap-5 text-left hover:text-[#10b981] transition-all focus:outline-none"
                            title="Clique para ver o elenco e tática deste time"
                          >
                            <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {lt.teams?.badge_url ? (
                                <AppImage src={lt.teams.badge_url} alt="" className="h-full w-full object-contain" />
                              ) : (
                                <span className="text-[14px]">🛡️</span>
                              )}
                            </div>
                            <span className="font-bold text-base border-b border-dashed border-transparent hover:border-[#10b981] transition-all">
                              {lt.teams?.name}
                            </span>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-emerald-400 text-[13px]">{lt.points}</td>
                        <td className="py-2.5 px-3 text-center font-medium text-gray-300">{lt.played}</td>
                        <td className="py-2.5 px-3 text-center text-gray-500">{lt.won}</td>
                        <td className="py-2.5 px-3 text-center text-gray-500">{lt.drawn}</td>
                        <td className="py-2.5 px-3 text-center text-gray-500">{lt.lost}</td>
                        <td className="py-2.5 px-3 text-center text-gray-500">{lt.goals_for}</td>
                        <td className="py-2.5 px-3 text-center text-gray-500">{lt.goals_against}</td>
                        <td className={`py-2.5 px-3 text-center font-bold ${lt.goals_difference > 0 ? "text-emerald-500" : lt.goals_difference < 0 ? "text-red-500" : "text-gray-500"}`}>
                          {lt.goals_difference > 0 ? `+${lt.goals_difference}` : lt.goals_difference}
                        </td>
                      </tr>
                    );
                  })}
                  {standings.length === 0 && (
                    <tr>
                      <td colSpan="10" className="py-12 text-center text-gray-500 text-xs">
                        Nenhum time cadastrado nesta liga ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: Artilharia */}
          {activeTab === "scorers" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-[10px] font-bold uppercase text-gray-400 border-b border-white/5 bg-white/[0.01]">
                  <tr>
                    <th className="py-3 px-2 text-center w-12">Pos</th>
                    <th className="py-3 px-4">Jogador</th>
                    <th className="py-3 px-4">Clube</th>
                    <th className="py-3 px-4 text-center">Gols</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                  {topScorers.map((item, index) => (
                    <tr key={index} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-2 text-center font-bold text-gray-400">{index + 1}</td>
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {item.player?.face_url ? (
                              <AppImage src={item.player.face_url} alt="" className="h-full w-full object-cover scale-110" />
                            ) : (
                              <span className="text-xs">👤</span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{item.player?.name}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                              {item.player?.position} - Rating: <span className={getRatingColor(item.player?.rating)}>{item.player?.rating}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        {item.team ? (
                          <button
                            onClick={() => handleViewTeamRoster(item.team)}
                            className="flex items-center gap-2.5 text-left group hover:text-[#10b981] transition-all focus:outline-none"
                            title="Clique para ver o elenco e tática deste time"
                          >
                            <div className="h-6 w-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {item.team.badge_url ? (
                                <AppImage src={item.team.badge_url} alt="" className="h-full w-full object-contain" />
                              ) : (
                                <span className="text-xs">🛡️</span>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-200 group-hover:text-[#10b981] transition-colors text-xs">{item.team.name}</p>
                              <p className="text-[9px] text-gray-500 group-hover:text-emerald-400/80 transition-colors">{item.team.real_club_name}</p>
                            </div>
                          </button>
                        ) : (
                          <>
                            <p className="font-semibold text-gray-200 text-xs">Sem Clube</p>
                            <p className="text-[9px] text-gray-500">—</p>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-emerald-400 text-lg">{item.goals}</td>
                    </tr>
                  ))}
                  {topScorers.length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-gray-500 text-xs">
                        Nenhum gol marcado nesta liga ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: Assistências */}
          {activeTab === "assists" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-[10px] font-bold uppercase text-gray-400 border-b border-white/5 bg-white/[0.01]">
                  <tr>
                    <th className="py-3 px-2 text-center w-12">Pos</th>
                    <th className="py-3 px-4">Jogador</th>
                    <th className="py-3 px-4">Clube</th>
                    <th className="py-3 px-4 text-center">Assistências</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                  {topAssists.map((item, index) => (
                    <tr key={index} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-2 text-center font-bold text-gray-400">{index + 1}</td>
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {item.player?.face_url ? (
                              <AppImage src={item.player.face_url} alt="" className="h-full w-full object-cover scale-110" />
                            ) : (
                              <span className="text-xs">👤</span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{item.player?.name}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                              {item.player?.position} - Rating: <span className={getRatingColor(item.player?.rating)}>{item.player?.rating}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        {item.team ? (
                          <button
                            onClick={() => handleViewTeamRoster(item.team)}
                            className="flex items-center gap-2.5 text-left group hover:text-[#10b981] transition-all focus:outline-none"
                            title="Clique para ver o elenco e tática deste time"
                          >
                            <div className="h-6 w-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {item.team.badge_url ? (
                                <AppImage src={item.team.badge_url} alt="" className="h-full w-full object-contain" />
                              ) : (
                                <span className="text-xs">🛡️</span>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-200 group-hover:text-[#10b981] transition-colors text-xs">{item.team.name}</p>
                              <p className="text-[9px] text-gray-500 group-hover:text-emerald-400/80 transition-colors">{item.team.real_club_name}</p>
                            </div>
                          </button>
                        ) : (
                          <>
                            <p className="font-semibold text-gray-200 text-xs">Sem Clube</p>
                            <p className="text-[9px] text-gray-500">—</p>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-[#3b82f6] text-lg">{item.assists}</td>
                    </tr>
                  ))}
                  {topAssists.length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-gray-500 text-xs">
                        Nenhuma assistência registrada nesta liga ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: Melhor em Campo (MOTM) */}
          {activeTab === "motm" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-[10px] font-bold uppercase text-gray-400 border-b border-white/5 bg-white/[0.01]">
                  <tr>
                    <th className="py-3 px-2 text-center w-12">Pos</th>
                    <th className="py-3 px-4">Jogador</th>
                    <th className="py-3 px-4">Clube</th>
                    <th className="py-3 px-4 text-center">Melhor em Campo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                  {topMotm.map((item, index) => (
                    <tr key={index} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-2 text-center font-bold text-gray-400">{index + 1}</td>
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {item.player?.face_url ? (
                              <AppImage src={item.player.face_url} alt="" className="h-full w-full object-cover scale-110" />
                            ) : (
                              <span className="text-xs">👤</span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{item.player?.name}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                              {item.player?.position} - Rating: <span className={getRatingColor(item.player?.rating)}>{item.player?.rating}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        {item.team ? (
                          <button
                            onClick={() => handleViewTeamRoster(item.team)}
                            className="flex items-center gap-2.5 text-left group hover:text-[#10b981] transition-all focus:outline-none"
                            title="Clique para ver o elenco e tática deste time"
                          >
                            <div className="h-6 w-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {item.team.badge_url ? (
                                <AppImage src={item.team.badge_url} alt="" className="h-full w-full object-contain" />
                              ) : (
                                <span className="text-xs">🛡️</span>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-200 group-hover:text-[#10b981] transition-colors text-xs">{item.team.name}</p>
                              <p className="text-[9px] text-gray-500 group-hover:text-emerald-400/80 transition-colors">{item.team.real_club_name}</p>
                            </div>
                          </button>
                        ) : (
                          <>
                            <p className="font-semibold text-gray-200 text-xs">Sem Clube</p>
                            <p className="text-[9px] text-gray-500">—</p>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-amber-400 text-lg">{item.motm}</td>
                    </tr>
                  ))}
                  {topMotm.length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-gray-500 text-xs">
                        Nenhum jogador eleito Melhor em Campo nesta liga ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: Suspensões */}
          {activeTab === "suspensions" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-[10px] font-bold uppercase text-gray-400 border-b border-white/5 bg-white/[0.01]">
                  <tr>
                    <th className="py-3 px-4">Jogador Suspenso</th>
                    <th className="py-3 px-4">Clube</th>
                    <th className="py-3 px-4">Motivo<Tooltip content="Cartão Vermelho direto suspende por 1 partida. Acúmulo de 3 cartões amarelos suspende por 1 partida." /></th>
                    <th className="py-3 px-4">Cumprimento na Partida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                  {suspensions.map((susp) => {
                    const suspTeam = getTeamData(susp.players?.teams);
                    return (
                      <tr key={susp.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {susp.players?.face_url ? (
                                <AppImage src={susp.players.face_url} alt="" className="h-full w-full object-cover scale-110" />
                              ) : (
                                <span className="text-xs">👤</span>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">{susp.players?.name}</p>
                              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                                {susp.players?.position} - Rating: <span className={getRatingColor(susp.players?.rating)}>{susp.players?.rating}</span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-sm">
                          {suspTeam ? (
                            <button
                              onClick={() => handleViewTeamRoster(suspTeam)}
                              className="flex items-center gap-2.5 text-left group hover:text-[#10b981] transition-all focus:outline-none"
                              title="Clique para ver o elenco e tática deste time"
                            >
                              <div className="h-6 w-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {suspTeam.badge_url ? (
                                  <AppImage src={suspTeam.badge_url} alt="" className="h-full w-full object-contain" />
                                ) : (
                                  <span className="text-xs">🛡️</span>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-gray-200 group-hover:text-[#10b981] transition-colors text-xs">{suspTeam.name}</p>
                                <p className="text-[9px] text-gray-500 group-hover:text-emerald-400/80 transition-colors">{suspTeam.real_club_name}</p>
                              </div>
                            </button>
                          ) : (
                            <>
                              <p className="font-semibold text-gray-200 text-xs">Sem Clube</p>
                              <p className="text-[9px] text-gray-500">—</p>
                            </>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {susp.reason === "red_card" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20 font-semibold">
                              🟥 Vermelho Direto
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 font-semibold">
                              🟨 3 Amarelos
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-400">
                          {susp.matches ? (
                            <div>
                              <p className="font-bold text-gray-300">Rodada {susp.matches.round_number}</p>
                              <p className="text-[10px] text-gray-500">
                                {susp.matches.home_team?.name} x {susp.matches.away_team?.name}
                              </p>
                            </div>
                          ) : (
                            <span className="italic text-gray-500">Próximo compromisso oficial</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {suspensions.length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-gray-500 text-xs">
                        Nenhum jogador suspenso no momento. Fair play nota 10! 😇
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 5: Copas Mata-Mata (Bracket Visual) */}
          {activeTab === "cups" && (
            <div className="space-y-6">
              {/* Seleção de Copa */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0d1527]/30 p-4 rounded-xl border border-white/5">
                <div>
                  <h3 className="text-sm font-bold text-white">Chaveamento da Copa</h3>
                  <p className="text-xs text-gray-400">Selecione a copa ativa para visualizar a árvore do torneio.</p>
                </div>
                <select
                  value={selectedCup}
                  onChange={(e) => setSelectedCup(e.target.value)}
                  className="bg-[#0d1527] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#10b981] w-full sm:w-auto min-w-[200px]"
                  disabled={allCups.length === 0}
                >
                  {allCups.map((cup) => (
                    <option key={cup} value={cup}>
                      {cup}
                    </option>
                  ))}
                  {allCups.length === 0 && <option value="">Nenhuma copa criada</option>}
                </select>
              </div>

              {selectedCup ? (() => {
                const hasQuartas = cupMatches.some(m => m.round_number === 1);
                const hasSemis = cupMatches.some(m => m.round_number === 2);
                const hasFinal = cupMatches.some(m => m.round_number === 3);

                return (
                  <div className="overflow-x-auto pb-6 pt-4">
                    <div className="flex flex-col space-y-4 items-center">
                      {/* Cabeçalho das Fases */}
                      <div className="flex flex-row justify-center items-center gap-0 min-w-[850px] border-b border-white/5 pb-3">
                        {hasQuartas && (
                          <>
                            <div className="w-[240px] text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quartas de Final</div>
                            {hasSemis && <div className="w-[32px]"></div>}
                          </>
                        )}
                        {hasSemis && (
                          <>
                            <div className="w-[240px] text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Semifinais</div>
                            {hasFinal && <div className="w-[32px]"></div>}
                          </>
                        )}
                        {hasFinal && (
                          <div className="w-[240px] text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">Grande Final</div>
                        )}
                      </div>

                      {/* Estrutura das Chaves */}
                      <div className="flex flex-row justify-center items-center gap-0 min-w-[850px] py-4">
                        {/* Quartas */}
                        {hasQuartas && (
                          <div className="flex flex-col justify-around h-[560px] w-[240px]">
                            {cupMatches.filter(m => m.round_number === 1).map(renderBracketMatch)}
                          </div>
                        )}

                        {/* Conectores Quartas -> Semis */}
                        {hasQuartas && hasSemis && (
                          <div className="w-[32px] h-[560px] relative pointer-events-none">
                            <svg className="absolute inset-0 w-full h-full stroke-white/10 stroke-[1.5] fill-none">
                              <path d="M 0 70 L 16 70 L 16 140 L 32 140" />
                              <path d="M 0 210 L 16 210 L 16 140 L 32 140" />
                              <path d="M 0 350 L 16 350 L 16 420 L 32 420" />
                              <path d="M 0 490 L 16 490 L 16 420 L 32 420" />
                            </svg>
                          </div>
                        )}

                        {/* Semis */}
                        {hasSemis && (
                          <div className="flex flex-col justify-around h-[560px] w-[240px]">
                            {cupMatches.filter(m => m.round_number === 2).map(renderBracketMatch)}
                          </div>
                        )}

                        {/* Conectores Semis -> Final */}
                        {hasSemis && hasFinal && (
                          <div className="w-[32px] h-[560px] relative pointer-events-none">
                            <svg className="absolute inset-0 w-full h-full stroke-white/10 stroke-[1.5] fill-none">
                              <path d="M 0 140 L 16 140 L 16 280 L 32 280" />
                              <path d="M 0 420 L 16 420 L 16 280 L 32 280" />
                            </svg>
                          </div>
                        )}

                        {/* Final */}
                        {hasFinal && (
                          <div className="flex flex-col justify-around h-[560px] w-[240px]">
                            {cupMatches.filter(m => m.round_number === 3).map(renderBracketMatch)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div className="py-12 text-center text-gray-500 text-xs border border-dashed border-white/5 rounded-2xl bg-[#090d16]/20">
                  <span className="text-3xl block mb-2">🏆</span>
                  Nenhuma copa mata-mata ativa nesta temporada.
                </div>
              )}
            </div>
          )}
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
    </div>
  );

}
