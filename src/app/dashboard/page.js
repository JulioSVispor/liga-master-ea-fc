"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Função de cálculo de Química e Penalidades de Posicionamento (Fase 3)
const getAdjustedRating = (player, slotTitle) => {
  if (!player) return { rating: 0, penalty: 0 };
  
  const nat = player.position.toUpperCase();
  const slot = slotTitle.toUpperCase();
  
  if (nat === slot) return { rating: player.rating, penalty: 0 };
  
  const isDef = ["CB", "LB", "RB", "LWB", "RWB", "ZAG", "LE", "LD", "ZAE", "ZAD", "LWE", "LWD"].includes(nat) && 
                ["CB", "LB", "RB", "LWB", "RWB", "ZAG", "LE", "LD", "ZAE", "ZAD", "LWE", "LWD"].includes(slot);
  const isMid = ["CM", "CDM", "CAM", "LM", "RM", "VOL", "MC", "MEI", "ME", "MD"].includes(nat) && 
                ["CM", "CDM", "CAM", "LM", "RM", "VOL", "MC", "MEI", "ME", "MD"].includes(slot);
  const isAtt = ["ST", "CF", "LF", "RF", "LW", "RW", "PE", "PD", "ATA"].includes(nat) && 
                ["ST", "CF", "LF", "RF", "LW", "RW", "PE", "PD", "ATA"].includes(slot);
  
  if ((nat === "GK" && slot !== "GK") || (nat !== "GK" && slot === "GK")) {
    return { rating: Math.max(10, player.rating - 30), penalty: 30, type: "severa" };
  }
  
  if (isDef || isMid || isAtt) {
    const equivalents = [
      ["CB", "ZAG"], ["CB", "ZAE"], ["CB", "ZAD"],
      ["LB", "LE"], ["LB", "LWE"],
      ["RB", "LD"], ["RB", "LWD"],
      ["ST", "ATA"], ["CF", "ATA"],
      ["LW", "PE"], ["RW", "PD"],
      ["CDM", "VOL"], ["CAM", "MEI"],
      ["LM", "ME"], ["RM", "MD"], ["CM", "MC"]
    ];
    
    const isEquivalent = equivalents.some(pair => 
      (pair[0] === nat && pair[1] === slot) || (pair[1] === nat && pair[0] === slot)
    );
    
    if (isEquivalent) {
      return { rating: player.rating, penalty: 0 };
    }
    
    return { rating: Math.max(10, player.rating - 5), penalty: 5, type: "leve" };
  }
  
  return { rating: Math.max(10, player.rating - 15), penalty: 15, type: "moderada" };
};

