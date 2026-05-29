"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function UserDashboard() {
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [savingFormation, setSavingFormation] = useState(false);

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

    return slots.map((slot) => {
      let p = null;
      if (slot.role === "GK" && gkIdx < finalGks.length) p = finalGks[gkIdx++];
      else if (slot.role === "DEF" && defIdx < finalDefs.length) p = finalDefs[defIdx++];
      else if (slot.role === "MID" && midIdx < finalMids.length) p = finalMids[midIdx++];
      else if (slot.role === "ATT" && attIdx < finalAtts.length) p = finalAtts[attIdx++];

      return { ...slot, player: p };
    });
  };

  const fieldPlayers = getFormationSlots();

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
            {fieldPlayers.map((slot, index) => (
              <div
                key={index}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none group"
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              >
                {slot.player ? (
                  /* Card do Jogador (Mini FUT) */
                  <div className="flex flex-col items-center animate-fadeIn">
                    <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-[#090d16]/90 border border-white/10 flex items-center justify-center overflow-hidden shadow-lg group-hover:scale-110 group-hover:border-[#10b981] transition-all duration-300">
                      {/* Rating Badge */}
                      <span className="absolute top-1 left-1.5 text-[10px] font-black text-[#10b981] bg-[#060913]/85 rounded px-1 leading-none shadow-sm z-10">
                        {slot.player.rating}
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
                    {/* Nome do Jogador */}
                    <span className="mt-1 text-[10px] font-bold text-white bg-[#060913]/95 border border-white/5 rounded px-1.5 py-0.5 truncate max-w-[80px] shadow text-center leading-none">
                      {slot.player.name.split(" ").slice(-1)[0]} {/* Apenas o sobrenome */}
                    </span>
                  </div>
                ) : (
                  /* Slot Vazio */
                  <div className="flex flex-col items-center opacity-40">
                    <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-white/5 border border-dashed border-white/10 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-500">{slot.title}</span>
                    </div>
                    <span className="mt-1 text-[9px] text-gray-500 font-semibold uppercase">Vazio</span>
                  </div>
                )}
              </div>
            ))}
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
            <span className="text-4xl block mb-2">🏃‍♂️</span>
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
    </div>
  );
}
