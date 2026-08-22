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
import { AdminLeaguesView } from "@/app/admin/leagues/_components/AdminLeaguesView";

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
  const { requestConfirmation, confirmationProps } = useConfirmation();

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

  useDeferredEffect(() => {
    loadSeasons();
    loadAllTeams();
  });

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
    if (selectedLeague) {
      loadLeagueTeams(selectedLeague.id);
      loadLeagueMatches(selectedLeague.id);
    } else {
      setLeagueTeams([]);
      setActiveMatches([]);
    }
  }, selectedLeague?.id || "no-league");

  useDeferredEffect(() => {
    if (selectedCup && selectedSeason) loadCupMatches(selectedCup, selectedSeason.id);
    else setCupMatches([]);
  }, `${selectedSeason?.id || "no-season"}:${selectedCup || "no-cup"}`);

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
    const confirmed = await requestConfirmation({
      title: "Remover clube da divisão",
      message: "O clube será removido desta divisão. A operação será bloqueada se já houver partidas vinculadas.",
      confirmLabel: "Remover clube",
      intent: "danger",
    });
    if (!confirmed) return;

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

    const confirmed = await requestConfirmation({
      title: "Gerar calendário da liga",
      message: `Serão gerados confrontos para ${leagueTeams.length} clubes. Apenas partidas ainda não disputadas poderão ser substituídas.`,
      confirmLabel: "Gerar calendário",
    });
    if (!confirmed) return;
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
      const startRound = cupStartPhase === "quartas" ? 1 : cupStartPhase === "semi" ? 2 : 3;

      await adminService.createCup(supabase, {
        seasonId: selectedSeason.id,
        cupName: newCupName,
        startRound,
        teamIds: shuffledTeams,
      });

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

    const confirmGen = await requestConfirmation({
      title: "Gerar próxima fase",
      message: `Os classificados da copa ${selectedCup} serão pareados na próxima fase. A operação não pode ser repetida.`,
      confirmLabel: "Gerar próxima fase",
    });
    if (!confirmGen) return;

    try {
      await adminService.advanceCup(supabase, {
        seasonId: selectedSeason.id,
        cupName: selectedCup,
        currentRound: currentPhase,
      });

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
    <AdminLeaguesView
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
  );
}
