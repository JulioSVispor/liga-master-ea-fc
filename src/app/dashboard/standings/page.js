"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

export default function StandingsPage() {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  
  const [activeTab, setActiveTab] = useState("table"); // "table", "scorers", "assists", "motm", "suspensions", "cups"
  
  const [standings, setStandings] = useState([]);
  const [topScorers, setTopScorers] = useState([]);
  const [topAssists, setTopAssists] = useState([]);
  const [topMotm, setTopMotm] = useState([]);
  const [suspensions, setSuspensions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Copas (Mata-Mata)
  const [allCups, setAllCups] = useState([]);
  const [selectedCup, setSelectedCup] = useState("");
  const [cupMatches, setCupMatches] = useState([]);

  // Estados para visualizar elenco e formação de outro time
  const [viewingTeam, setViewingTeam] = useState(null);
  const [viewingPlayers, setViewingPlayers] = useState([]);
  const [viewingCoach, setViewingCoach] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);

  useEffect(() => {
    loadSeasons();
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
    if (selectedCup && selectedSeason) {
      loadCupMatches(selectedCup, selectedSeason.id);
    } else {
      setCupMatches([]);
    }
  }, [selectedCup, selectedSeason]);

  useEffect(() => {
    if (selectedLeague) {
      loadLeagueData(selectedLeague.id);
    } else {
      setStandings([]);
      setTopScorers([]);
      setTopAssists([]);
      setSuspensions([]);
    }
  }, [selectedLeague]);

  const loadSeasons = async () => {
    const { data, error } = await supabase
      .from("seasons")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSeasons(data);
      if (data.length > 0) setSelectedSeason(data[0]);
    }
  };

  const loadLeagues = async (seasonId) => {
    const { data, error } = await supabase
      .from("leagues")
      .select("*")
      .eq("season_id", seasonId)
      .order("division", { ascending: true });

    if (!error && data) {
      setLeagues(data);
      if (data.length > 0) setSelectedLeague(data[0]);
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

  const loadLeagueData = async (leagueId) => {
    setLoading(true);
    try {
      // 1. Tabela de Classificação
      const { data: standingsData, error: stError } = await supabase
        .from("league_teams")
        .select("*, teams(*)")
        .eq("league_id", leagueId)
        .order("points", { ascending: false })
        .order("goals_difference", { ascending: false })
        .order("goals_for", { ascending: false });

      if (!stError && standingsData) {
        setStandings(standingsData);
      }

      // 2. Artilheiros (Gols em partidas confirmadas nesta liga)
      const { data: scorersData, error: scError } = await supabase
        .from("match_events")
        .select(`
          player_id,
          players!player_id(name, common_name, rating, position, face_url),
          teams!team_id(id, name, real_club_name, badge_url),
          matches!match_id(league_id, status)
        `)
        .eq("event_type", "goal")
        .eq("matches.league_id", leagueId)
        .eq("matches.status", "confirmed");

      if (!scError && scorersData) {
        // Agrupar e contar no JS para contornar limitações do supabase client client-side aggregations
        const scoresMap = {};
        scorersData.forEach(event => {
          // Filtragem de segurança pois o query no matches traz null se a correspondência falhar
          if (event.matches) {
            const pId = event.player_id;
            if (!scoresMap[pId]) {
              scoresMap[pId] = {
                player: event.players,
                team: getTeamData(event.teams),
                goals: 0
              };
            }
            scoresMap[pId].goals += 1;
          }
        });
        const sortedScorers = Object.values(scoresMap).sort((a, b) => b.goals - a.goals);
        setTopScorers(sortedScorers);
      }

      // 3. Assistências (Em partidas confirmadas nesta liga)
      const { data: assistsData, error: asError } = await supabase
        .from("match_events")
        .select(`
          player_id,
          players!player_id(name, common_name, rating, position, face_url),
          teams!team_id(id, name, real_club_name, badge_url),
          matches!match_id(league_id, status)
        `)
        .eq("event_type", "assist")
        .eq("matches.league_id", leagueId)
        .eq("matches.status", "confirmed");

      if (!asError && assistsData) {
        const assistsMap = {};
        assistsData.forEach(event => {
          if (event.matches) {
            const pId = event.player_id;
            if (!assistsMap[pId]) {
              assistsMap[pId] = {
                player: event.players,
                team: getTeamData(event.teams),
                assists: 0
              };
            }
            assistsMap[pId].assists += 1;
          }
        });
        const sortedAssists = Object.values(assistsMap).sort((a, b) => b.assists - a.assists);
        setTopAssists(sortedAssists);
      }

      // 4. Melhor em Campo (MOTM) (Em partidas confirmadas nesta liga)
      const { data: motmData, error: motmError } = await supabase
        .from("matches")
        .select(`
          motm_player_id,
          player:players!motm_player_id(name, common_name, rating, position, face_url, teams!team_id(id, name, real_club_name, badge_url))
        `)
        .eq("league_id", leagueId)
        .eq("status", "confirmed")
        .not("motm_player_id", "is", null);

      if (!motmError && motmData) {
        const motmMap = {};
        motmData.forEach(match => {
          if (match.player) {
            const pId = match.motm_player_id;
            if (!motmMap[pId]) {
              motmMap[pId] = {
                player: match.player,
                team: getTeamData(match.player.teams) || null,
                motm: 0
              };
            }
            motmMap[pId].motm += 1;
          }
        });
        const sortedMotm = Object.values(motmMap).sort((a, b) => b.motm - a.motm);
        setTopMotm(sortedMotm);
      } else {
        setTopMotm([]);
      }

      // 5. Suspensões Ativas
      const { data: suspensionsData, error: suspError } = await supabase
        .from("suspensions")
        .select(`
          *,
          players!player_id(name, common_name, position, rating, face_url, teams!team_id(id, name, badge_url)),
          matches!match_id(round_number, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name), status)
        `)
        .eq("season_id", selectedSeason.id);

      if (!suspError && suspensionsData) {
        // Filtrar apenas suspensões que apontam para jogos pendentes (não cumpridas ainda)
        const activeSuspensions = suspensionsData.filter(s => !s.matches || s.matches.status === "pending");
        setSuspensions(activeSuspensions);
      }

    } catch (err) {
      console.error("Erro ao carregar dados de classificação:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewTeamRoster = async (team) => {
    if (!team) return;
    setViewingTeam(team);
    setViewingLoading(true);
    try {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("team_id", team.id)
        .order("rating", { ascending: false });

      if (!error && data) {
        setViewingPlayers(data);
      } else {
        setViewingPlayers([]);
      }

      if (team.user_id) {
        const { data: coachProfile } = await supabase
          .from("profiles")
          .select("display_name, email")
          .eq("id", team.user_id)
          .single();
        setViewingCoach(coachProfile || null);
      } else {
        setViewingCoach(null);
      }
    } catch (err) {
      console.error("Erro ao carregar elenco do time:", err);
      setViewingPlayers([]);
      setViewingCoach(null);
    } finally {
      setViewingLoading(false);
    }
  };

  const getViewingFormationSlots = (team, playersList) => {
    if (!team || !playersList) return [];
    const sortedPlayers = [...playersList].sort((a, b) => b.rating - a.rating);

    const attackPositions = ["ST", "CF", "LF", "RF", "LW", "RW"];
    const midfieldPositions = ["CM", "CDM", "CAM", "LM", "RM", "LCM", "RCM", "LDM", "RDM", "LAM", "RAM"];
    const defensePositions = ["CB", "RCB", "LCB", "LB", "RB", "LWB", "RWB", "SW"];

    const gksPool = sortedPlayers.filter((p) => p.position === "GK");
    const defsPool = sortedPlayers.filter((p) => defensePositions.includes(p.position));
    const midsPool = sortedPlayers.filter((p) => midfieldPositions.includes(p.position));
    const attsPool = sortedPlayers.filter((p) => attackPositions.includes(p.position));

    const assignedIds = new Set();

    const assignFromPool = (pool, count) => {
      const selected = [];
      for (const p of pool) {
        if (!assignedIds.has(p.id)) {
          selected.push(p);
          assignedIds.add(p.id);
          if (selected.length === count) break;
        }
      }
      return selected;
    };

    let slots = [];
    const formation = team.formation || "4-3-3";

    if (formation === "4-4-2") {
      slots = [
        { role: "GK", title: "GK", x: 50, y: 88 },
        { role: "DEF", title: "LE", x: 15, y: 70 },
        { role: "DEF", title: "ZAG", x: 38, y: 72 },
        { role: "DEF", title: "ZAG", x: 62, y: 72 },
        { role: "DEF", title: "LD", x: 85, y: 70 },
        { role: "MID", title: "ME", x: 15, y: 46 },
        { role: "MID", title: "MC", x: 38, y: 48 },
        { role: "MID", title: "MC", x: 62, y: 48 },
        { role: "MID", title: "MD", x: 85, y: 46 },
        { role: "ATT", title: "ATA", x: 35, y: 15 },
        { role: "ATT", title: "ATA", x: 65, y: 15 },
      ];
    } else if (formation === "3-5-2") {
      slots = [
        { role: "GK", title: "GK", x: 50, y: 88 },
        { role: "DEF", title: "ZAE", x: 25, y: 72 },
        { role: "DEF", title: "ZAG", x: 50, y: 74 },
        { role: "DEF", title: "ZAD", x: 75, y: 72 },
        { role: "MID", title: "VOL", x: 35, y: 54 },
        { role: "MID", title: "VOL", x: 65, y: 54 },
        { role: "MID", title: "ME", x: 12, y: 40 },
        { role: "MID", title: "MEI", x: 50, y: 34 },
        { role: "MID", title: "MD", x: 88, y: 40 },
        { role: "ATT", title: "ATA", x: 35, y: 14 },
        { role: "ATT", title: "ATA", x: 65, y: 14 },
      ];
    } else if (formation === "4-2-3-1") {
      slots = [
        { role: "GK", title: "GK", x: 50, y: 88 },
        { role: "DEF", title: "LE", x: 15, y: 70 },
        { role: "DEF", title: "ZAG", x: 38, y: 72 },
        { role: "DEF", title: "ZAG", x: 62, y: 72 },
        { role: "DEF", title: "LD", x: 85, y: 70 },
        { role: "MID", title: "VOL", x: 35, y: 52 },
        { role: "MID", title: "VOL", x: 65, y: 52 },
        { role: "MID", title: "ME", x: 18, y: 32 },
        { role: "MID", title: "MEI", x: 50, y: 28 },
        { role: "MID", title: "MD", x: 82, y: 32 },
        { role: "ATT", title: "ATA", x: 50, y: 10 },
      ];
    } else if (formation === "3-4-3") {
      slots = [
        { role: "GK", title: "GK", x: 50, y: 88 },
        { role: "DEF", title: "ZAE", x: 25, y: 72 },
        { role: "DEF", title: "ZAG", x: 50, y: 74 },
        { role: "DEF", title: "ZAD", x: 75, y: 72 },
        { role: "MID", title: "ME", x: 12, y: 48 },
        { role: "MID", title: "MC", x: 38, y: 50 },
        { role: "MID", title: "MC", x: 62, y: 50 },
        { role: "MID", title: "MD", x: 88, y: 48 },
        { role: "ATT", title: "PE", x: 20, y: 18 },
        { role: "ATT", title: "ATA", x: 50, y: 12 },
        { role: "ATT", title: "PD", x: 80, y: 18 },
      ];
    } else if (formation === "5-3-2") {
      slots = [
        { role: "GK", title: "GK", x: 50, y: 88 },
        { role: "DEF", title: "LWE", x: 12, y: 68 },
        { role: "DEF", title: "ZAE", x: 30, y: 72 },
        { role: "DEF", title: "ZAG", x: 50, y: 74 },
        { role: "DEF", title: "ZAD", x: 70, y: 72 },
        { role: "DEF", title: "LWD", x: 88, y: 68 },
        { role: "MID", title: "MC", x: 28, y: 46 },
        { role: "MID", title: "MC", x: 50, y: 48 },
        { role: "MID", title: "MC", x: 72, y: 46 },
        { role: "ATT", title: "ATA", x: 35, y: 15 },
        { role: "ATT", title: "ATA", x: 65, y: 15 },
      ];
    } else {
      // 4-3-3 (Padrão)
      slots = [
        { role: "GK", title: "GK", x: 50, y: 88 },
        { role: "DEF", title: "LE", x: 15, y: 70 },
        { role: "DEF", title: "ZAG", x: 38, y: 72 },
        { role: "DEF", title: "ZAG", x: 62, y: 72 },
        { role: "DEF", title: "LD", x: 85, y: 70 },
        { role: "MID", title: "MC", x: 25, y: 46 },
        { role: "MID", title: "MC", x: 50, y: 50 },
        { role: "MID", title: "MC", x: 75, y: 46 },
        { role: "ATT", title: "PE", x: 20, y: 18 },
        { role: "ATT", title: "ATA", x: 50, y: 12 },
        { role: "ATT", title: "PD", x: 80, y: 18 },
      ];
    }

    const gkCount = slots.filter((s) => s.role === "GK").length;
    const defCount = slots.filter((s) => s.role === "DEF").length;
    const midCount = slots.filter((s) => s.role === "MID").length;
    const attCount = slots.filter((s) => s.role === "ATT").length;

    const selectedGks = assignFromPool(gksPool, gkCount);
    const selectedDefs = assignFromPool(defsPool, defCount);
    const selectedMids = assignFromPool(midsPool, midCount);
    const selectedAtts = assignFromPool(attsPool, attCount);

    const fillRemaining = (assignedList, count) => {
      let list = [...assignedList];
      if (list.length < count) {
        const remainingNeeded = count - list.length;
        const unassigned = sortedPlayers.filter((p) => !assignedIds.has(p.id));
        const extra = assignFromPool(unassigned, remainingNeeded);
        list = [...list, ...extra];
      }
      return list;
    };

    const finalGks = fillRemaining(selectedGks, gkCount);
    const finalDefs = fillRemaining(selectedDefs, defCount);
    const finalMids = fillRemaining(selectedMids, midCount);
    const finalAtts = fillRemaining(selectedAtts, attCount);

    let gkIdx = 0;
    let defIdx = 0;
    let midIdx = 0;
    let attIdx = 0;

    const autoSlots = slots.map((slot) => {
      let p = null;
      if (slot.role === "GK" && gkIdx < finalGks.length) p = finalGks[gkIdx++];
      else if (slot.role === "DEF" && defIdx < finalDefs.length) p = finalDefs[defIdx++];
      else if (slot.role === "MID" && midIdx < finalMids.length) p = finalMids[midIdx++];
      else if (slot.role === "ATT" && attIdx < finalAtts.length) p = finalAtts[attIdx++];
      return { ...slot, player: p };
    });

    const savedLineup = Array.isArray(team.lineup) ? team.lineup : [];
    const hasAnyStarters = savedLineup.some((id) => id !== null && id !== undefined);

    if (!hasAnyStarters) {
      return autoSlots;
    }

    return slots.map((slot, index) => {
      const playerId = savedLineup[index];
      let p = null;
      if (playerId) {
        p = sortedPlayers.find((player) => player.id.toString() === playerId.toString());
      }
      return { ...slot, player: p };
    });
  };

  const renderBracketMatch = (m) => {
    const isHomeWinner = m.status === "confirmed" && m.home_score > m.away_score;
    const isAwayWinner = m.status === "confirmed" && m.away_score > m.home_score;
    const isConfirmed = m.status === "confirmed";
    const isDispute = m.status === "dispute";

    return (
      <div
        key={m.id}
        className={`group p-3.5 rounded-2xl bg-gradient-to-br from-[#0c1220]/80 to-[#070b15]/95 border transition-all duration-300 shadow-xl flex flex-col gap-2 relative overflow-hidden select-none hover:scale-[1.02] ${
          isConfirmed 
            ? "border-emerald-500/10 hover:border-emerald-500/30 hover:shadow-emerald-500/5" 
            : isDispute 
            ? "border-red-500/20 hover:border-red-500/40 hover:shadow-red-500/5" 
            : "border-white/5 hover:border-white/20 hover:shadow-white/5"
        }`}
      >
        {/* Status Badge */}
        <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-wider mb-0.5">
          <span className="text-gray-500">Jogo #{m.id.toString().slice(-4)}</span>
          {isConfirmed ? (
            <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Finalizado</span>
          ) : isDispute ? (
            <span className="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded animate-pulse">Disputa</span>
          ) : m.reported_by ? (
            <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Validando</span>
          ) : (
            <span className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">Agendado</span>
          )}
        </div>

        {/* Home Team */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate min-w-0">
            <div className="h-5 w-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
              {m.home_team?.badge_url ? (
                <img src={m.home_team.badge_url} alt="" className="w-4 h-4 object-contain" />
              ) : (
                <span className="text-[10px]">🛡️</span>
              )}
            </div>
            <span className={`text-[11px] font-semibold truncate ${
              isConfirmed && !isHomeWinner ? "text-gray-500 line-through" : "text-white font-bold"
            }`}>
              {m.home_team?.name || "A definir"}
            </span>
          </div>
          {isConfirmed ? (
            <span className={`text-xs font-black px-1.5 py-0.5 rounded ${
              isHomeWinner ? "text-emerald-400 bg-emerald-500/10" : "text-gray-500"
            }`}>
              {m.home_score}
            </span>
          ) : m.reported_by ? (
            <span className="text-[10px] text-amber-400/80 font-bold bg-amber-500/5 px-1.5 rounded">{m.home_score}</span>
          ) : (
            <span className="text-[10px] text-gray-600 font-bold">-</span>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-white/5 my-0.5"></div>

        {/* Away Team */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate min-w-0">
            <div className="h-5 w-5 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
              {m.away_team?.badge_url ? (
                <img src={m.away_team.badge_url} alt="" className="w-4 h-4 object-contain" />
              ) : (
                <span className="text-[10px]">🛡️</span>
              )}
            </div>
            <span className={`text-[11px] font-semibold truncate ${
              isConfirmed && !isAwayWinner ? "text-gray-500 line-through" : "text-white font-bold"
            }`}>
              {m.away_team?.name || "A definir"}
            </span>
          </div>
          {isConfirmed ? (
            <span className={`text-xs font-black px-1.5 py-0.5 rounded ${
              isAwayWinner ? "text-emerald-400 bg-emerald-500/10" : "text-gray-500"
            }`}>
              {m.away_score}
            </span>
          ) : m.reported_by ? (
            <span className="text-[10px] text-amber-400/80 font-bold bg-amber-500/5 px-1.5 rounded">{m.away_score}</span>
          ) : (
            <span className="text-[10px] text-gray-600 font-bold">-</span>
          )}
        </div>
        
        {/* Subtle colored accent strip at the top */}
        <div className={`absolute top-0 left-0 w-full h-[2px] ${
          isConfirmed ? "bg-emerald-500/40" : isDispute ? "bg-red-500" : m.reported_by ? "bg-amber-500/40" : "bg-blue-500/20"
        }`}></div>
      </div>
    );
  };

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
      <div className="flex border-b border-white/5 gap-2">
        <button
          onClick={() => setActiveTab("table")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
            activeTab === "table"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          📈 Tabela
        </button>
        <button
          onClick={() => setActiveTab("scorers")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
            activeTab === "scorers"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          ⚽ Artilharia
        </button>
        <button
          onClick={() => setActiveTab("assists")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
            activeTab === "assists"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          跑 Assistências
        </button>
        <button
          onClick={() => setActiveTab("motm")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
            activeTab === "motm"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          ⭐ Melhor em Campo
        </button>
        <button
          onClick={() => setActiveTab("suspensions")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "suspensions"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          🟥 Suspensões
          {suspensions.length > 0 && (
            <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
              {suspensions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("cups")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "cups"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          🏆 Copas Mata-Mata
        </button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5 backdrop-blur-md">
          {/* TAB 1: Tabela de Classificação */}
          {activeTab === "table" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-[10px] font-bold uppercase text-gray-400 border-b border-white/5 bg-white/[0.01]">
                  <tr>
                    <th className="py-3 px-2 text-center w-12">Pos</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-3 text-center">P<Tooltip content="Pontos Ganhos (3 por vitória, 1 por empate)" /></th>
                    <th className="py-3 px-3 text-center">J<Tooltip content="Jogos Realizados" /></th>
                    <th className="py-3 px-3 text-center">V<Tooltip content="Vitórias" /></th>
                    <th className="py-3 px-3 text-center">E<Tooltip content="Empates" /></th>
                    <th className="py-3 px-3 text-center">D<Tooltip content="Derrotas" /></th>
                    <th className="py-3 px-3 text-center">GP<Tooltip content="Gols Pró (Gols Marcados)" /></th>
                    <th className="py-3 px-3 text-center">GC<Tooltip content="Gols Contra (Gols Sofridos)" /></th>
                    <th className="py-3 px-3 text-center">SG<Tooltip content="Saldo de Gols (Diferença entre GP e GC)" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                  {standings.map((lt, index) => {
                    const isZoneA = index < 2; // Zonas de promoção simbólicas
                    const isZoneB = index >= standings.length - 2 && standings.length > 4; // Rebaixamento
                    return (
                      <tr key={lt.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-2 text-center font-bold">
                          <span
                            className={`inline-block h-6 w-6 rounded-full leading-6 text-center text-xs ${
                              index === 0
                                ? "bg-amber-400 text-black shadow-lg shadow-amber-400/10"
                                : index === 1
                                ? "bg-slate-300 text-black"
                                : index === 2
                                ? "bg-amber-700 text-white"
                                : "text-gray-400 bg-white/5"
                            }`}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          <button
                            onClick={() => handleViewTeamRoster(lt.teams)}
                            className="flex items-center gap-2.5 text-left group hover:text-[#10b981] transition-all focus:outline-none"
                            title="Clique para ver o elenco e tática deste time"
                          >
                            <div className="h-6 w-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {lt.teams?.badge_url ? (
                                <img src={lt.teams.badge_url} alt="" className="h-full w-full object-contain" />
                              ) : (
                                <span className="text-xs">🛡️</span>
                              )}
                            </div>
                            <div>
                              <span className="font-bold border-b border-dashed border-transparent group-hover:border-[#10b981] transition-all">
                                {lt.teams?.name}
                              </span>
                              <span className="block text-[10px] text-gray-400 font-normal group-hover:text-emerald-400/80 transition-colors">
                                {lt.teams?.real_club_name}
                              </span>
                            </div>
                          </button>
                        </td>
                        <td className="py-3 px-3 text-center font-extrabold text-emerald-400">{lt.points}</td>
                        <td className="py-3 px-3 text-center font-medium">{lt.played}</td>
                        <td className="py-3 px-3 text-center text-gray-400">{lt.won}</td>
                        <td className="py-3 px-3 text-center text-gray-400">{lt.drawn}</td>
                        <td className="py-3 px-3 text-center text-gray-400">{lt.lost}</td>
                        <td className="py-3 px-3 text-center text-gray-400">{lt.goals_for}</td>
                        <td className="py-3 px-3 text-center text-gray-400">{lt.goals_against}</td>
                        <td className={`py-3 px-3 text-center font-bold ${lt.goals_difference > 0 ? "text-emerald-400" : lt.goals_difference < 0 ? "text-red-400" : "text-gray-400"}`}>
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
                              <img src={item.player.face_url} alt="" className="h-full w-full object-cover scale-110" />
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
                                <img src={item.team.badge_url} alt="" className="h-full w-full object-contain" />
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
                              <img src={item.player.face_url} alt="" className="h-full w-full object-cover scale-110" />
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
                                <img src={item.team.badge_url} alt="" className="h-full w-full object-contain" />
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
                              <img src={item.player.face_url} alt="" className="h-full w-full object-cover scale-110" />
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
                                <img src={item.team.badge_url} alt="" className="h-full w-full object-contain" />
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
                                <img src={susp.players.face_url} alt="" className="h-full w-full object-cover scale-110" />
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
                                  <img src={suspTeam.badge_url} alt="" className="h-full w-full object-contain" />
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
      {/* Modal de Visualização de Elenco e Formação Tática */}
      {viewingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-5xl p-6 sm:p-8 rounded-2xl border border-white/10 bg-[#090d16]/95 shadow-2xl my-8 flex flex-col gap-6 animate-fadeIn">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  🛡️ {viewingTeam.name}
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  {viewingTeam.real_club_name ? `${viewingTeam.real_club_name} • ` : ""}
                  Técnico: <span className="text-emerald-400 font-bold">{viewingCoach ? viewingCoach.display_name : "Sem técnico"}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setViewingTeam(null);
                  setViewingPlayers([]);
                  setViewingCoach(null);
                }}
                className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-xs transition-colors"
              >
                ✕ Fechar
              </button>
            </div>

            {viewingLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Coluna 1: Campo Tático (6 cols) */}
                <div className="lg:col-span-6 space-y-4">
                   <div className="flex justify-between items-center">
                     <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Esquema Tático ({viewingTeam.formation || "4-3-3"})</h3>
                     <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded font-semibold">Titulares</span>
                   </div>
                   
                   <div className="relative aspect-[4/3] w-full rounded-2xl bg-gradient-to-b from-emerald-800/90 to-emerald-950/95 border border-emerald-500/20 overflow-hidden shadow-2xl">
                     {/* Linhas do Campo */}
                     <div className="absolute inset-0 pointer-events-none">
                       {/* Bordas */}
                       <div className="absolute top-[5%] bottom-[5%] left-[5%] right-[5%] border border-white/10" />
                       {/* Linha do Meio de Campo */}
                       <div className="absolute top-1/2 left-[5%] right-[5%] h-px bg-white/15" />
                       {/* Círculo Central */}
                       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-white/15 rounded-full" />
                       {/* Ponto Central */}
                       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/30 rounded-full" />
                       {/* Grande Área Superior (Ataque) */}
                       <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[48%] h-[16%] border-b border-x border-white/10" />
                       {/* Grande Área Inferior (Goleiro) */}
                       <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2 w-[48%] h-[16%] border-t border-x border-white/10" />
                     </div>

                     {/* Mapeamento de Jogadores no Campo */}
                     {getViewingFormationSlots(viewingTeam, viewingPlayers).map((slot, index) => (
                       <div
                         key={index}
                         className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none"
                         style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                       >
                         {slot.player ? (
                           <div className="flex flex-col items-center animate-fadeIn">
                             <div className="relative h-11 w-11 sm:h-12 sm:w-12 rounded-lg bg-[#090d16]/95 border border-white/15 flex items-center justify-center overflow-hidden shadow-lg">
                               {/* Rating Badge */}
                               <span className="absolute top-0.5 left-1 text-[8px] font-black bg-[#060913]/90 rounded px-0.5 leading-none text-[#10b981]">
                                 {slot.player.rating}
                               </span>
                               {/* Position Badge */}
                               <span className="absolute bottom-0.5 right-1 text-[7px] font-bold text-gray-300 bg-[#060913]/90 rounded px-0.5 leading-none uppercase">
                                 {slot.title}
                               </span>
                               {slot.player.face_url ? (
                                 <img src={slot.player.face_url} alt="" className="h-full w-full object-cover scale-110" />
                               ) : (
                                 <span className="text-sm">👤</span>
                               )}
                             </div>
                             <span className="text-[9px] font-bold text-white bg-[#090d16]/80 rounded px-1 mt-1 truncate max-w-[65px] text-center">
                               {slot.player.common_name || slot.player.name.split(' ').pop()}
                             </span>
                           </div>
                         ) : (
                           /* Slot Vazio */
                           <div className="flex flex-col items-center">
                             <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border border-dashed border-white/20 bg-black/30 flex items-center justify-center text-[8px] text-gray-400 font-bold uppercase">
                               {slot.title}
                             </div>
                           </div>
                         )}
                       </div>
                     ))}
                   </div>
                   
                   {/* Banco de Reservas */}
                   <div className="space-y-2">
                     <div className="flex justify-between items-center">
                       <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Banco de Reservas</h4>
                       <span className="text-[9px] text-gray-500 font-semibold">Suplentes</span>
                     </div>
                     <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-white/5 border border-white/5 max-h-[140px] overflow-y-auto">
                       {(() => {
                         const slots = getViewingFormationSlots(viewingTeam, viewingPlayers);
                         const startIds = new Set(slots.map(s => s.player?.id).filter(Boolean));
                         const bench = viewingPlayers.filter(p => !startIds.has(p.id));
                         
                         return bench.map(p => (
                           <div key={p.id} className="flex items-center gap-1.5 bg-[#090d16]/60 border border-white/5 rounded-lg p-1 px-2.5 max-w-[140px] truncate" title={`${p.name} (${p.position})`}>
                             <span className="text-[9px] font-bold text-[#10b981] bg-[#10b981]/10 px-1 rounded">{p.rating}</span>
                             <span className="text-[9px] font-semibold text-gray-400 uppercase">{p.position}</span>
                             <span className="text-[10px] font-medium text-white truncate flex-1">{p.common_name || p.name.split(' ').pop()}</span>
                           </div>
                         ));
                       })()}
                       {viewingPlayers.length === 0 && <span className="text-[10px] text-gray-500 italic">Nenhum jogador no elenco</span>}
                     </div>
                   </div>
                 </div>

                {/* Coluna 2: Tabela de Detalhes dos Jogadores (6 cols) */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Elenco Completo ({viewingPlayers.length} jogadores)</h3>
                    <div className="text-[10px] text-gray-400">
                      Média de Over: <span className="text-emerald-400 font-bold">{viewingPlayers.length > 0 ? Math.round(viewingPlayers.reduce((sum, p) => sum + p.rating, 0) / viewingPlayers.length) : 0}</span>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#090d16]/20 max-h-[510px] overflow-y-auto">
                    <table className="w-full text-left text-sm text-gray-300 border-collapse">
                      <thead>
                        <tr className="text-[9px] font-bold uppercase text-gray-500 border-b border-white/5 bg-white/[0.01]">
                          <th className="py-2.5 px-3">Jogador</th>
                          <th className="py-2.5 px-3 text-center w-16">Posição</th>
                          <th className="py-2.5 px-3 text-center w-16">Rating</th>
                          <th className="py-2.5 px-3 text-right w-24">Valor</th>
                          <th className="py-2.5 px-3 text-right w-24">Salário</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs">
                        {viewingPlayers.map(p => (
                          <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-2 px-3 font-semibold text-white">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {p.face_url ? (
                                    <img src={p.face_url} alt="" className="h-full w-full object-cover scale-110" />
                                  ) : (
                                    <span>👤</span>
                                  )}
                                </div>
                                <span className="truncate" title={p.name}>{p.name}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center text-gray-400 font-bold uppercase">{p.position}</td>
                            <td className="py-2 px-3 text-center font-bold text-[#10b981]">{p.rating}</td>
                            <td className="py-2 px-3 text-right font-medium text-blue-400">R$ {parseFloat(p.value).toLocaleString("pt-BR")}</td>
                            <td className="py-2 px-3 text-right text-emerald-400">R$ {p.wage.toLocaleString("pt-BR")}</td>
                          </tr>
                        ))}
                        {viewingPlayers.length === 0 && (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-gray-500 italic">Nenhum jogador no time</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
