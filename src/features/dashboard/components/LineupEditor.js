"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AppImage } from "@/components/ui/AppImage";

const FORMATIONS = {
  "4-3-3": [
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
  ],
  "4-4-2": [
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
  ],
  "4-2-3-1": [
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
  ],
  "3-5-2": [
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
  ],
  "3-4-3": [
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
  ],
  "5-3-2": [
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
  ],
};

const attackPositions = ["ST", "CF", "LF", "RF", "LW", "RW"];
const midfieldPositions = ["CM", "CDM", "CAM", "LM", "RM", "LCM", "RCM", "LDM", "RDM", "LAM", "RAM"];
const defensePositions = ["CB", "RCB", "LCB", "LB", "RB", "LWB", "RWB", "SW"];

/**
 * LineupEditor
 * Editor de escalação tática com drag-and-drop e campo visual.
 * Props: team, players, onTeamUpdate
 */
export default function LineupEditor({ team, players, onTeamUpdate }) {
  const [draggingPlayer, setDraggingPlayer] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [savingFormation, setSavingFormation] = useState(false);
  const [savingEscalation, setSavingEscalation] = useState(false);
  const [saveError, setSaveError] = useState("");

  const getFormationSlots = () => {
    const slots = FORMATIONS[team.formation] || FORMATIONS["4-3-3"];
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

    const gkCount = slots.filter((s) => s.role === "GK").length;
    const defCount = slots.filter((s) => s.role === "DEF").length;
    const midCount = slots.filter((s) => s.role === "MID").length;
    const attCount = slots.filter((s) => s.role === "ATT").length;

    const fillRemaining = (list, count) => {
      if (list.length < count) {
        const extra = assignFromPool(sortedPlayers.filter((p) => !assignedIds.has(p.id)), count - list.length);
        return [...list, ...extra];
      }
      return list;
    };

    const finalGks = fillRemaining(assignFromPool(gksPool, gkCount), gkCount);
    const finalDefs = fillRemaining(assignFromPool(defsPool, defCount), defCount);
    const finalMids = fillRemaining(assignFromPool(midsPool, midCount), midCount);
    const finalAtts = fillRemaining(assignFromPool(attsPool, attCount), attCount);

    let gkIdx = 0, defIdx = 0, midIdx = 0, attIdx = 0;
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
    if (!hasAnyStarters) return autoSlots;

    return slots.map((slot, index) => {
      const playerId = savedLineup[index];
      const p = playerId ? players.find((pl) => pl.id.toString() === playerId.toString()) : null;
      return { ...slot, player: p };
    });
  };

  const fieldPlayers = getFormationSlots();
  const fieldPlayerIds = fieldPlayers.map((s) => s.player?.id).filter(Boolean);
  const benchPlayers = players.filter((p) => !fieldPlayerIds.includes(p.id));

  const handleFormationChange = async (newFormation) => {
    setSavingFormation(true);
    try {
      const { error } = await supabase.rpc("update_team_tactics", {
        p_formation: newFormation,
        p_lineup: Array.isArray(team.lineup) ? team.lineup : [],
      });
      if (!error) onTeamUpdate({ ...team, formation: newFormation });
    } catch (err) {
      console.error("Erro ao salvar formação:", err);
    } finally {
      setSavingFormation(false);
    }
  };

  const handleDropPlayerOnSlot = async (player, slotIndex) => {
    setSavingEscalation(true);
    setSaveError("");
    try {
      const currentLineup = Array.isArray(team.lineup) ? [...team.lineup] : Array(11).fill(null);
      const isLineupEmpty = !currentLineup.some((id) => id !== null && id !== undefined);
      let targetLineup = isLineupEmpty ? fieldPlayers.map((s) => s.player?.id || null) : currentLineup;

      const existingIndex = targetLineup.findIndex((id) => id && id.toString() === player.id.toString());
      const playerCurrentlyInSlot = targetLineup[slotIndex] || null;

      if (existingIndex !== -1) {
        // O jogador já estava no campo. Vamos colocar o jogador do slot de destino no slot antigo dele.
        targetLineup[existingIndex] = playerCurrentlyInSlot;
      }
      targetLineup[slotIndex] = player.id;

      // Otimista
      onTeamUpdate({ ...team, lineup: targetLineup });

      const { error } = await supabase.rpc("update_team_tactics", {
        p_formation: team.formation || "4-3-3",
        p_lineup: targetLineup,
      });
      if (error) {
        console.error("Erro Supabase:", error);
        onTeamUpdate(team);
        setSaveError("Não foi possível salvar a escalação. A alteração visual foi desfeita.");
      }
    } catch (err) {
      console.error("Erro ao salvar escalação:", err);
      onTeamUpdate(team);
      setSaveError("Não foi possível processar a escalação. Tente novamente.");
    } finally {
      setSavingEscalation(false);
    }
  };

  const handleRemovePlayerFromSlot = async (slotIndex) => {
    setSavingEscalation(true);
    try {
      const currentLineup = Array.isArray(team.lineup) ? [...team.lineup] : fieldPlayers.map((s) => s.player?.id || null);
      currentLineup[slotIndex] = null;
      const { error } = await supabase.rpc("update_team_tactics", {
        p_formation: team.formation || "4-3-3",
        p_lineup: currentLineup,
      });
      if (!error) onTeamUpdate({ ...team, lineup: currentLineup });
    } catch (err) {
      console.error("Erro ao remover jogador:", err);
    } finally {
      setSavingEscalation(false);
    }
  };



  return (
    <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-6">
      {saveError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {saveError}
        </div>
      )}
      {/* Header com seletor de formação */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white">Esquema Tático</h2>
          <p className="text-xs text-gray-400">
            Arraste jogadores do banco ou da lista para escalar.{" "}
            {savingEscalation && <span className="text-[#10b981] animate-pulse">Salvando...</span>}
          </p>
        </div>
        <select
          value={team.formation || "4-3-3"}
          onChange={(e) => handleFormationChange(e.target.value)}
          disabled={savingFormation}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#10b981]"
        >
          {Object.keys(FORMATIONS).map((f) => (
            <option key={f} value={f} className="bg-[#090d16] text-white">{f}</option>
          ))}
        </select>
      </div>

      {players.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm">
          Adicione jogadores para visualizar a escalação tática do seu clube.
        </div>
      ) : (
        <>
          {/* Campo Visual */}
          <div
            className="relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-emerald-900/60"
            style={{
              aspectRatio: "3/4",
              background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 40px), linear-gradient(180deg, #0a3d1a 0%, #0d4d22 25%, #0a3d1a 50%, #0d4d22 75%, #0a3d1a 100%)",
            }}
          >
            {/* Linhas do campo */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-[5%] border border-white/20 rounded-sm" />
              <div className="absolute top-1/2 left-[5%] right-[5%] h-px bg-white/20" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-white/20 rounded-full" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/40 rounded-full" />
              <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[48%] h-[16%] border-b border-x border-white/15" />
              <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[24%] h-[7%] border-b border-x border-white/10" />
              <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2 w-[48%] h-[16%] border-t border-x border-white/15" />
              <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2 w-[24%] h-[7%] border-t border-x border-white/10" />
              <div className="absolute bottom-[21%] left-1/2 -translate-x-1/2 w-20 h-10 border-t border-x border-white/10" style={{ borderRadius: "50% 50% 0 0" }} />
            </div>

            {/* Jogadores no campo */}
            {fieldPlayers.map((slot, index) => {
              const isHovered = dragOverSlot === index;
              const isDraggingActive = draggingPlayer !== null;
              return (
                <div
                  key={index}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverSlot(index); }}
                  onDragLeave={() => setDragOverSlot(null)}
                  onDrop={(e) => { e.preventDefault(); if (draggingPlayer) handleDropPlayerOnSlot(draggingPlayer, index); setDraggingPlayer(null); setDragOverSlot(null); }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none group"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                >
                  {slot.player ? (
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", slot.player.id.toString());
                        setDraggingPlayer(slot.player);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => { setDraggingPlayer(null); setDragOverSlot(null); }}
                      onDoubleClick={() => handleRemovePlayerFromSlot(index)}
                      className={`flex flex-col items-center animate-fadeIn relative cursor-grab active:cursor-grabbing transition-all duration-200 ${draggingPlayer?.id === slot.player?.id ? "opacity-40" : "opacity-100"}`}
                    >
                      <div className={`relative h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-[#090d16]/90 flex items-center justify-center overflow-hidden shadow-lg transition-all duration-200 ${isHovered ? "border-2 border-[#10b981] scale-110 shadow-[0_0_12px_#10b981aa]" : "border border-white/20 group-hover:scale-105 group-hover:border-[#10b981]/50"}`}>
                        <span className="absolute top-1 left-1 text-[10px] font-black bg-[#060913]/85 rounded px-1 leading-none shadow-sm z-10 text-[#10b981]">{slot.player.rating}</span>
                        <span className="absolute bottom-1 right-1 text-[8px] font-bold text-gray-300 bg-[#060913]/85 rounded px-1 leading-none uppercase z-10">{slot.title}</span>
                        {slot.player.face_url ? (
                          <AppImage src={slot.player.face_url} alt={slot.player.name} className="h-full w-full object-contain object-bottom" draggable={false} />
                        ) : (
                          <span className="text-xl">👤</span>
                        )}
                      </div>
                      <span className="mt-1 text-[10px] font-bold text-white bg-[#060913]/95 border border-white/10 rounded px-1.5 py-0.5 truncate max-w-[80px] shadow text-center leading-none">
                        {slot.player.name.split(" ").slice(-1)[0]}
                      </span>
                    </div>
                  ) : (
                    <div className={`flex flex-col items-center transition-all duration-200 ${isDraggingActive ? (isHovered ? "opacity-100 scale-110" : "opacity-70") : "opacity-45 hover:opacity-75"}`}>
                      <div className={`h-14 w-14 sm:h-16 sm:w-16 rounded-xl flex flex-col items-center justify-center transition-all duration-200 ${isHovered ? "bg-[#10b981]/20 border-2 border-[#10b981] shadow-[0_0_12px_#10b981aa] animate-pulse" : "bg-white/5 border border-dashed border-white/25"}`}>
                        <span className="text-[10px] font-bold text-gray-300">{slot.title}</span>
                        {isDraggingActive && !isHovered && <span className="text-[7px] text-gray-500 mt-0.5">SOLTAR</span>}
                        {isHovered && <span className="text-[7px] text-[#10b981] font-bold mt-0.5">AQUI ✓</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Banco de Reservas */}
          <div className="border-t border-white/5 pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Banco de Reservas ({benchPlayers.length})</h3>
              {draggingPlayer && <span className="text-[10px] text-[#10b981] animate-pulse">← Arraste para um slot do campo</span>}
            </div>
            {benchPlayers.length === 0 ? (
              <p className="text-xs text-gray-500">Todos os jogadores estão escalados no time titular.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-3">
                {benchPlayers.map((player) => (
                  <div
                    key={player.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", player.id.toString());
                      setDraggingPlayer(player);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => { setDraggingPlayer(null); setDragOverSlot(null); }}
                    title={`${player.name} — Arraste para escalar`}
                    className={`glass-card flex-shrink-0 w-20 p-2.5 rounded-xl border border-white/5 flex flex-col items-center justify-between text-center bg-[#090d16]/30 relative cursor-grab active:cursor-grabbing transition-all hover:border-[#10b981]/30 hover:bg-white/5 ${draggingPlayer?.id === player.id ? "opacity-40" : "opacity-100"}`}
                  >
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-extrabold text-[#10b981] bg-[#060913]/80 px-1 rounded leading-none">{player.rating}</span>
                    <span className="absolute top-1.5 right-1.5 text-[7px] font-bold text-gray-400 uppercase bg-[#060913]/80 px-1 rounded leading-none">{player.position}</span>
                    <div className="h-11 w-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden mt-3 mb-1">
                      {player.face_url ? <AppImage src={player.face_url} alt="" className="h-full w-full object-contain object-bottom" draggable={false} /> : <span className="text-lg">👤</span>}
                    </div>
                    <p className="text-[9px] font-bold text-white truncate w-full text-center leading-tight">{player.name.split(" ").slice(-1)[0]}</p>
                    <p className="text-[7px] text-gray-500 mt-0.5">arrastar ↑</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
