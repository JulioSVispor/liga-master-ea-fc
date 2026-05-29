"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

  useEffect(() => {
    loadSeasons();
    loadAllTeams();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      loadLeagues(selectedSeason.id);
    } else {
      setLeagues([]);
      setSelectedLeague(null);
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

    // Se houver outra ativa, perguntar ou fechar
    const activeSeasons = seasons.filter(s => s.status === "active");
    if (activeSeasons.length > 0) {
      // Conclui as anteriores automaticamente
      await supabase
        .from("seasons")
        .update({ status: "completed" })
        .eq("status", "active");
    }

    const { data, error } = await supabase
      .from("seasons")
      .insert([{ name: newSeasonName, status: "active" }])
      .select()
      .single();

    if (error) {
      triggerAlert("error", "Erro ao criar temporada: " + error.message);
    } else {
      triggerAlert("success", "Temporada criada com sucesso!");
      setNewSeasonName("");
      setShowSeasonModal(false);
      loadSeasons().then(() => {
        if (data) setSelectedSeason(data);
      });
    }
  };

  const handleCreateLeague = async (e) => {
    e.preventDefault();
    if (!newLeagueName.trim() || !selectedSeason) return;

    const { data, error } = await supabase
      .from("leagues")
      .insert([
        {
          season_id: selectedSeason.id,
          name: newLeagueName,
          division: parseInt(newLeagueDivision),
          status: "active",
        },
      ])
      .select()
      .single();

    if (error) {
      triggerAlert("error", "Erro ao criar liga: " + error.message);
    } else {
      triggerAlert("success", "Liga/Divisão criada com sucesso!");
      setNewLeagueName("");
      setShowLeagueModal(false);
      loadLeagues(selectedSeason.id).then(() => {
        if (data) setSelectedLeague(data);
      });
    }
  };

  const handleAddTeamToLeague = async (teamId) => {
    if (!selectedLeague) return;

    const { error } = await supabase
      .from("league_teams")
      .insert([
        {
          league_id: selectedLeague.id,
          team_id: teamId,
        },
      ]);

    if (error) {
      triggerAlert("error", "Este time já está vinculado a esta liga ou a outra divisão desta temporada.");
    } else {
      triggerAlert("success", "Time adicionado à liga!");
      loadLeagueTeams(selectedLeague.id);
    }
  };

  const handleRemoveTeamFromLeague = async (leagueTeamId) => {
    const confirm = window.confirm("Tem certeza que deseja remover este time da liga? Isso apagará seu histórico nesta liga.");
    if (!confirm) return;

    const { error } = await supabase
      .from("league_teams")
      .delete()
      .eq("id", leagueTeamId);

    if (error) {
      triggerAlert("error", "Erro ao remover time: " + error.message);
    } else {
      triggerAlert("success", "Time removido da liga.");
      loadLeagueTeams(selectedLeague.id);
    }
  };

  // Gerador de Rodadas (Berger / Roda de Carrossel)
  const handleGenerateMatches = async () => {
    if (leagueTeams.length < 2) {
      triggerAlert("error", "Você precisa de pelo menos 2 times na liga para gerar confrontos.");
      return;
    }

    const confirm = window.confirm(
      `Deseja gerar os confrontos para os ${leagueTeams.length} times vinculados? Isso APAGARÁ todos os jogos pendentes e confirmados existentes nesta liga!`
    );
    if (!confirm) return;

    // 1. Limpar partidas existentes
    const { error: deleteError } = await supabase
      .from("matches")
      .delete()
      .eq("league_id", selectedLeague.id);

    if (deleteError) {
      triggerAlert("error", "Erro ao limpar partidas antigas: " + deleteError.message);
      return;
    }

    // 2. Algoritmo Round-Robin (Berger)
    const list = leagueTeams.map(lt => lt.teams);
    if (list.length % 2 !== 0) {
      list.push({ id: null, name: "BYE / FOLGA" });
    }

    const numTeams = list.length;
    const rounds = numTeams - 1;
    const half = numTeams / 2;
    const fixtures = [];

    let tempTeams = [...list];
    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < half; i++) {
        const home = tempTeams[i];
        const away = tempTeams[numTeams - 1 - i];
        
        // Ignorar se um dos times for BYE/Folga
        if (home.id && away.id) {
          fixtures.push({
            season_id: selectedSeason.id,
            league_id: selectedLeague.id,
            competition_type: "league",
            home_team_id: r % 2 === 0 ? home.id : away.id, // Alternar mando
            away_team_id: r % 2 === 0 ? away.id : home.id,
            round_number: r + 1,
            status: "pending",
          });
        }
      }
      // Rotacionar mantendo o primeiro fixo
      tempTeams = [tempTeams[0], tempTeams[numTeams - 1], ...tempTeams.slice(1, numTeams - 1)];
    }

    // Se for turno e returno
    if (doubleRoundMatchGen) {
      const returnFixtures = fixtures.map(f => ({
        ...f,
        home_team_id: f.away_team_id,
        away_team_id: f.home_team_id,
        round_number: f.round_number + rounds,
      }));
      fixtures.push(...returnFixtures);
    }

    // Gravar no Supabase
    const { error: insertError } = await supabase
      .from("matches")
      .insert(fixtures);

    if (insertError) {
      triggerAlert("error", "Erro ao gerar partidas: " + insertError.message);
    } else {
      triggerAlert("success", `${fixtures.length} partidas geradas com sucesso!`);
      loadLeagueMatches(selectedLeague.id);
    }
  };

  // Rebaixamento / Promoção Manual e Movimentação de Times
  const [movingTeam, setMovingTeam] = useState(null);
  const [targetLeagueId, setTargetLeagueId] = useState("");

  const handleMoveTeam = async (e) => {
    e.preventDefault();
    if (!movingTeam || !targetLeagueId) return;

    // Remover da liga atual
    const { error: delError } = await supabase
      .from("league_teams")
      .delete()
      .eq("league_id", selectedLeague.id)
      .eq("team_id", movingTeam.team_id);

    if (delError) {
      triggerAlert("error", "Erro ao retirar time da liga atual: " + delError.message);
      return;
    }

    // Adicionar na nova liga (com pontuação zerada por padrão)
    const { error: insError } = await supabase
      .from("league_teams")
      .insert([
        {
          league_id: targetLeagueId,
          team_id: movingTeam.team_id,
          points: 0,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goals_for: 0,
          goals_against: 0,
          goals_difference: 0,
        },
      ]);

    if (insError) {
      triggerAlert("error", "Erro ao adicionar time na liga destino: " + insError.message);
      // Tentar reverter inserindo de volta na original
      await supabase.from("league_teams").insert([{ league_id: selectedLeague.id, team_id: movingTeam.team_id }]);
    } else {
      triggerAlert("success", `Time ${movingTeam.teams.name} movido com sucesso!`);
      setMovingTeam(null);
      setTargetLeagueId("");
      loadLeagueTeams(selectedLeague.id);
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
          <button
            onClick={() => setShowLeagueModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 hover:bg-[#3b82f6]/25 transition-all"
          >
            ➕ Nova Divisão/Liga
          </button>
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

      {/* Barra de Seleção Rápida */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 rounded-2xl bg-[#090d16]/40 border border-white/5 backdrop-blur-md">
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
            <div className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5 backdrop-blur-md">
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
            <div className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5 backdrop-blur-md space-y-6">
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
                ).map(([round, matches]) => (
                  <div key={round} className="space-y-2">
                    <h3 className="text-xs font-bold text-gray-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                      RODADA {round}
                    </h3>
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
                ))}
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
              <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 backdrop-blur-md space-y-4">
                <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                  🔄 Movimentação Manual
                </h3>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Defina o destino do time <strong className="text-white">{movingTeam.teams.name}</strong> para promover, rebaixar ou reposicionar de divisão.
                </p>

                <form onSubmit={handleMoveTeam} className="space-y-4">
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
              <div className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5 backdrop-blur-md space-y-4 text-sm text-gray-400">
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

      {/* MODAL: Nova Temporada */}
      {showSeasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#090d16] border border-white/10 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h3 className="text-lg font-bold text-white">Criar Nova Temporada</h3>
              <button onClick={() => setShowSeasonModal(false)} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>
            <form onSubmit={handleCreateSeason} className="space-y-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#090d16] border border-white/10 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <h3 className="text-lg font-bold text-white">Criar Nova Divisão / Liga</h3>
              <button onClick={() => setShowLeagueModal(false)} className="text-gray-400 hover:text-white text-lg">✕</button>
            </div>
            <form onSubmit={handleCreateLeague} className="space-y-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
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
    </div>
  );
}
