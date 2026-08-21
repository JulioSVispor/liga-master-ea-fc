"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

  useEffect(() => {
    loadData();
  }, []);

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
                                  <img src={match.home_team.badge_url} alt="" className="w-4 h-4 object-contain inline-block" />
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
                                  <img src={match.away_team.badge_url} alt="" className="w-4 h-4 object-contain inline-block" />
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
                        <img src={match.home_team.badge_url} alt="" className="w-4 h-4 object-contain inline-block" />
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
                        <img src={match.away_team.badge_url} alt="" className="w-4 h-4 object-contain inline-block" />
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
      {/* Modal de Visualização de Elenco e Formação Tática */}
      {viewingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
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
