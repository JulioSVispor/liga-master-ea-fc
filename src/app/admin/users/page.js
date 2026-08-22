"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminService } from "@/services/adminService";

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
      const { error } = await supabase
        .from("players")
        .update({ team_id: selectedTeamForSquad.id })
        .eq("id", player.id);

      if (error) throw error;

      // Registrar no histórico de transferências
      await supabase
        .from("transfer_history")
        .insert({
          player_id: player.id,
          player_name: player.name,
          player_position: player.position,
          player_rating: player.rating,
          player_face_url: player.face_url,
          from_team_id: null,
          from_team_name: "Agente Livre",
          to_team_id: selectedTeamForSquad.id,
          to_team_name: selectedTeamForSquad.name,
          amount: player.value,
          transfer_type: "trade"
        });

      // Notificar treinador
      if (selectedTeamForSquad.user_id) {
        await supabase.from("notifications").insert({
          user_id: selectedTeamForSquad.user_id,
          title: "Jogador Adicionado pelo Admin 🏃‍♂️",
          content: `O administrador adicionou o jogador ${player.name} (${player.position}, Over ${player.rating}) ao elenco do seu time.`
        });
      }

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

  useEffect(() => {
    loadUsers();
  }, []);

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
      const { error } = await supabase
        .from("players")
        .update({
          wage: wageVal,
          value: valueVal
        })
        .eq("id", player.id);

      if (error) throw error;

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
          const { error } = await supabase
            .from("players")
            .update({ team_id: targetTeamId || null })
            .eq("id", player.id);

          if (error) throw error;

          // Registrar no histórico de transferências
          await supabase
            .from("transfer_history")
            .insert({
              player_id: player.id,
              player_name: player.name,
              player_position: player.position,
              player_rating: player.rating,
              player_face_url: player.face_url,
              from_team_id: player.team_id,
              from_team_name: selectedTeamForSquad.name,
              to_team_id: targetTeamId || null,
              to_team_name: targetTeamName,
              amount: player.value,
              transfer_type: targetTeamId ? "trade" : "release"
            });

          // Notificar os envolvidos
          const notificationEntries = [];
          if (selectedTeamForSquad.user_id) {
            notificationEntries.push({
              user_id: selectedTeamForSquad.user_id,
              title: "Jogador Movido pelo Admin",
              content: `O jogador ${player.name} foi removido do seu elenco por intervenção do administrador.`
            });
          }
          if (targetTeamId && targetTeam?.user_id) {
            notificationEntries.push({
              user_id: targetTeam.user_id,
              title: "Jogador Adicionado pelo Admin",
              content: `O jogador ${player.name} foi adicionado ao seu elenco por intervenção do administrador.`
            });
          }

          if (notificationEntries.length > 0) {
            await supabase.from("notifications").insert(notificationEntries);
          }

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
          const { error } = await supabase
            .from("players")
            .update({ team_id: null })
            .eq("id", player.id);

          if (error) throw error;

          // Registrar histórico
          await supabase
            .from("transfer_history")
            .insert({
              player_id: player.id,
              player_name: player.name,
              player_position: player.position,
              player_rating: player.rating,
              player_face_url: player.face_url,
              from_team_id: player.team_id,
              from_team_name: selectedTeamForSquad.name,
              to_team_id: null,
              to_team_name: "Agente Livre",
              amount: player.value,
              transfer_type: "release"
            });

          // Notificar treinador
          if (selectedTeamForSquad.user_id) {
            await supabase.from("notifications").insert({
              user_id: selectedTeamForSquad.user_id,
              title: "Jogador Dispensado (Admin)",
              content: `O jogador ${player.name} foi dispensado e liberado para Agentes Livres por intervenção do admin.`
            });
          }

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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Treinadores & Equipes
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Gerencie os treinadores registrados, ajuste orçamentos e controle os elencos de cada clube.
        </p>
      </div>

      {/* Banner de Ajuda */}
      <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#090d16]/40 flex items-start gap-4">
        <span className="text-2xl mt-0.5">📋</span>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-white">Central de Gerenciamento</h4>
          <p className="text-xs text-gray-400 leading-relaxed">
            Neste painel você pode definir quais membros possuem cargo de **Admin** (acesso a este painel administrativo), 
            gerenciar as finanças individuais das equipes (Orçamento de transferências e Teto Salarial) e organizar 
            os elencos ativos clicando no botão **⚽ Elenco**.
          </p>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4">
                  Nome / Treinador
                  <Tooltip content="Nome de exibição, e-mail e contato de WhatsApp do participante cadastrado." />
                </th>
                <th className="px-6 py-4">
                  Nível
                  <Tooltip content="Nível de privilégios. Admins podem acessar e realizar modificações em todo o painel de administração." />
                </th>
                <th className="px-6 py-4">
                  Time na Liga
                  <Tooltip content="Time criado pelo usuário na liga associado ao seu clube real de referência." />
                </th>
                <th className="px-6 py-4">
                  Orçamento
                  <Tooltip content="Saldo disponível do clube para realizar transferências de jogadores e dar lances em leilões." />
                </th>
                <th className="px-6 py-4">
                  Teto Salarial
                  <Tooltip content="O limite máximo permitido para a soma de salários de todos os jogadores ativos no elenco." />
                </th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                    Nenhum treinador cadastrado.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const rawTeam = user.teams;
                  const teamData = Array.isArray(rawTeam) ? rawTeam[0] : rawTeam;
                  return (
                    <tr key={user.id} className="hover:bg-white/[0.01] transition-colors">
                      {/* Nome/E-mail */}
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-white">{user.display_name || "Treinador"}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                          {user.whatsapp && (
                            <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                              📞 {user.whatsapp}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Cargo */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            user.role === "admin"
                              ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                              : "bg-gray-400/10 text-gray-400 border border-gray-400/20"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>

                      {/* Time */}
                      <td className="px-6 py-4">
                        {teamData ? (
                          <div>
                            <p className="font-semibold text-white text-xs">{teamData.name}</p>
                            <p className="text-[10px] text-gray-500">{teamData.real_club_name}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500 italic">Sem time</span>
                        )}
                      </td>

                      {/* Orçamento */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-emerald-400 font-bold">
                        {teamData
                          ? `R$ ${parseFloat(teamData.budget).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}`
                          : "--"}
                      </td>

                      {/* Teto Salarial */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-300 font-bold">
                        {teamData
                          ? `R$ ${parseFloat(teamData.max_wage_cap).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}`
                          : "--"}
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex justify-center items-center gap-2">
                          <button
                            onClick={() => handleToggleRole(user.id, user.role)}
                            disabled={actionLoading !== null}
                            title="Conceder ou remover cargo administrativo"
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              user.role === "admin"
                                ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/25"
                                : "bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/25"
                            }`}
                          >
                            {user.role === "admin" ? "Demover" : "Tornar Admin"}
                          </button>

                          {teamData && (
                            <>
                              <button
                                onClick={() => openSquadModal(teamData)}
                                disabled={actionLoading !== null}
                                title="Visualizar e gerenciar jogadores do elenco"
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all"
                              >
                                ⚽ Elenco
                              </button>
                              <button
                                onClick={() => openFinancesModal(teamData)}
                                disabled={actionLoading !== null}
                                title="Editar orçamento de contratação e limite teto salarial"
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25 transition-all"
                              >
                                Orçamento
                              </button>
                              <button
                                onClick={() => handleResetSquad(teamData.id, teamData.name)}
                                disabled={actionLoading !== null}
                                title="Liberar todos os jogadores do time para agentes livres (Irreversível)"
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-all"
                              >
                                Resetar Elenco
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Finanças */}
      {modalOpen && selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fadeIn">
          <div className="w-full max-w-md glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 bg-[#090d16] shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-base font-bold text-white">Ajustar Finanças - {selectedTeam.name}</h3>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setSelectedTeam(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form noValidate onSubmit={handleSaveFinances} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-300 font-semibold">Orçamento de Transferências (Saldo R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editBudget}
                  onChange={(e) => setEditBudget(e.target.value)}
                  required
                  placeholder="Orçamento"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-300 font-semibold">Teto Salarial (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editWageCap}
                  onChange={(e) => setEditWageCap(e.target.value)}
                  required
                  placeholder="Teto de salários"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setSelectedTeam(null);
                  }}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-white/5 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading !== null}
                  className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-5 py-2 text-xs font-bold text-white transition-all disabled:opacity-50"
                >
                  {actionLoading ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Elenco */}
      {squadModalOpen && selectedTeamForSquad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
          <div className="w-full max-w-4xl glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 bg-[#090d16] shadow-2xl space-y-6 my-8">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Gerenciar Elenco - {selectedTeamForSquad.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Transfira, edite ou dispense jogadores deste clube.</p>
              </div>
              <button
                onClick={() => {
                  setSquadModalOpen(false);
                  setSelectedTeamForSquad(null);
                  setSquadPlayers([]);
                }}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Tabs de Elenco */}
            <div className="flex border-b border-white/5 gap-2">
              <button
                type="button"
                onClick={() => setActiveSquadTab("current")}
                className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
                  activeSquadTab === "current"
                    ? "border-[#10b981] text-[#10b981]"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                📋 Elenco Atual ({squadPlayers.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveSquadTab("free_agents");
                  loadFreeAgents();
                }}
                className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
                  activeSquadTab === "free_agents"
                    ? "border-[#10b981] text-[#10b981]"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                ➕ Contratar Agentes Livres ({freeAgents.length})
              </button>
            </div>

            {activeSquadTab === "current" ? (
              <>
                {/* Barra de Filtro */}
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Filtrar jogadores do elenco por nome ou posição..."
                    value={squadFilter}
                    onChange={(e) => setSquadFilter(e.target.value)}
                    className="w-full max-w-md bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-[#10b981]"
                  />
                </div>

                {/* Lista de Jogadores do Elenco */}
                {squadLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#10b981] border-t-transparent"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-white/5 rounded-xl max-h-96 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02] font-bold text-gray-400 uppercase tracking-wider">
                          <th className="px-4 py-3">Jogador</th>
                          <th className="px-4 py-3">Classificação</th>
                          <th className="px-4 py-3">Posição</th>
                          <th className="px-4 py-3">Salário</th>
                          <th className="px-4 py-3">Valor Passe</th>
                          <th className="px-4 py-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-gray-200">
                        {squadPlayers
                          .filter(p => {
                            const q = squadFilter.toLowerCase();
                            return (p.name || "").toLowerCase().includes(q) || (p.position || "").toLowerCase().includes(q);
                          })
                          .map(player => {
                            const isEditing = editingPlayerId === player.id;
                            return (
                              <tr key={player.id} className="hover:bg-white/[0.01]">
                                <td className="px-4 py-3 flex items-center gap-2">
                                  {player.face_url ? (
                                    <img src={player.face_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                                  ) : (
                                    <span className="text-sm">👤</span>
                                  )}
                                  <span className="font-semibold text-white">{player.name}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-0.5 rounded bg-white/5 text-white font-bold">
                                    {player.rating}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-gray-400">{player.position}</span>
                                </td>
                                <td className="px-4 py-3">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      value={editPlayerWage}
                                      onChange={(e) => setEditPlayerWage(e.target.value)}
                                      className="w-20 bg-[#060913] border border-white/10 rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:border-[#10b981]"
                                    />
                                  ) : (
                                    `R$ ${parseFloat(player.wage).toLocaleString("pt-BR")}`
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      value={editPlayerValue}
                                      onChange={(e) => setEditPlayerValue(e.target.value)}
                                      className="w-24 bg-[#060913] border border-white/10 rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:border-[#10b981]"
                                    />
                                  ) : (
                                    `R$ ${parseFloat(player.value).toLocaleString("pt-BR")}`
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <div className="flex justify-center items-center gap-2">
                                    {isEditing ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleSavePlayerEdit(player)}
                                          className="px-2 py-1 bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 hover:bg-[#10b981] hover:text-white rounded transition-colors"
                                        >
                                          ✓ Salvar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingPlayerId(null)}
                                          className="px-2 py-1 bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 rounded transition-colors"
                                        >
                                          Cancelar
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => startEditPlayer(player)}
                                          className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500 hover:text-white rounded transition-all"
                                        >
                                          ✏️ Editar
                                        </button>
                                        
                                        <select
                                          onChange={(e) => {
                                            if (e.target.value !== "") {
                                              handleTransferPlayer(player, e.target.value === "free" ? null : e.target.value);
                                              e.target.value = "";
                                            }
                                          }}
                                          defaultValue=""
                                          className="bg-[#090d16] border border-white/10 rounded px-2 py-1 text-xs text-gray-300 outline-none cursor-pointer focus:border-[#10b981]"
                                        >
                                          <option value="" disabled>🔄 Mover...</option>
                                          <option value="free">Agente Livre</option>
                                          {allTeams
                                            .filter(t => t.id !== selectedTeamForSquad.id)
                                            .map(t => (
                                              <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>

                                        <button
                                          type="button"
                                          onClick={() => handleReleasePlayerDirect(player)}
                                          className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white rounded transition-all"
                                        >
                                          🗑️ Liberar
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        {squadPlayers.length === 0 && (
                          <tr>
                            <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                              Este elenco está vazio no momento.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Barra de Filtro de Agentes Livres */}
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Buscar agentes livres por nome ou posição..."
                    value={freeAgentsFilter}
                    onChange={(e) => setFreeAgentsFilter(e.target.value)}
                    className="w-full max-w-md bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-[#10b981]"
                  />
                </div>

                {/* Lista de Agentes Livres */}
                {freeAgentsLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#10b981] border-t-transparent"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-white/5 rounded-xl max-h-96 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/[0.02] font-bold text-gray-400 uppercase tracking-wider">
                          <th className="px-4 py-3">Jogador</th>
                          <th className="px-4 py-3">Classificação</th>
                          <th className="px-4 py-3">Posição</th>
                          <th className="px-4 py-3">Salário</th>
                          <th className="px-4 py-3">Valor Passe</th>
                          <th className="px-4 py-3 text-center">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-gray-200">
                        {freeAgents
                          .filter(p => {
                            const q = freeAgentsFilter.toLowerCase();
                            return (p.name || "").toLowerCase().includes(q) || (p.position || "").toLowerCase().includes(q);
                          })
                          .slice(0, 100) // Renderizar os top 100 para evitar lag de DOM
                          .map(player => (
                            <tr key={player.id} className="hover:bg-white/[0.01]">
                              <td className="px-4 py-3 flex items-center gap-2">
                                {player.face_url ? (
                                  <img src={player.face_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                                ) : (
                                  <span className="text-sm">👤</span>
                                ) }
                                <span className="font-semibold text-white">{player.name}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded bg-white/5 text-white font-bold">
                                  {player.rating}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-gray-400">{player.position}</span>
                              </td>
                              <td className="px-4 py-3">
                                R$ {parseFloat(player.wage).toLocaleString("pt-BR")}
                              </td>
                              <td className="px-4 py-3">
                                R$ {parseFloat(player.value).toLocaleString("pt-BR")}
                              </td>
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleAddFreeAgentToTeam(player)}
                                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold transition-all text-[10px] shadow"
                                >
                                  ➕ Adicionar ao Time
                                </button>
                              </td>
                            </tr>
                          ))}
                        {freeAgents.filter(p => {
                          const q = freeAgentsFilter.toLowerCase();
                          return (p.name || "").toLowerCase().includes(q) || (p.position || "").toLowerCase().includes(q);
                        }).length === 0 && (
                          <tr>
                            <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                              Nenhum Agente Livre correspondente aos filtros.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setSquadModalOpen(false);
                  setSelectedTeamForSquad(null);
                  setSquadPlayers([]);
                }}
                className="rounded-xl border border-white/10 px-5 py-2 text-xs font-bold text-gray-300 hover:bg-white/5 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs Auxiliares */}
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: "", type: "success" })} />
      <ConfirmModal 
        isOpen={confirm.isOpen}
        title={confirm.title}
        message={confirm.message}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm({ isOpen: false, title: "", message: "", onConfirm: null, confirmText: "Confirmar" })}
        confirmText={confirm.confirmText}
      />
    </div>
  );
}
