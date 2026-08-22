"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AppImage } from "@/components/ui/AppImage";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { TeamRosterModal } from "@/components/features/TeamRosterModal";
import { MatchesView } from "@/features/matches/components/MatchesView";

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

export default function MatchesPage() {
  const [userProfile, setUserProfile] = useState(null);
  const [myTeam, setMyTeam] = useState(null);
  const [activeTab, setActiveTab] = useState("next"); // "next", "handshake", "history"
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para Toasts & Confirmações customizadas (Glassmorphism dark theme)
  const [toast, setToast] = useState(null); // { message: string, type: "success" | "error" | "info" }
  const [confirmModal, setConfirmModal] = useState(null); // { title: string, message: string, onConfirm: () => void, onCancel?: () => void }

  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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

  // Estados para visualizar elenco e formação de outro time
  const [viewingTeam, setViewingTeam] = useState(null);
  const [viewingPlayers, setViewingPlayers] = useState([]);
  const [viewingCoach, setViewingCoach] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);

  // Retrospecto de Clássicos (H2H)
  const [allTeams, setAllTeams] = useState([]);
  const [selectedOpponentId, setSelectedOpponentId] = useState("");
  const [h2hMatches, setH2hMatches] = useState([]);
  const [h2hLoading, setH2hLoading] = useState(false);

  const loadH2hMatches = async (oppId) => {
    if (!oppId || !myTeam) return;
    setH2hLoading(true);
    try {
      const { data, error } = await supabase
        .from("matches")
        .select(`
          *,
          home_team:teams!home_team_id(*),
          away_team:teams!away_team_id(*),
          seasons!season_id(name)
        `)
        .or(`and(home_team_id.eq.${myTeam.id},away_team_id.eq.${oppId}),and(home_team_id.eq.${oppId},away_team_id.eq.${myTeam.id})`)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setH2hMatches(data);
      } else {
        setH2hMatches([]);
      }
    } catch (err) {
      console.error("Erro ao carregar retrospecto:", err);
      setH2hMatches([]);
    } finally {
      setH2hLoading(false);
    }
  };

  const calculateH2hStats = () => {
    let myWins = 0;
    let oppWins = 0;
    let draws = 0;
    let myGols = 0;
    let oppGols = 0;

    h2hMatches.forEach((m) => {
      const isHome = m.home_team_id === myTeam.id;
      const homeScore = parseInt(m.home_score || 0);
      const awayScore = parseInt(m.away_score || 0);

      myGols += isHome ? homeScore : awayScore;
      oppGols += isHome ? awayScore : homeScore;

      if (homeScore === awayScore) {
        draws++;
      } else if (homeScore > awayScore) {
        if (isHome) myWins++;
        else oppWins++;
      } else {
        if (isHome) oppWins++;
        else myWins++;
      }
    });

    return { myWins, oppWins, draws, myGols, oppGols };
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

  useDeferredEffect(loadData);

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
          .from("match_schedule")
          .select("*")
          .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
          .order("round_number", { ascending: true });

        if (matchesData) {
          setMatches(matchesData);
        }
      }

      // Carregar todos os times para retrospecto
      const { data: allTeamsData } = await supabase
        .from("team_directory")
        .select("id, name, badge_url")
        .order("name", { ascending: true });
      if (allTeamsData) {
        setAllTeams(allTeamsData);
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
    setHomeScore(match.home_score !== null ? match.home_score.toString() : "");
    setAwayScore(match.away_score !== null ? match.away_score.toString() : "");
    setMotmPlayerId(match.motm_player_id !== null ? match.motm_player_id.toString() : "");

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

    // 4. Carregar eventos já reportados se for uma edição
    if (match.reported_by) {
      const { data: prevEvents } = await supabase
        .from("match_events")
        .select("*")
        .eq("match_id", match.id);

      if (prevEvents && prevEvents.length > 0) {
        setEvents(prevEvents.map(ev => ({
          id: ev.id.toString(),
          player_id: ev.player_id.toString(),
          team_id: ev.team_id,
          event_type: ev.event_type,
          minute: ev.minute !== null ? ev.minute.toString() : "",
        })));
      } else {
        setEvents([]);
      }
    } else {
      setEvents([]);
    }
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
      showToast("Favor preencher os gols de ambos os times.", "error");
      return;
    }

    try {
      const validEvents = events
        .filter(ev => ev.player_id !== "")
        .map(ev => ({
          team_id: ev.team_id,
          player_id: parseInt(ev.player_id),
          event_type: ev.event_type,
          minute: ev.minute ? parseInt(ev.minute) : null,
        }));

      const { data, error } = await supabase.rpc("report_match", {
        p_match_id: reportingMatch.id,
        p_home_score: parseInt(homeScore),
        p_away_score: parseInt(awayScore),
        p_motm_player_id: motmPlayerId ? parseInt(motmPlayerId) : null,
        p_events_json: validEvents,
      });
      if (error || !data?.success) throw error || new Error("Não foi possível registrar a partida.");

      showToast("Placar reportado! Aguardando confirmação do adversário.", "success");
      setReportingMatch(null);
      loadData();
    } catch (err) {
      showToast("Erro ao reportar placar: " + err.message, "error");
    }
  };

  // Confirmar Partida (Handshake)
  const handleConfirmMatch = async (matchId) => {
    setConfirmModal({
      title: "Confirmar Placar",
      message: "Deseja confirmar este resultado? Isso atualizará a classificação oficial da liga.",
      onConfirm: async () => {
        const { data, error } = await supabase.rpc("confirm_match", { p_match_id: matchId });

        if (error || (data && !data.success)) {
          showToast("Erro ao confirmar partida: " + (error?.message || data?.message), "error");
        } else {
          showToast("Partida homologada com sucesso!", "success");
          loadData();
        }
      }
    });
  };

  // Contestar Partida (Disputa)
  const handleDisputeMatch = async (e) => {
    e.preventDefault();
    if (!disputeReason.trim()) {
      showToast("Por favor, explique o motivo da contestação.", "error");
      return;
    }

    const { data, error } = await supabase.rpc("dispute_match", {
      p_match_id: disputingMatch.id,
      p_reason: disputeReason,
      p_proof_url: disputeProofUrl || null,
    });

    if (error || (data && !data.success)) {
      showToast("Erro ao abrir disputa: " + (error?.message || data?.message), "error");
    } else {
      showToast("Disputa registrada. O administrador irá analisar as provas.", "success");
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
    <MatchesView
      model={{
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
      }}
    />
  );
}
