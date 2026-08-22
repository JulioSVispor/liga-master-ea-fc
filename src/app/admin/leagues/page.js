"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { generateRoundRobinFixtures } from "@/lib/domain/round-robin";
import { competitionService } from "@/services/competitionService";
import { adminService } from "@/services/adminService";

export default function AdminLeaguesPage() {
  // Estados Gerais
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [teams, setTeams] = useState([]); // Todos os times cadastrados
  const [leagueTeams, setLeagueTeams] = useState([]); // Times vinculados à liga selecionada
  const [activeMatches, setActiveMatches] = useState([]); // Partidas da liga selecionada
  const [loading, setLoading] = useState(true);

  // Modais / Criação
  const [newSeasonName, setNewSeasonName] = useState("");
  const [newLeagueName, setNewLeagueName] = useState("");
  const [newLeagueDivision, setNewLeagueDivision] = useState(1);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [showLeagueModal, setShowLeagueModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [doubleRoundMatchGen, setDoubleRoundMatchGen] = useState(true);

  // Mensagens
  const [alert, setAlert] = useState(null);

  // Estados de Copas (Champions)
  const [activePageTab, setActivePageTab] = useState("leagues"); // "leagues" | "cups"
  const [newCupName, setNewCupName] = useState("");
  const [selectedCupTeams, setSelectedCupTeams] = useState([]); // Array de IDs de times
  const [cupStartPhase, setCupStartPhase] = useState("quartas"); // "quartas" | "semi" | "final"
  const [showCupModal, setShowCupModal] = useState(false);
  const [allCups, setAllCups] = useState([]);
  const [selectedCup, setSelectedCup] = useState("");
  const [cupMatches, setCupMatches] = useState([]);
  const [generatingCup, setGeneratingCup] = useState(false);

  useEffect(() => {
    loadSeasons();
    loadAllTeams();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      loadLeagues(selectedSeason.id);
      loadCups(selectedSeason.id);
    } else {
      setLeagues([]);
      setSelectedLeague(null);
      setAllCups([]);
      setSelectedCup("");
    }
  }, [selectedSeason]);

  useEffect(() => {
    if (selectedLeague) {
      loadLeagueTeams(selectedLeague.id);
      loadLeagueMatches(selectedLeague.id);
    } else {
      setLeagueTeams([]);
      setActiveMatches([]);
    }
  }, [selectedLeague]);

  useEffect(() => {
    if (selectedCup && selectedSeason) {
      loadCupMatches(selectedCup, selectedSeason.id);
    } else {
      setCupMatches([]);
    }
  }, [selectedCup, selectedSeason]);

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  // Carregar dados do Supabase
  const loadSeasons = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("seasons")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSeasons(data);
      if (data.length > 0 && !selectedSeason) {
        setSelectedSeason(data[0]);
      }
    }
    setLoading(false);
  };

  const loadAllTeams = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("name", { ascending: true });
    if (!error && data) setTeams(data);
  };

  const loadLeagues = async (seasonId) => {
    const { data, error } = await supabase
      .from("leagues")
      .select("*")
      .eq("season_id", seasonId)
      .order("division", { ascending: true });

    if (!error && data) {
      setLeagues(data);
      if (data.length > 0) {
        setSelectedLeague(data[0]);
      } else {
        setSelectedLeague(null);
      }
    }
  };

  const loadCups = async (seasonId) => {
    const { data, error } = await supabase
      .from("matches")
      .select("cup_name")
      .eq("season_id", seasonId)
      .is("league_id", null)
      .not("cup_name", "is", null);

    if (!error && data) {
      const uniqueCups = Array.from(new Set(data.map(m => m.cup_name).filter(Boolean)));
      setAllCups(uniqueCups);
      if (uniqueCups.length > 0) {
        setSelectedCup(uniqueCups[0]);
      } else {
        setSelectedCup("");
      }
    }
  };

  const loadCupMatches = async (cupName, seasonId) => {
    const { data, error } = await supabase
      .from("matches")
      .select("*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)")
      .eq("season_id", seasonId)
      .eq("cup_name", cupName)
      .is("league_id", null)
      .order("round_number", { ascending: true });

    if (!error && data) {
      setCupMatches(data);
    }
  };

  const loadLeagueTeams = async (leagueId) => {
    const { data, error } = await supabase
      .from("league_teams")
      .select("*, teams(*)")
      .eq("league_id", leagueId);

    if (!error && data) {
      setLeagueTeams(data);
    }
  };

  const loadLeagueMatches = async (leagueId) => {
    const { data, error } = await supabase
      .from("matches")
      .select("*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)")
      .eq("league_id", leagueId)
      .order("round_number", { ascending: true });

    if (!error && data) {
      setActiveMatches(data);
    }
  };

  // Ações de Criação
  const handleCreateSeason = async (e) => {
    e.preventDefault();
    if (!newSeasonName.trim()) return;

    try {
      const data = await adminService.createSeason(supabase, newSeasonName, true);
      triggerAlert("success", "Temporada criada com sucesso!");
      setNewSeasonName("");
      setShowSeasonModal(false);
      loadSeasons().then(() => {
        if (data) setSelectedSeason(data);
      });
    } catch (error) {
      triggerAlert("error", "Erro ao criar temporada: " + error.message);
    }
  };

  const handleCreateLeague = async (e) => {
    e.preventDefault();
    if (!newLeagueName.trim() || !selectedSeason) return;

    try {
      const data = await adminService.createLeague(
        supabase,
        selectedSeason.id,
        newLeagueName,
        Number.parseInt(newLeagueDivision, 10)
      );
      triggerAlert("success", "Liga/Divisão criada com sucesso!");
      setNewLeagueName("");
      setShowLeagueModal(false);
      loadLeagues(selectedSeason.id).then(() => {
        if (data) setSelectedLeague(data);
      });
    } catch (error) {
      triggerAlert("error", "Erro ao criar liga: " + error.message);
    }
  };

  const handleAddTeamToLeague = async (teamId) => {
    if (!selectedLeague) return;

    try {
      await adminService.addTeamToLeague(supabase, selectedLeague.id, teamId);
      triggerAlert("success", "Time adicionado à liga!");
      loadLeagueTeams(selectedLeague.id);
    } catch (error) {
      triggerAlert("error", "Este time já está vinculado a esta liga ou a outra divisão desta temporada.");
    }
  };

  const handleRemoveTeamFromLeague = async (leagueTeamId) => {
    const confirm = window.confirm("Tem certeza que deseja remover este time da liga? Isso apagará seu histórico nesta liga.");
    if (!confirm) return;

    try {
      await adminService.removeTeamFromLeague(supabase, leagueTeamId);
      triggerAlert("success", "Time removido da liga.");
      loadLeagueTeams(selectedLeague.id);
    } catch (error) {
      triggerAlert("error", "Erro ao remover time: " + error.message);
    }
  };

  // Gerador de Rodadas (Berger / Roda de Carrossel)
  const handleGenerateMatches = async () => {
    if (leagueTeams.length < 2) {
      triggerAlert("error", "Você precisa de pelo menos 2 times na liga para gerar confrontos.");
      return;
    }

    const confirm = window.confirm(
      `Deseja gerar os confrontos para os ${leagueTeams.length} times vinculados? Apenas jogos ainda não disputados serão substituídos.`
    );
    if (!confirm) return;
    try {
      const fixtures = generateRoundRobinFixtures(
        leagueTeams.map((leagueTeam) => leagueTeam.teams),
        { doubleRound: doubleRoundMatchGen }
      );
      await competitionService.replaceLeagueSchedule(supabase, selectedLeague.id, fixtures);
      triggerAlert("success", `${fixtures.length} partidas geradas com sucesso!`);
      loadLeagueMatches(selectedLeague.id);
    } catch (error) {
      triggerAlert("error", error.message || "Não foi possível gerar os confrontos.");
    }
  };

  const handleGenerateCup = async (e) => {
    e.preventDefault();
    if (!newCupName.trim() || !selectedSeason) return;

    const requiredCount = cupStartPhase === "quartas" ? 8 : cupStartPhase === "semi" ? 4 : 2;
    if (selectedCupTeams.length !== requiredCount) {
      triggerAlert("error", `Erro: Selecione exatamente ${requiredCount} times para a fase de ${cupStartPhase === "quartas" ? "Quartas de Final" : cupStartPhase === "semi" ? "Semifinais" : "Grande Final"}.`);
      return;
    }

    setGeneratingCup(true);
    try {
      const shuffledTeams = [...selectedCupTeams].sort(() => Math.random() - 0.5);
      const fixtures = [];
      const startRound = cupStartPhase === "quartas" ? 1 : cupStartPhase === "semi" ? 2 : 3;

      for (let i = 0; i < shuffledTeams.length; i += 2) {
        fixtures.push({
          season_id: selectedSeason.id,
          league_id: null,
          competition_type: "cup_playoff",
          cup_name: newCupName,
          home_team_id: shuffledTeams[i],
          away_team_id: shuffledTeams[i+1],
          round_number: startRound,
          status: "pending",
          released: false
        });
      }

      const { error } = await supabase.from("matches").insert(fixtures);
      if (error) throw error;

      triggerAlert("success", `Copa "${newCupName}" criada com sucesso!`);
      setNewCupName("");
      setSelectedCupTeams([]);
      setShowCupModal(false);
      
      await loadCups(selectedSeason.id);
      setSelectedCup(newCupName);
    } catch (err) {
      triggerAlert("error", "Erro ao gerar copa: " + err.message);
    } finally {
      setGeneratingCup(false);
    }
  };

  const handleGenerateNextCupPhase = async (currentPhase) => {
    const activeCupMatches = cupMatches.filter(m => m.round_number === currentPhase);
    
    const pendingCount = activeCupMatches.filter(m => m.status !== "confirmed").length;
    if (pendingCount > 0) {
      triggerAlert("error", `Não é possível gerar a próxima fase pois ainda existem ${pendingCount} partidas pendentes nesta fase.`);
      return;
    }

    const confirmGen = window.confirm(`Deseja gerar os confrontos da próxima fase para a copa "${selectedCup}"?`);
    if (!confirmGen) return;

    try {
      const winners = activeCupMatches.map(m => {
        if (m.home_score > m.away_score) return m.home_team_id;
        return m.away_team_id;
      });

      const shuffledWinners = [...winners].sort(() => Math.random() - 0.5);
      const nextPhaseFixtures = [];

      for (let i = 0; i < shuffledWinners.length; i += 2) {
        nextPhaseFixtures.push({
          season_id: selectedSeason.id,
          league_id: null,
          competition_type: "cup_playoff",
          cup_name: selectedCup,
          home_team_id: shuffledWinners[i],
          away_team_id: shuffledWinners[i+1],
          round_number: currentPhase + 1,
          status: "pending",
          released: false
        });
      }

      const { error } = await supabase.from("matches").insert(nextPhaseFixtures);
      if (error) throw error;

      triggerAlert("success", `Próxima fase gerada com sucesso!`);
      loadCupMatches(selectedCup, selectedSeason.id);
    } catch (err) {
      triggerAlert("error", "Erro ao gerar próxima fase: " + err.message);
    }
  };

  const handleToggleRoundRelease = async (roundNumber, currentReleasedStatus, isLeague) => {
    try {
      await adminService.setRoundRelease(supabase, {
        seasonId: selectedSeason.id,
        roundNumber: Number.parseInt(roundNumber, 10),
        released: !currentReleasedStatus,
        leagueId: isLeague ? selectedLeague.id : null,
        cupName: isLeague ? null : selectedCup,
      });
      
      triggerAlert("success", `Rodada ${roundNumber} ${!currentReleasedStatus ? "liberada" : "bloqueada"} com sucesso!`);
      if (isLeague) {
        loadLeagueMatches(selectedLeague.id);
      } else {
        loadCupMatches(selectedCup, selectedSeason.id);
      }
    } catch (err) {
      triggerAlert("error", "Erro ao alterar status da rodada: " + err.message);
    }
  };

  // Rebaixamento / Promoção Manual e Movimentação de Times
  const [movingTeam, setMovingTeam] = useState(null);
  const [targetLeagueId, setTargetLeagueId] = useState("");

  const handleMoveTeam = async (e) => {
    e.preventDefault();
    if (!movingTeam || !targetLeagueId) return;

    try {
      await adminService.moveTeamBetweenLeagues(
        supabase,
        movingTeam.team_id,
        selectedLeague.id,
        targetLeagueId
      );
      triggerAlert("success", `Time ${movingTeam.teams.name} movido com sucesso!`);
      setMovingTeam(null);
      setTargetLeagueId("");
      loadLeagueTeams(selectedLeague.id);
    } catch (error) {
      triggerAlert("error", "Erro ao mover time: " + error.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Configurações da Liga</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie temporadas, divisões, times participantes e tabelas de confrontos.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSeasonModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 hover:bg-[#10b981]/25 transition-all"
          >
            ➕ Nova Temporada
          </button>
          {activePageTab === "leagues" ? (
            <button
              onClick={() => setShowLeagueModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 hover:bg-[#3b82f6]/25 transition-all"
            >
              ➕ Nova Divisão/Liga
            </button>
          ) : (
            <button
              onClick={() => setShowCupModal(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 transition-all"
            >
              🏆 Criar Copa / Playoff
            </button>
          )}
        </div>
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

      {/* Abas de Navegação */}
      <div className="flex border-b border-white/5 gap-2">
        <button
          onClick={() => setActivePageTab("leagues")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activePageTab === "leagues"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          🏆 Ligas (Pontos Corridos)
        </button>
        <button
          onClick={() => setActivePageTab("cups")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activePageTab === "cups"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          ⚔️ Copas (Playoffs / Mata-Mata)
        </button>
      </div>

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
                        Nenhum jogo gerado ainda para esta liga. Clique em "Gerar Tabela de Jogos".
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
                        <span>Você pode mover times individualmente entre divisões usando o botão "Mover/Acesso".</span>
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
                                      <img src={m.home_team.badge_url} alt="" className="w-5 h-5 object-contain" />
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
                                      <img src={m.away_team.badge_url} alt="" className="w-5 h-5 object-contain" />
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
                                      <img src={m.home_team.badge_url} alt="" className="w-5 h-5 object-contain" />
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
                                      <img src={m.away_team.badge_url} alt="" className="w-5 h-5 object-contain" />
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
                                      <img src={m.home_team.badge_url} alt="" className="w-5 h-5 object-contain" />
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
                                      <img src={m.away_team.badge_url} alt="" className="w-5 h-5 object-contain" />
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
              <p className="text-xs text-gray-400 mt-1">Clique em "Criar Copa / Playoff" acima para sortear os confrontos iniciais.</p>
            </div>
          )}
        </>
      )}

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
                  ⚠️ Criar uma nova temporada colocará as temporadas anteriores no status "FINALIZADA".
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
    </div>
  );
}
