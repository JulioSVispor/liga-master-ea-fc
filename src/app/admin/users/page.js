"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminService } from "@/services/adminService";
import { AppImage } from "@/components/ui/AppImage";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { AdminUsersView } from "@/app/admin/users/_components/AdminUsersView";

// ─── Tooltip ℹ️ ─────────────────────────────────
function Tooltip({ content }) {
  const [visible, setVisible] = useState(false);
  return (
    <span 
      className="relative inline-block ml-1 cursor-pointer group text-gray-500 hover:text-white select-none"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      ℹ️
      {visible && (
        <span className="absolute z-[100] w-56 p-3 text-[10px] font-normal text-gray-200 bg-[#0c101d] border border-white/10 rounded-xl shadow-2xl -top-2 left-6 leading-relaxed transition-opacity animate-fadeIn normal-case whitespace-normal">
          {content}
        </span>
      )}
    </span>
  );
}

// ─── Toast / Notification Alert ─────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`fixed bottom-5 right-5 z-[200] p-4 rounded-xl text-xs border flex items-center gap-3 shadow-2xl animate-fadeIn ${
      type === "error" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    }`}>
      <span>{type === "error" ? "⚠️" : "✅"}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:text-white font-bold">✕</button>
    </div>
  );
}

// ─── Confirmation Modal ─────────────────────────────────
function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 animate-fadeIn">
      <div className="w-full max-w-sm glass-panel p-6 rounded-2xl border border-white/10 bg-[#090d16] shadow-2xl space-y-4">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-white">{title}</h4>
          <p className="text-xs text-gray-400 leading-relaxed">{message}</p>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-white/5 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-5 py-2 text-xs font-bold text-white transition-all shadow-lg shadow-emerald-500/10"
          >
            {confirmText || "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null); // Para modal de finanças
  const [editBudget, setEditBudget] = useState("");
  const [editWageCap, setEditWageCap] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Toast State
  const [toast, setToast] = useState({ message: "", type: "success" });
  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  // Confirm Modal State
  const [confirm, setConfirm] = useState({ isOpen: false, title: "", message: "", onConfirm: null, confirmText: "Confirmar" });
  const triggerConfirm = (title, message, onConfirm, confirmText = "Confirmar") => {
    setConfirm({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirm({ isOpen: false, title: "", message: "", onConfirm: null, confirmText: "Confirmar" });
      },
      confirmText
    });
  };

  // Estados para modal de gerenciamento de elenco
  const [squadModalOpen, setSquadModalOpen] = useState(false);
  const [selectedTeamForSquad, setSelectedTeamForSquad] = useState(null);
  const [squadPlayers, setSquadPlayers] = useState([]);
  const [squadLoading, setSquadLoading] = useState(false);
  const [allTeams, setAllTeams] = useState([]);
  const [squadFilter, setSquadFilter] = useState("");
  
  // Estados para edição inline de jogador
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editPlayerWage, setEditPlayerWage] = useState("");
  const [editPlayerValue, setEditPlayerValue] = useState("");

  // Novos estados para aba de atribuição de agentes livres
  const [activeSquadTab, setActiveSquadTab] = useState("current"); // "current" | "free_agents"
  const [freeAgents, setFreeAgents] = useState([]);
  const [freeAgentsLoading, setFreeAgentsLoading] = useState(false);
  const [freeAgentsFilter, setFreeAgentsFilter] = useState("");

  // Carregar Agentes Livres (Sem Time)
  const loadFreeAgents = async () => {
    setFreeAgentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .is("team_id", null)
        .order("rating", { ascending: false });

      if (error) throw error;
      setFreeAgents(data || []);
    } catch (err) {
      console.error("Erro ao carregar agentes livres:", err);
    } finally {
      setFreeAgentsLoading(false);
    }
  };

  // Adicionar Agente Livre ao Time
  const handleAddFreeAgentToTeam = async (player) => {
    if (!selectedTeamForSquad) return;
    try {
      await adminService.movePlayer(supabase, {
        playerId: player.id,
        targetTeamId: selectedTeamForSquad.id,
        reason: "Atribuição administrativa de agente livre",
      });

      showToast(`Jogador ${player.name} adicionado com sucesso ao ${selectedTeamForSquad.name}!`);
      
      // Atualizar estados locais
      setFreeAgents((prev) => prev.filter((p) => p.id !== player.id));
      refreshSquad(selectedTeamForSquad.id);
    } catch (err) {
      showToast("Erro ao adicionar jogador ao time: " + err.message, "error");
    }
  };

  // Carrega todos os usuários e seus times
  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          display_name,
          email,
          role,
          whatsapp,
          teams (
            id,
            name,
            real_club_name,
            budget,
            max_wage_cap
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);

      // Carregar todos os times cadastrados
      const { data: allTeamsData } = await supabase
        .from("teams")
        .select("id, name, user_id")
        .order("name", { ascending: true });
      setAllTeams(allTeamsData || []);
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
      showToast("Erro ao carregar lista de usuários: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useDeferredEffect(loadUsers);

  // Alterar role do usuário (admin <-> user)
  const handleToggleRole = (userId, currentRole) => {
    const nextRole = currentRole === "admin" ? "user" : "admin";
    
    triggerConfirm(
      "Alterar Nível de Acesso",
      `Tem certeza de que deseja alterar o nível de acesso deste usuário para ${nextRole.toUpperCase()}?`,
      async () => {
        setActionLoading(userId);
        try {
          await adminService.setUserRole(supabase, userId, nextRole);
          
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u))
          );
          showToast("Nível de acesso atualizado com sucesso!");
        } catch (err) {
          showToast("Erro ao alterar nível de acesso: " + err.message, "error");
        } finally {
          setActionLoading(null);
        }
      }
    );
  };

  // Abrir modal de edição de finanças
  const openFinancesModal = (team) => {
    setSelectedTeam(team);
    setEditBudget(team.budget.toString());
    setEditWageCap(team.max_wage_cap.toString());
    setModalOpen(true);
  };

  // Salvar finanças
  const handleSaveFinances = async (e) => {
    e.preventDefault();
    if (!selectedTeam) return;

    setActionLoading(selectedTeam.id);
    try {
      const budgetVal = parseFloat(editBudget);
      const wageCapVal = parseFloat(editWageCap);

      if (isNaN(budgetVal) || isNaN(wageCapVal)) {
        showToast("Valores inválidos!", "error");
        return;
      }

      await adminService.updateTeamFinancials(supabase, {
        teamId: selectedTeam.id,
        budget: budgetVal,
        maxWageCap: wageCapVal,
        reason: "Ajuste manual no painel de usuários",
      });

      await loadUsers();
      setModalOpen(false);
      setSelectedTeam(null);
      showToast("Finanças do time atualizadas com sucesso!");
    } catch (err) {
      showToast("Erro ao salvar finanças: " + err.message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Liberar elenco (Resetar elenco)
  const handleResetSquad = (teamId, teamName) => {
    triggerConfirm(
      "Resetar Elenco Completo",
      `ATENÇÃO: Tem certeza que deseja liberar TODO o elenco do time "${teamName}"? Todos os jogadores dele voltarão a ser Agentes Livres no mercado. Esta ação é irreversível e ficará registrada no Histórico.`,
      async () => {
        setActionLoading(teamId);
        try {
          const { data, error } = await supabase.rpc("reset_squad", {
            p_team_id: teamId,
          });

          if (error) throw error;

          if (data && data.success) {
            showToast(data.message);
            await loadUsers();
          } else {
            showToast(data.message || "Erro desconhecido ao liberar elenco.", "error");
          }
        } catch (err) {
          showToast("Erro ao liberar elenco: " + err.message, "error");
        } finally {
          setActionLoading(null);
        }
      }
    );
  };

  // Abrir modal de elenco e carregar jogadores
  const openSquadModal = async (team) => {
    setSelectedTeamForSquad(team);
    setSquadModalOpen(true);
    setSquadLoading(true);
    setSquadFilter("");
    setFreeAgentsFilter("");
    setActiveSquadTab("current");
    setEditingPlayerId(null);
    try {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("team_id", team.id)
        .order("rating", { ascending: false });

      if (error) throw error;
      setSquadPlayers(data || []);
      await loadFreeAgents();
    } catch (err) {
      console.error("Erro ao carregar elenco:", err);
      showToast("Erro ao carregar elenco: " + err.message, "error");
    } finally {
      setSquadLoading(false);
    }
  };

  // Recarregar o elenco atual
  const refreshSquad = async (teamId) => {
    setSquadLoading(true);
    try {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("team_id", teamId)
        .order("rating", { ascending: false });

      if (error) throw error;
      setSquadPlayers(data || []);
    } catch (err) {
      console.error("Erro ao recarregar elenco:", err);
    } finally {
      setSquadLoading(false);
    }
  };

  // Salvar edição direta de salário/passe do jogador
  const handleSavePlayerEdit = async (player) => {
    const wageVal = parseFloat(editPlayerWage);
    const valueVal = parseFloat(editPlayerValue);

    if (isNaN(wageVal) || isNaN(valueVal)) {
      showToast("Valores inválidos!", "error");
      return;
    }

    try {
      await adminService.updatePlayerFinancials(supabase, {
        playerId: player.id,
        wage: wageVal,
        value: valueVal,
        reason: "Edição manual pelo painel administrativo",
      });

      showToast(`Jogador ${player.name} atualizado com sucesso!`);
      setEditingPlayerId(null);
      refreshSquad(player.team_id);
    } catch (err) {
      showToast("Erro ao editar jogador: " + err.message, "error");
    }
  };

  // Iniciar edição do jogador
  const startEditPlayer = (player) => {
    setEditingPlayerId(player.id);
    setEditPlayerWage(player.wage.toString());
    setEditPlayerValue(player.value.toString());
  };

  // Transferir / Devolver jogador para outro time
  const handleTransferPlayer = (player, targetTeamId) => {
    const targetTeam = allTeams.find(t => t.id === targetTeamId);
    const targetTeamName = targetTeam ? targetTeam.name : "Agente Livre";
    
    const confirmMsg = targetTeamId 
      ? `Deseja transferir o jogador ${player.name} para o time "${targetTeamName}"?`
      : `Deseja devolver/liberar o jogador ${player.name} como Agente Livre?`;

    triggerConfirm(
      targetTeamId ? "Transferir Jogador" : "Liberar para o Mercado",
      confirmMsg,
      async () => {
        try {
          await adminService.movePlayer(supabase, {
            playerId: player.id,
            targetTeamId: targetTeamId || null,
            reason: targetTeamId
              ? `Transferência administrativa para ${targetTeamName}`
              : "Liberação administrativa para agentes livres",
          });

          showToast("Transferência realizada com sucesso!");
          refreshSquad(player.team_id);
        } catch (err) {
          showToast("Erro ao transferir: " + err.message, "error");
        }
      }
    );
  };

  // Liberar jogador diretamente
  const handleReleasePlayerDirect = (player) => {
    triggerConfirm(
      "Liberar Jogador para Agente Livre",
      `Tem certeza de que deseja liberar ${player.name} para o mercado? Ele se tornará Agente Livre.`,
      async () => {
        try {
          await adminService.movePlayer(supabase, {
            playerId: player.id,
            targetTeamId: null,
            reason: "Liberação administrativa para agentes livres",
          });

          showToast("Jogador dispensado com sucesso!");
          refreshSquad(player.team_id);
        } catch (err) {
          showToast("Erro ao dispensar jogador: " + err.message, "error");
        }
      }
    );
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <AdminUsersView
      model={{
      showToast,
      triggerConfirm,
      loadFreeAgents,
      handleAddFreeAgentToTeam,
      loadUsers,
      handleToggleRole,
      openFinancesModal,
      handleSaveFinances,
      handleResetSquad,
      openSquadModal,
      refreshSquad,
      handleSavePlayerEdit,
      startEditPlayer,
      handleTransferPlayer,
      handleReleasePlayerDirect,
      loading,
      setLoading,
      users,
      setUsers,
      selectedTeam,
      setSelectedTeam,
      editBudget,
      setEditBudget,
      editWageCap,
      setEditWageCap,
      modalOpen,
      setModalOpen,
      actionLoading,
      setActionLoading,
      toast,
      setToast,
      confirm,
      setConfirm,
      squadModalOpen,
      setSquadModalOpen,
      selectedTeamForSquad,
      setSelectedTeamForSquad,
      squadPlayers,
      setSquadPlayers,
      squadLoading,
      setSquadLoading,
      allTeams,
      setAllTeams,
      squadFilter,
      setSquadFilter,
      editingPlayerId,
      setEditingPlayerId,
      editPlayerWage,
      setEditPlayerWage,
      editPlayerValue,
      setEditPlayerValue,
      activeSquadTab,
      setActiveSquadTab,
      freeAgents,
      setFreeAgents,
      freeAgentsLoading,
      setFreeAgentsLoading,
      freeAgentsFilter,
      setFreeAgentsFilter,
      }}
    />
  );
}
