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

export function AdminLeagueDialogs({ model }) {
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
    <>
      {/* MODAL: Nova Temporada */}
      {showSeasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#090d16] border border-white/10 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h3 className="text-lg font-bold text-white">Criar Nova Temporada</h3>
              <button onClick={() => setShowSeasonModal(false)} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>
            <form noValidate onSubmit={handleCreateSeason} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Nome da Temporada</label>
                <input
                  type="text"
                  placeholder="Ex: Temporada 1"
                  value={newSeasonName}
                  onChange={(e) => setNewSeasonName(e.target.value)}
                  className="w-full bg-[#0d1527] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#10b981]"
                  required
                />
                <span className="text-[10px] text-amber-400 mt-2 block">
                  ⚠️ Criar uma nova temporada colocará as temporadas anteriores no status &quot;FINALIZADA&quot;.
                </span>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSeasonModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#10b981] text-white hover:bg-emerald-600"
                >
                  Criar Temporada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Nova Divisão/Liga */}
      {showLeagueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#090d16] border border-white/10 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h3 className="text-lg font-bold text-white">Criar Nova Divisão / Liga</h3>
              <button onClick={() => setShowLeagueModal(false)} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>
            <form noValidate onSubmit={handleCreateLeague} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Nome da Divisão</label>
                <input
                  type="text"
                  placeholder="Ex: Série A"
                  value={newLeagueName}
                  onChange={(e) => setNewLeagueName(e.target.value)}
                  className="w-full bg-[#0d1527] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#3b82f6]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Número da Divisão (Série)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newLeagueDivision}
                  onChange={(e) => setNewLeagueDivision(e.target.value)}
                  className="w-full bg-[#0d1527] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#3b82f6]"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLeagueModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#3b82f6] text-white hover:bg-blue-600"
                >
                  Criar Divisão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adicionar Time */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-[#090d16] border border-white/10 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Adicionar Time à Divisão</h3>
                <p className="text-xs text-gray-400 mt-0.5">Selecione um time cadastrado para incluir na {selectedLeague?.name}.</p>
              </div>
              <button onClick={() => setShowTeamModal(false)} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {teams
                .filter(t => !leagueTeams.some(lt => lt.team_id === t.id))
                .map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-[#0d1527]/50 border border-white/5 flex justify-between items-center gap-3 hover:bg-[#0d1527] transition-all"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.real_club_name}</p>
                    </div>
                    <button
                      onClick={() => handleAddTeamToLeague(t.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#10b981]/15 text-[#10b981] hover:bg-[#10b981] hover:text-white transition-all border border-[#10b981]/30"
                    >
                      Selecionar
                    </button>
                  </div>
                ))}
              {teams.filter(t => !leagueTeams.some(lt => lt.team_id === t.id)).length === 0 && (
                <div className="text-center py-6 text-gray-500 text-sm">
                  Todos os times do sistema já estão participando desta liga.
                </div>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowTeamModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: Criar Copa Mata-Mata */}
      {showCupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#090d16] border border-white/10 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h3 className="text-lg font-bold text-white">Criar Nova Copa / Playoff</h3>
              <button onClick={() => setShowCupModal(false)} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>
            <form noValidate onSubmit={handleGenerateCup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Nome do Torneio / Copa</label>
                <input
                  type="text"
                  placeholder="Ex: Champions League, Copa do Brasil"
                  value={newCupName}
                  onChange={(e) => setNewCupName(e.target.value)}
                  className="w-full bg-[#0d1527] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Fase Inicial do Sorteio</label>
                <select
                  value={cupStartPhase}
                  onChange={(e) => {
                    setCupStartPhase(e.target.value);
                    setSelectedCupTeams([]);
                  }}
                  className="w-full bg-[#0d1527] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="quartas">Quartas de Final (8 Times)</option>
                  <option value="semi">Semifinais (4 Times)</option>
                  <option value="final">Grande Final (2 Times)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">
                  Selecionar Participantes ({selectedCupTeams.length} de {cupStartPhase === "quartas" ? 8 : cupStartPhase === "semi" ? 4 : 2})
                </label>
                <div className="max-h-[180px] overflow-y-auto space-y-2 border border-white/10 rounded-xl p-3 bg-[#0d1527]/50 pr-1">
                  {teams.map((t) => {
                    const isChecked = selectedCupTeams.includes(t.id);
                    const limitReached = selectedCupTeams.length >= (cupStartPhase === "quartas" ? 8 : cupStartPhase === "semi" ? 4 : 2);
                    return (
                      <label key={t.id} className="flex items-center gap-3 text-xs font-medium text-gray-300 cursor-pointer hover:text-white">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!isChecked && limitReached}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCupTeams([...selectedCupTeams, t.id]);
                            } else {
                              setSelectedCupTeams(selectedCupTeams.filter(id => id !== t.id));
                            }
                          }}
                          className="rounded border-white/10 bg-[#060913] text-[#10b981] focus:ring-0 cursor-pointer h-4 w-4"
                        />
                        <span>{t.name} <span className="text-gray-500">({t.real_club_name})</span></span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCupModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-white border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={generatingCup}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-all disabled:opacity-50"
                >
                  {generatingCup ? "Gerando..." : "Gerar Confrontos"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