export default function UserDashboard() {
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [savingFormation, setSavingFormation] = useState(false);

  // Estados de Escalação Manual (Fase 3)
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);
  const [showEscalationModal, setShowEscalationModal] = useState(false);
  const [savingEscalation, setSavingEscalation] = useState(false);

  // Carregar dados do clube e do elenco
  const loadClubData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Carregar Time
      const { data: teamData } = await supabase
        .from("teams")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (teamData) {
        setTeam(teamData);

        // Carregar elenco completo
        const { data: squad } = await supabase
          .from("players")
          .select("*")
          .eq("team_id", teamData.id)
          .order("rating", { ascending: false });

        setPlayers(squad || []);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do clube:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClubData();
  }, []);

  // Dispensa de jogador (reembolso e liberação de folha salarial)
  const handleReleasePlayer = async (player) => {
    if (!team) return;

    const confirmRelease = window.confirm(
      `Tem certeza que deseja dispensar ${player.name}? \nIsso liberará R$ ${player.wage.toLocaleString("pt-BR")} de folha salarial e reembolsará R$ ${parseFloat(player.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} no seu orçamento.`
    );

    if (!confirmRelease) return;

    setActionLoading(player.id);

    try {
      const { data, error } = await supabase.rpc("release_player", {
        p_player_id: player.id,
        p_team_id: team.id,
      });

      if (error) throw error;

      if (data && data.success) {
        alert(data.message);
        
        // Recarregar tudo para consistência com o histórico e finanças
        await loadClubData();
      } else {
        alert(data.message || "Houve uma falha ao tentar dispensar o jogador.");
      }
    } catch (err) {
      alert("Erro ao dispensar: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Mudar formação tática
  const handleFormationChange = async (newFormation) => {
    if (!team) return;
    setSavingFormation(true);
    try {
      const { error } = await supabase
        .from("teams")
        .update({ formation: newFormation })
        .eq("id", team.id);

      if (error) throw error;

      setTeam((prev) => ({
        ...prev,
        formation: newFormation,
      }));
    } catch (err) {
      console.error("Erro ao salvar formação:", err);
      alert("Erro ao salvar formação: " + err.message);
    } finally {
      setSavingFormation(false);
    }
  };

  // Escalar jogador em um slot manual (Fase 3)
  const handleSelectPlayerForSlot = async (player) => {
    if (selectedSlotIndex === null || !team) return;

    setSavingEscalation(true);
    try {
      const currentLineup = Array.isArray(team.lineup) ? [...team.lineup] : Array(11).fill(null);
      
      const isLineupEmpty = !currentLineup.some(id => id !== null && id !== undefined);
      let targetLineup = currentLineup;
      
      if (isLineupEmpty) {
        targetLineup = fieldPlayers.map(s => s.player?.id || null);
      }

      const existingIndex = targetLineup.findIndex(id => id && id.toString() === player.id.toString());
      if (existingIndex !== -1) {
        const playerInTargetSlot = targetLineup[selectedSlotIndex];
        targetLineup[existingIndex] = playerInTargetSlot || null;
      }

      targetLineup[selectedSlotIndex] = player.id;

      const { error } = await supabase
        .from("teams")
        .update({ lineup: targetLineup })
        .eq("id", team.id);

      if (error) throw error;

      setTeam(prev => ({
        ...prev,
        lineup: targetLineup
      }));

      setShowEscalationModal(false);
      setSelectedSlotIndex(null);
    } catch (err) {
      alert("Erro ao salvar escalação: " + err.message);
    } finally {
      setSavingEscalation(false);
    }
  };

  // Remover jogador de um slot manual (Fase 3)
  const handleRemovePlayerFromSlot = async (slotIndex) => {
    if (!team) return;

    setSavingEscalation(true);
    try {
      const currentLineup = Array.isArray(team.lineup) ? [...team.lineup] : fieldPlayers.map(s => s.player?.id || null);
      currentLineup[slotIndex] = null;

      const { error } = await supabase
        .from("teams")
        .update({ lineup: currentLineup })
        .eq("id", team.id);

      if (error) throw error;

      setTeam(prev => ({
        ...prev,
        lineup: currentLineup
      }));

      setShowEscalationModal(false);
      setSelectedSlotIndex(null);
    } catch (err) {
      alert("Erro ao remover jogador da escalação: " + err.message);
    } finally {
      setSavingEscalation(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="glass-card p-8 text-center rounded-2xl max-w-xl mx-auto mt-10">
        <span className="text-4xl block mb-2">⚠️</span>
        <h2 className="text-xl font-bold text-white mb-2">Nenhum Clube Encontrado</h2>
        <p className="text-sm text-gray-400 mb-6">
          Sua conta de usuário não possui uma equipe associada nesta liga.
        </p>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/register";
          }}
          className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all"
        >
          Registrar Novo Time
        </button>
      </div>
    );
  }

  // Agrupamentos táticos para listagem
  const attackPositions = ["ST", "CF", "LF", "RF", "LW", "RW"];
  const midfieldPositions = ["CM", "CDM", "CAM", "LM", "RM", "LCM", "RCM", "LDM", "RDM", "LAM", "RAM"];
  const defensePositions = ["CB", "RCB", "LCB", "LB", "RB", "LWB", "RWB", "SW"];

  const goalkeepers = players.filter((p) => p.position === "GK");
  const defenders = players.filter((p) => defensePositions.includes(p.position));
  const midfielders = players.filter((p) => midfieldPositions.includes(p.position));
  const attackers = players.filter((p) => attackPositions.includes(p.position));
  const others = players.filter(
    (p) =>
      p.position !== "GK" &&
      !attackPositions.includes(p.position) &&
      !midfieldPositions.includes(p.position) &&
      !defensePositions.includes(p.position)
  );

  // Estatísticas do clube
  const avgRating = players.length > 0 ? Math.round(players.reduce((sum, p) => sum + p.rating, 0) / players.length) : 0;
  const squadWages = players.reduce((sum, p) => sum + parseFloat(p.wage || 0), 0);

  // Algoritmo de mapeamento de jogadores para slots do campo
  const getFormationSlots = () => {
    const sortedPlayers = [...players].sort((a, b) => b.rating - a.rating);
    
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
        { role: "ATT", title: "ATA", x: 65, y: 15 }
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
        { role: "ATT", title: "ATA", x: 65, y: 14 }
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
        { role: "ATT", title: "ATA", x: 50, y: 10 }
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
        { role: "ATT", title: "PD", x: 80, y: 18 }
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
        { role: "ATT", title: "ATA", x: 65, y: 15 }
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
        { role: "ATT", title: "PD", x: 80, y: 18 }
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
    const hasAnyStarters = savedLineup.some(id => id !== null && id !== undefined);

    if (!hasAnyStarters) {
      return autoSlots;
    }

    return slots.map((slot, index) => {
      const playerId = savedLineup[index];
      let p = null;
      if (playerId) {
        p = players.find(player => player.id.toString() === playerId.toString());
      }
      return { ...slot, player: p };
    });
  };

  const fieldPlayers = getFormationSlots();
  const fieldPlayerIds = fieldPlayers.map(s => s.player?.id).filter(id => id !== undefined && id !== null);
  const benchPlayers = players.filter(p => !fieldPlayerIds.includes(p.id));

  const renderPlayerCategory = (title, categoryPlayers) => {
    if (categoryPlayers.length === 0) return null;

    return (
      <div className="space-y-4 pt-4">
        <h3 className="text-sm font-bold text-[#3b82f6] uppercase tracking-wider border-l-2 border-[#3b82f6] pl-2">
          {title} ({categoryPlayers.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {categoryPlayers.map((player) => (
            <div
              key={player.id}
              className="glass-card rounded-xl overflow-hidden flex flex-col justify-between border border-white/5 bg-[#090d16]/30 relative"
            >
              {/* Overall & Posição no Topo */}
              <div className="absolute top-3 left-3 flex flex-col items-center">
                <span className="text-xl font-black text-white leading-none">{player.rating}</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{player.position}</span>
              </div>

              {/* Avatar e Nome */}
              <div className="pt-6 pb-2 px-4 flex flex-col items-center">
                <div className="h-16 w-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden mb-2">
                  {player.face_url ? (
                    <img src={player.face_url} alt={player.name} className="h-full w-full object-cover scale-110" />
                  ) : (
                    <span className="text-2xl text-gray-600">👤</span>
                  )}
                </div>
                <p className="text-xs font-bold text-white text-center truncate w-full">{player.name}</p>
                <p className="text-[9px] text-gray-500">{player.nation || "Desconhecida"} • {player.age || "--"} anos</p>
              </div>

              {/* Detalhes Financeiros */}
              <div className="p-3 bg-white/[0.01] border-t border-white/5 space-y-3">
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Valor: <strong className="text-emerald-400">R$ {(player.value / 1000).toFixed(0)}k</strong></span>
                  <span>Salário: <strong className="text-gray-300">R$ {player.wage.toLocaleString("pt-BR")}</strong></span>
                </div>
                <button
                  onClick={() => handleReleasePlayer(player)}
                  disabled={actionLoading !== null}
                  className="w-full rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 py-1.5 text-[10px] font-bold text-red-400 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading === player.id ? "Dispensando..." : "Dispensar Jogador"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Painel do Clube
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Gerencie o elenco do seu time, acompanhe as finanças e verifique o teto salarial.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/scouting"
            className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-4 py-2.5 text-xs font-bold text-white shadow transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Contratar Jogadores
          </Link>
        </div>
      </div>

      {/* Visão de Finanças do Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Orçamento Disponível</span>
          <p className="text-2xl font-black text-emerald-400">
            R$ {parseFloat(team.budget).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-gray-500 mt-1 block">Para contratações e lances de leilão</span>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Folha Salarial Semanal</span>
          <p className="text-2xl font-black text-gray-200">
            R$ {squadWages.toLocaleString("pt-BR")}
          </p>
          <span className="text-[10px] text-gray-500 mt-1 block">Teto máximo definido: R$ {parseFloat(team.max_wage_cap).toLocaleString("pt-BR")}</span>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Tamanho do Elenco</span>
          <p className="text-2xl font-black text-white">{players.length} / 24</p>
          <span className="text-[10px] text-gray-500 mt-1 block">Jogadores contratados no time</span>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Rating Médio do Time</span>
          <p className="text-2xl font-black text-[#f59e0b]">⭐ {avgRating}</p>
          <span className="text-[10px] text-gray-500 mt-1 block">Força média do time principal</span>
        </div>
      </div>

      {/* Campo Visual Tático */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Esquema Tático</h2>
            <p className="text-xs text-gray-400">Jogadores escalados automaticamente pelo maior rating.</p>
          </div>
          <div>
            <select
              value={team.formation || "4-3-3"}
              onChange={(e) => handleFormationChange(e.target.value)}
              disabled={savingFormation}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#10b981]"
            >
              <option value="4-3-3" className="bg-[#090d16] text-white">4-3-3</option>
              <option value="4-4-2" className="bg-[#090d16] text-white">4-4-2</option>
              <option value="4-2-3-1" className="bg-[#090d16] text-white">4-2-3-1</option>
              <option value="3-5-2" className="bg-[#090d16] text-white">3-5-2</option>
              <option value="3-4-3" className="bg-[#090d16] text-white">3-4-3</option>
              <option value="5-3-2" className="bg-[#090d16] text-white">5-3-2</option>
            </select>
          </div>
        </div>

        {players.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            Adicione jogadores para visualizar a escalação tática do seu clube.
          </div>
        ) : (
          /* Campo de Futebol */
          <div className="relative w-full max-w-2xl mx-auto aspect-[3/4] sm:aspect-[4/5] md:aspect-[3/4] bg-gradient-to-b from-[#0d2b17] to-[#144224] rounded-2xl overflow-hidden border border-emerald-500/25 shadow-2xl p-4">
            {/* Linhas do Campo */}
            <div className="absolute inset-4 border border-white/10 rounded-lg pointer-events-none">
              {/* Linha do Meio de Campo */}
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
              {/* Círculo Central */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 border border-white/10 rounded-full" />
              {/* Ponto Central */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/25 rounded-full" />
              {/* Grande Área Superior (Ataque) */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[15%] border-b border-x border-white/10" />
              {/* Grande Área Inferior (Goleiro) */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[15%] border-t border-x border-white/10" />
            </div>

            {/* Mapeamento de Jogadores */}
            {fieldPlayers.map((slot, index) => {
              const chem = getAdjustedRating(slot.player, slot.title);
              
              return (
                <div
                  key={index}
                  onClick={() => {
                    setSelectedSlotIndex(index);
                    setShowEscalationModal(true);
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none group cursor-pointer"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                >
                  {slot.player ? (
                    /* Card do Jogador (Mini FUT) */
                    <div className="flex flex-col items-center animate-fadeIn relative">
                      <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-[#090d16]/90 border border-white/10 flex items-center justify-center overflow-hidden shadow-lg group-hover:scale-110 group-hover:border-[#10b981] transition-all duration-300">
                        {/* Rating Badge */}
                        <span className={`absolute top-1 left-1.5 text-[10px] font-black bg-[#060913]/85 rounded px-1 leading-none shadow-sm z-10 ${
                          chem.penalty > 0 ? "text-orange-400" : "text-[#10b981]"
                        }`}>
                          {chem.rating}
                        </span>
                        {/* Position Badge */}
                        <span className="absolute bottom-1 right-1 text-[8px] font-bold text-gray-400 bg-[#060913]/85 rounded px-1 leading-none uppercase z-10">
                          {slot.player.position}
                        </span>
                        {slot.player.face_url ? (
                          <img
                            src={slot.player.face_url}
                            alt={slot.player.name}
                            className="h-full w-full object-cover scale-110"
                          />
                        ) : (
                          <span className="text-xl">👤</span>
                        )}
                      </div>
                      
                      {chem.penalty > 0 && (
                        <span className="absolute -top-2.5 right-0 text-[8px] font-bold bg-orange-500/10 border border-orange-500/20 text-orange-400 px-1 rounded shadow animate-pulse">
                          -{chem.penalty}
                        </span>
                      )}

                      {/* Nome do Jogador */}
                      <span className="mt-1 text-[10px] font-bold text-white bg-[#060913]/95 border border-white/5 rounded px-1.5 py-0.5 truncate max-w-[80px] shadow text-center leading-none">
                        {slot.player.name.split(" ").slice(-1)[0]}
                      </span>
                    </div>
                  ) : (
                    /* Slot Vazio */
                    <div className="flex flex-col items-center opacity-45 hover:opacity-85 transition-opacity">
                      <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-white/5 border border-dashed border-white/20 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-gray-400">{slot.title}</span>
                      </div>
                      <span className="mt-1 text-[9px] text-gray-500 font-semibold uppercase">Escalar</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Banco de Reservas */}
        {players.length > 0 && (
          <div className="border-t border-white/5 pt-6 space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
              Banco de Reservas ({benchPlayers.length})
            </h3>
            {benchPlayers.length === 0 ? (
              <p className="text-xs text-gray-500">Todos os jogadores estão escalados no time titular.</p>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {benchPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="glass-card flex-shrink-0 w-24 p-3 rounded-xl border border-white/5 flex flex-col items-center justify-between text-center bg-[#090d16]/30 relative"
                  >
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-extrabold text-[#10b981] bg-white/5 px-1 rounded leading-none">
                      {player.rating}
                    </span>
                    <span className="absolute top-1.5 right-1.5 text-[8px] font-bold text-gray-400 uppercase">
                      {player.position}
                    </span>
                    
                    <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden mb-2 mt-2">
                      {player.face_url ? (
                        <img src={player.face_url} alt="" className="h-full w-full object-cover scale-110" />
                      ) : (
                        <span className="text-lg">👤</span>
                      )}
                    </div>
                    
                    <p className="text-[10px] font-bold text-white truncate w-full mb-1">
                      {player.name.split(" ").slice(-1)[0]}
                    </p>
                    
                    <button
                      onClick={() => {
                        alert("Clique em um slot do campo para substituir ou escalar este jogador!");
                      }}
                      className="w-full rounded bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 border border-[#3b82f6]/20 py-1 text-[8px] font-bold text-[#3b82f6] transition-all"
                    >
                      Escalar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista do Elenco Agrupado */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-6">
        <div className="border-b border-white/5 pb-4">
          <h2 className="text-lg font-bold text-white">Elenco do Clube</h2>
          <p className="text-xs text-gray-400">Jogadores organizados por setor tático.</p>
        </div>

        {players.length === 0 ? (
          <div className="py-16 text-center">
            <span className="text-4xl block mb-2">跑‍♂️</span>
            <p className="text-sm text-gray-400 mb-4">Seu elenco está vazio. Comece a contratar atletas livres!</p>
            <Link
              href="/dashboard/scouting"
              className="rounded-lg bg-[#10b981] hover:bg-[#059669] px-4 py-2 text-xs font-semibold text-white transition-all"
            >
              Ir para o Olheiro
            </Link>
          </div>
        ) : (
          <div className="space-y-8 divide-y divide-white/5">
            {renderPlayerCategory("Goleiros", goalkeepers)}
            {renderPlayerCategory("Defensores", defenders)}
            {renderPlayerCategory("Meias", midfielders)}
            {renderPlayerCategory("Atacantes", attackers)}
            {renderPlayerCategory("Outros", others)}
          </div>
        )}
      </div>

      {/* Modal de Escalação / Substituição (Fase 3) */}
      {showEscalationModal && selectedSlotIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md max-h-[500px] flex flex-col justify-between p-6 rounded-2xl border border-white/10 bg-[#090d16]/95 shadow-2xl text-left">
            <div className="border-b border-white/5 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-white">Escalar Jogador</h3>
                <p className="text-[10px] text-gray-400">Escolha um jogador para a posição de {fieldPlayers[selectedSlotIndex]?.title}</p>
              </div>
              <button
                onClick={() => {
                  setShowEscalationModal(false);
                  setSelectedSlotIndex(null);
                }}
                className="text-gray-400 hover:text-white text-xs bg-white/5 px-2.5 py-1 rounded-lg"
              >
                Fechar
              </button>
            </div>

            {/* Listagem de jogadores do elenco */}
            <div className="flex-1 overflow-y-auto py-4 space-y-2 pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {fieldPlayers[selectedSlotIndex]?.player && (
                <button
                  onClick={() => handleRemovePlayerFromSlot(selectedSlotIndex)}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-xs font-bold text-red-400 transition-all mb-2"
                >
                  ❌ Remover da Posição (Mandar pro Banco)
                </button>
              )}

              {players.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">Nenhum jogador disponível no elenco.</p>
              ) : (
                players.map((p) => {
                  const isAlreadyStarters = fieldPlayers.some(s => s.player?.id === p.id);
                  const chem = getAdjustedRating(p, fieldPlayers[selectedSlotIndex]?.title);
                  
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPlayerForSlot(p)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                        isAlreadyStarters
                          ? "bg-[#3b82f6]/5 border-[#3b82f6]/20 hover:bg-[#3b82f6]/10"
                          : "bg-white/5 border-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                          {p.face_url ? (
                            <img src={p.face_url} alt="" className="h-full w-full object-cover scale-110" />
                          ) : (
                            <span className="text-lg">👤</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-white flex items-center gap-1.5">
                            {p.name}
                            {isAlreadyStarters && (
                              <span className="text-[8px] bg-[#3b82f6]/20 text-[#3b82f6] px-1 rounded uppercase font-bold">Titular</span>
                            )}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Nat: <strong className="text-white">{p.position}</strong> • Over: <strong className="text-white">{p.rating}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-xs font-black block ${
                          chem.penalty > 0 ? "text-orange-400" : "text-[#10b981]"
                        }`}>
                          Rating {chem.rating}
                        </span>
                        {chem.penalty > 0 && (
                          <span className="text-[8.5px] text-orange-400">Fora de Posição (-{chem.penalty})</span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
