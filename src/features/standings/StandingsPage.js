"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { AppImage } from "@/components/ui/AppImage";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { StandingsView } from "@/features/standings/components/StandingsView";

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
        .order("goals_for", { ascending: false })
        .order("team_id", { ascending: true });

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

  useDeferredEffect(loadSeasons);

  useDeferredEffect(() => {
    if (selectedSeason) {
      loadLeagues(selectedSeason.id);
      loadCups(selectedSeason.id);
    } else {
      setLeagues([]);
      setSelectedLeague(null);
      setAllCups([]);
      setSelectedCup("");
    }
  }, selectedSeason?.id || "no-season");

  useDeferredEffect(() => {
    if (selectedCup && selectedSeason) loadCupMatches(selectedCup, selectedSeason.id);
    else setCupMatches([]);
  }, `${selectedSeason?.id || "no-season"}:${selectedCup || "no-cup"}`);

  useDeferredEffect(() => {
    if (selectedLeague) loadLeagueData(selectedLeague.id);
    else {
      setStandings([]);
      setTopScorers([]);
      setTopAssists([]);
      setTopMotm([]);
      setSuspensions([]);
    }
  }, selectedLeague?.id || "no-league");

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
          .from("public_profiles")
          .select("display_name")
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
                <AppImage src={m.home_team.badge_url} alt="" className="w-4 h-4 object-contain" />
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
                <AppImage src={m.away_team.badge_url} alt="" className="w-4 h-4 object-contain" />
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
    <StandingsView
      model={{
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
      }}
    />
  );
}
