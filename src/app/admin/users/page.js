"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null); // Para modal de finanças
  const [editBudget, setEditBudget] = useState("");
  const [editWageCap, setEditWageCap] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

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
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
      alert("Erro ao carregar lista de usuários: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Alterar role do usuário (admin <-> user)
  const handleToggleRole = async (userId, currentRole) => {
    const nextRole = currentRole === "admin" ? "user" : "admin";
    const confirmMsg = `Tem certeza que deseja alterar o nível de acesso para ${nextRole.toUpperCase()}?`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: nextRole })
        .eq("id", userId);

      if (error) throw error;
      
      // Atualizar estado local
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u))
      );
      alert("Nível de acesso atualizado com sucesso!");
    } catch (err) {
      alert("Erro ao alterar nível de acesso: " + err.message);
    } finally {
      setActionLoading(null);
    }
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
        alert("Valores inválidos!");
        return;
      }

      const { error } = await supabase
        .from("teams")
        .update({
          budget: budgetVal,
          max_wage_cap: wageCapVal,
        })
        .eq("id", selectedTeam.id);

      if (error) throw error;

      // Recarregar dados para refletir na lista
      await loadUsers();
      setModalOpen(false);
      setSelectedTeam(null);
      alert("Finanças do time atualizadas com sucesso!");
    } catch (err) {
      alert("Erro ao salvar finanças: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Liberar elenco (Resetar elenco)
  const handleResetSquad = async (teamId, teamName) => {
    const confirmMsg = `ATENÇÃO: Tem certeza que deseja liberar TODO o elenco do time "${teamName}"?\nTodos os jogadores dele voltarão a ser Agentes Livres no mercado e essa ação ficará registrada no Histórico.`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(teamId);
    try {
      const { data, error } = await supabase.rpc("reset_squad", {
        p_team_id: teamId,
      });

      if (error) throw error;

      if (data && data.success) {
        alert(data.message);
      } else {
        alert(data.message || "Erro desconhecido ao liberar elenco.");
      }
    } catch (err) {
      alert("Erro ao liberar elenco: " + err.message);
    } finally {
      setActionLoading(null);
    }
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
          Gestão de Usuários & Times
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Gerencie permissões dos membros, orçamentos dos clubes e liberação de elencos da liga.
        </p>
      </div>

      {/* Tabela de Usuários */}
      <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4">Nome / Treinador</th>
                <th className="px-6 py-4">Nível</th>
                <th className="px-6 py-4">Time Liga (EA FC)</th>
                <th className="px-6 py-4">Orçamento</th>
                <th className="px-6 py-4">Teto Salarial</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const teamData = user.teams; // O relacionamento de single ou array do supabase pode retornar um objeto
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
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              user.role === "admin"
                                ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                                : "bg-amber-400/10 text-amber-400 border-amber-400/20 hover:bg-amber-400/20"
                            }`}
                          >
                            {user.role === "admin" ? "Demover" : "Tornar Admin"}
                          </button>

                          {teamData && (
                            <>
                              <button
                                onClick={() => openFinancesModal(teamData)}
                                disabled={actionLoading !== null}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all"
                              >
                                Orçamento
                              </button>
                              <button
                                onClick={() => handleResetSquad(teamData.id, teamData.name)}
                                disabled={actionLoading !== null}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
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

            <form onSubmit={handleSaveFinances} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-300 font-semibold">Orçamento de Transferências (Saldo)</label>
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
                <label className="text-xs text-gray-300 font-semibold">Teto Salarial Semanal</label>
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
    </div>
  );
}
