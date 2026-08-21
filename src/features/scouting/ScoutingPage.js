"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { playerService } from "@/services/playerService";
import { transferService } from "@/services/transferService";
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

// Helper to style player positions based on tactical sector
const getPositionStyle = (pos) => {
  if (["ST", "CF", "LW", "RW", "LF", "RF"].includes(pos)) {
    return "bg-red-500/10 border-red-500/20 text-red-400";
  }
  if (["CAM", "CM", "CDM", "LM", "RM", "LCM", "RCM", "LDM", "RDM"].includes(pos)) {
    return "bg-amber-500/10 border-amber-500/20 text-amber-400";
  }
  if (["CB", "LB", "RB", "LWB", "RWB", "LCB", "RCB"].includes(pos)) {
    return "bg-blue-500/10 border-blue-500/20 text-blue-400";
  }
  return "bg-purple-500/10 border-purple-500/20 text-purple-400"; // GK or others
};

const getRatingColor = (rating) => {
  if (rating >= 90) return 'text-amber-400';
  if (rating >= 85) return 'text-emerald-400';
  if (rating >= 80) return 'text-blue-400';
  if (rating >= 75) return 'text-gray-200';
  return 'text-gray-400';
};

const formatBuyoutPrice = (price) => {
  if (price >= 1_000_000) {
    return `R$ ${(price / 1_000_000).toFixed(1)}M`;
  }
  return `R$ ${price.toLocaleString("pt-BR")}`;
};

export default function Scouting() {
  // Estados para Filtros
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("ALL");
  const [minRating, setMinRating] = useState(0);
  const [maxRating, setMaxRating] = useState(99);
  const [availability, setAvailability] = useState("ALL"); // ALL, FREE, OWNED

  // Estados de Dados
  const [players, setPlayers] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // Armazena o ID do jogador em ação

  // Estados para Modal de Empréstimo (Fase 2)
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [selectedLoanPlayer, setSelectedLoanPlayer] = useState(null);
  const [loanSalaryPct, setLoanSalaryPct] = useState(50);
  const [loanDuration, setLoanDuration] = useState(4);
  const [loanSubmitting, setLoanSubmitting] = useState(false);
  
  // Paginação
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 12;

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

  // Lista de posições comuns para o filtro
  const positions = [
    "ALL", "GK", "CB", "LB", "RB", "LWB", "RWB", 
    "CDM", "CM", "LM", "RM", "CAM", "LW", "RW", "CF", "ST"
  ];

  // Carregar dados iniciais (incluindo o time do usuário logado)
  useEffect(() => {
    async function loadUserTeam() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: teamData } = await supabase
          .from("teams")
          .select("*")
          .eq("user_id", session.user.id)
          .single();
        setMyTeam(teamData);
      }
    }
    loadUserTeam();
  }, []);

  // Efeito para buscar jogadores sempre que filtros ou página mudarem
  useEffect(() => {
    async function fetchPlayers() {
      setLoading(true);
      try {
        const { players: data, totalCount: count } = await playerService.searchPlayers({
          search,
          position,
          minRating,
          maxRating,
          availability,
          page,
          itemsPerPage: ITEMS_PER_PAGE
        });

        setPlayers(data || []);
        setTotalCount(count || 0);
      } catch (err) {
        console.error("Erro ao buscar jogadores:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchPlayers();
  }, [search, position, minRating, maxRating, availability, page]);

  // Função para contratar jogador livre imediatamente
  const handleBuyPlayer = (player) => {
    if (!myTeam) {
      showToast("Erro: Você precisa ter um time registrado para contratar jogadores.", "error");
      return;
    }

    setConfirmModal({
      title: "Contratar Jogador Livre",
      message: `Deseja contratar ${player.name} por R$ ${parseFloat(player.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}?\n(Salário Semanal: R$ ${player.wage.toLocaleString("pt-BR")})`,
      onConfirm: async () => {
        setActionLoading(player.id);
        try {
          const data = await playerService.buyFreeAgent(player.id, myTeam.id);

          if (data && data.success) {
            showToast(data.message, "success");
            
            // Atualizar saldo do time no estado local
            setMyTeam((prev) => ({
              ...prev,
              budget: prev.budget - player.value,
            }));

            // Atualizar lista de jogadores localmente (marcar o contratado como pertencente ao time)
            setPlayers((prev) =>
              prev.map((p) =>
                p.id === player.id
                  ? { ...p, team_id: myTeam.id, teams: { name: myTeam.name } }
                  : p
              )
            );
          } else {
            showToast(data.message || "Erro desconhecido ao tentar contratar o jogador.", "error");
          }
        } catch (err) {
          showToast("Falha na contratação: " + err.message, "error");
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  // Pagar Multa Rescisória (Fase 2)
  const handleBuyout = (player) => {
    if (!myTeam) {
      showToast("Erro: Você precisa ter um time registrado para contratar jogadores.", "error");
      return;
    }

    const buyoutPrice = player.buyout_clause && player.buyout_clause > 0
      ? parseFloat(player.buyout_clause)
      : parseFloat(player.value) * 1.5;

    setConfirmModal({
      title: "Pagar Multa Rescisória",
      message: `Deseja pagar a multa de R$ ${buyoutPrice.toLocaleString("pt-BR")} por ${player.name}?\nO jogador vem na hora pro seu time.`,
      onConfirm: async () => {
        setActionLoading(player.id);
        try {
          const data = await playerService.buyPlayerViaBuyout(player.id, myTeam.id);

          if (data && data.success) {
            showToast(data.message, "success");

            setMyTeam((prev) => ({
              ...prev,
              budget: prev.budget - buyoutPrice,
            }));

            setPlayers((prev) =>
              prev.map((p) =>
                p.id === player.id
                  ? { ...p, team_id: myTeam.id, teams: { name: myTeam.name } }
                  : p
              )
            );
          } else {
            showToast(data.message || "Erro ao processar pagamento de multa.", "error");
          }
        } catch (err) {
          showToast("Erro: " + err.message, "error");
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  // Abrir Modal de Empréstimo
  const handleOpenLoanModal = (player) => {
    setSelectedLoanPlayer(player);
    setLoanSalaryPct(50);
    setLoanDuration(4);
    setShowLoanModal(true);
  };

  // Enviar proposta de Empréstimo
  const handleSendLoanOffer = async () => {
    if (!myTeam || !selectedLoanPlayer) return;

    setLoanSubmitting(true);
    try {
      await transferService.sendLoanOffer({
        senderTeamId: myTeam.id,
        receiverTeamId: selectedLoanPlayer.team_id,
        playerId: selectedLoanPlayer.id,
        salarySharePct: loanSalaryPct,
        durationWeeks: loanDuration
      });

      showToast(`Proposta de empréstimo enviada com sucesso para o ${selectedLoanPlayer.teams?.name}!`, "success");
      setShowLoanModal(false);
      setSelectedLoanPlayer(null);
    } catch (err) {
      showToast("Erro ao enviar proposta de empréstimo: " + err.message, "error");
    } finally {
      setLoanSubmitting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Mercado de Atletas
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Pesquise e contrate atletas do EA FC 26 para reforçar o seu elenco.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/dashboard/market?tab=trades" className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all flex items-center gap-2">
            <span>📩</span> Central de Propostas
          </a>
        </div>
      </div>

      {/* Painel de Filtros */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-5 shadow-xl">
        <div className="flex items-center gap-2 border-b border-white/5 pb-3">
          <span className="text-base">🔍</span>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center">
            Filtros de Busca
            <Tooltip content="Use os filtros para pesquisar no banco de dados da liga por nome, posição, rating técnico ou status de contrato do jogador." />
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 flex items-center">
              Nome do Jogador
              <Tooltip content="Busca aproximada pelo nome completo ou apelido do jogador." />
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Ex: Neymar, Mbappe..."
              className="w-full rounded-xl border border-white/10 hover:border-white/20 bg-[#060913] py-2.5 px-4 text-white text-sm focus:ring-2 focus:ring-[#10b981]/30 focus:border-[#10b981] outline-none transition-all duration-200"
            />
          </div>

          {/* Posição */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 flex items-center">
              Posição
              <Tooltip content="Filtre pela posição tática oficial do jogador no EA FC." />
            </label>
            <select
              value={position}
              onChange={(e) => {
                setPosition(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-white/10 hover:border-white/20 bg-[#060913] py-2.5 px-4 text-white text-sm focus:ring-2 focus:ring-[#10b981]/30 focus:border-[#10b981] outline-none transition-all duration-200 cursor-pointer"
            >
              {positions.map((pos) => (
                <option key={pos} value={pos} className="bg-[#090d16]">
                  {pos === "ALL" ? "Todas as Posições" : pos}
                </option>
              ))}
            </select>
          </div>

          {/* Overall Rating (Min - Max) */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 flex items-center">
              Rating Geral ({minRating} - {maxRating})
              <Tooltip content="Filtre jogadores com base na pontuação geral (Overall) do EA FC 26." />
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                max="99"
                value={minRating}
                onChange={(e) => {
                  setMinRating(Math.max(0, parseInt(e.target.value) || 0));
                  setPage(1);
                }}
                className="w-1/2 rounded-xl border border-white/10 hover:border-white/20 bg-[#060913] py-2.5 px-3 text-center text-white text-sm focus:ring-2 focus:ring-[#10b981]/30 focus:border-[#10b981] outline-none transition-all duration-200"
                placeholder="Mín"
              />
              <input
                type="number"
                min="0"
                max="99"
                value={maxRating}
                onChange={(e) => {
                  setMaxRating(Math.min(99, parseInt(e.target.value) || 99));
                  setPage(1);
                }}
                className="w-1/2 rounded-xl border border-white/10 hover:border-white/20 bg-[#060913] py-2.5 px-3 text-center text-white text-sm focus:ring-2 focus:ring-[#10b981]/30 focus:border-[#10b981] outline-none transition-all duration-200"
                placeholder="Máx"
              />
            </div>
          </div>

          {/* Disponibilidade */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5 flex items-center">
              Disponibilidade
              <Tooltip content="Filtre por agentes livres (sem time na liga) ou jogadores que já pertencem a outros clubes." />
            </label>
            <select
              value={availability}
              onChange={(e) => {
                setAvailability(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-white/10 hover:border-white/20 bg-[#060913] py-2.5 px-4 text-white text-sm focus:ring-2 focus:ring-[#10b981]/30 focus:border-[#10b981] outline-none transition-all duration-200 cursor-pointer"
            >
              <option value="ALL" className="bg-[#090d16]">Todos os Jogadores</option>
              <option value="FREE" className="bg-[#090d16]">Agentes Livres (Contratação)</option>
              <option value="OWNED" className="bg-[#090d16]">Pertencem a Outros Times</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Jogadores */}
      {loading ? (
        <div className="flex justify-center py-20 animate-pulse">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
        </div>
      ) : players.length === 0 ? (
        <div className="glass-card py-16 text-center rounded-2xl border border-white/5 bg-[#090d16]/40">
          <span className="text-4xl block mb-2">🔍</span>
          <p className="text-sm text-gray-400">Nenhum jogador encontrado com os filtros selecionados.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/5 bg-[#090d16]/30 shadow-xl overflow-hidden">
          {/* Desktop Table View */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300 border-collapse">
              <thead>
                <tr className="text-[10px] font-bold uppercase text-gray-400 border-b border-white/5 bg-white/[0.01]">
                  <th className="py-3.5 px-4">Jogador</th>
                  <th className="py-3.5 px-4 text-center w-20">Posição</th>
                  <th className="py-3.5 px-4 text-center w-20">Rating</th>
                  <th className="py-3.5 px-4 text-right w-32">Preço Passe</th>
                  <th className="py-3.5 px-4 text-right w-32">Salário</th>
                  <th className="py-3.5 px-4 text-center w-40">Status / Dono</th>
                  <th className="py-3.5 px-4 text-center w-72">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                {players.map((player) => {
                  const isFree = !player.team_id;
                  const isMine = player.team_id === myTeam?.id;
                  const buyoutPrice = player.buyout_clause && player.buyout_clause > 0
                    ? parseFloat(player.buyout_clause)
                    : parseFloat(player.value) * 1.5;

                  return (
                    <tr key={player.id} className="hover:bg-white/[0.01] transition-colors group">
                      {/* Jogador info (Face, Name, Age/Nation) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative h-9 w-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {player.face_url ? (
                              <img src={player.face_url} alt="" className="h-full w-full object-cover scale-110" />
                            ) : (
                              <span className="text-lg">👤</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate max-w-[150px] sm:max-w-[200px] group-hover:text-[#10b981] transition-colors">
                              {player.name}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {player.nation || "Desconhecido"} • {player.age || "--"} anos
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Posição */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${getPositionStyle(player.position)}`}>
                          {player.position}
                        </span>
                      </td>

                      {/* Rating */}
                      <td className="py-3 px-4 text-center font-black text-white text-base">
                        <span className={getRatingColor(player.rating)}>{player.rating}</span>
                      </td>

                      {/* Preço Passe */}
                      <td className="py-3 px-4 text-right font-semibold text-blue-400">
                        R$ {parseFloat(player.value || 0).toLocaleString("pt-BR")}
                      </td>

                      {/* Salário Semanal */}
                      <td className="py-3 px-4 text-right font-bold text-emerald-400 text-sm">
                        R$ {parseFloat(player.wage || 0).toLocaleString("pt-BR")}
                      </td>

                      {/* Status / Dono */}
                      <td className="py-3 px-4 text-center">
                        {isFree ? (
                          <span className="font-bold text-emerald-400 text-xs uppercase tracking-wide">
                            Livre
                          </span>
                        ) : isMine ? (
                          <span className="font-bold text-blue-400 text-xs uppercase tracking-wide">
                            Meu Time
                          </span>
                        ) : (
                          <span className="font-semibold text-gray-300 text-xs truncate max-w-[130px] inline-block uppercase tracking-wide" title={player.teams?.name}>
                            {player.teams?.name || "Ocupado"}
                          </span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          {isFree ? (
                            <button
                              onClick={() => handleBuyPlayer(player)}
                              disabled={actionLoading !== null}
                              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 py-2 text-xs font-bold text-white shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1 min-w-[120px]"
                            >
                              {actionLoading === player.id ? (
                                <>
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                                  Contratando...
                                </>
                              ) : (
                                <>
                                  <span>✍️</span> Contratar
                                </>
                              )}
                            </button>
                          ) : isMine ? (
                            <span className="flex-1 text-center py-2 text-xs font-bold text-gray-500 bg-white/5 border border-white/5 rounded-xl cursor-not-allowed select-none min-w-[120px]">
                              No seu Elenco
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5 justify-center w-full">
                              {/* Multa (Roubar) */}
                              <button
                                onClick={() => handleBuyout(player)}
                                disabled={actionLoading !== null}
                                className="flex-[2] rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-2 py-2 text-[10px] font-bold text-red-400 transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                                title={`Pagar multa rescisória de R$ ${buyoutPrice.toLocaleString("pt-BR")}`}
                              >
                                {actionLoading === player.id ? (
                                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent"></span>
                                ) : (
                                  <>
                                    <span>💸</span> {formatBuyoutPrice(buyoutPrice)}
                                  </>
                                )}
                              </button>

                              {/* Empréstimo */}
                              <button
                                onClick={() => handleOpenLoanModal(player)}
                                className="flex-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-2 py-2 text-[10px] font-bold text-blue-400 transition-all flex items-center justify-center gap-1"
                                title="Solicitar Empréstimo"
                              >
                                <span>🤝</span> Emp.
                              </button>
                              
                              {/* Troca */}
                              <button
                                onClick={() => {
                                  window.location.href = "/dashboard/market?tab=trades";
                                }}
                                className="flex-1 rounded-lg bg-gray-500/10 hover:bg-gray-500/20 border border-gray-500/20 px-2 py-2 text-[10px] font-bold text-gray-300 transition-all flex items-center justify-center gap-1"
                                title="Iniciar Proposta de Troca"
                              >
                                <span>🔄</span> Troca
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile List View */}
          <div className="md:hidden divide-y divide-white/5">
            {players.map((player) => {
              const isFree = !player.team_id;
              const isMine = player.team_id === myTeam?.id;
              const buyoutPrice = player.buyout_clause && player.buyout_clause > 0
                ? parseFloat(player.buyout_clause)
                : parseFloat(player.value) * 1.5;

              return (
                <div key={player.id} className="p-4 flex flex-col gap-3 bg-[#090d16]/10 hover:bg-white/[0.01] transition-colors">
                  {/* Info Top: Face, Nome, Posição, Rating */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative h-9 w-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {player.face_url ? (
                          <img src={player.face_url} alt="" className="h-full w-full object-cover scale-110" />
                        ) : (
                          <span className="text-base">👤</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate max-w-[170px]">
                          {player.name}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {player.nation || "Desconhecido"} • {player.age || "--"} anos
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${getPositionStyle(player.position)}`}>
                        {player.position}
                      </span>
                      <span className={`font-black text-sm ${getRatingColor(player.rating)}`}>
                        {player.rating}
                      </span>
                    </div>
                  </div>

                  {/* Info Middle: Valores e Dono */}
                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/5 text-[10px] bg-white/[0.01] px-2 rounded-lg">
                    <div>
                      <span className="text-gray-500 block text-[9px] uppercase tracking-wider mb-0.5">Passe</span>
                      <strong className="text-blue-400">R$ {parseFloat(player.value || 0).toLocaleString("pt-BR")}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[9px] uppercase tracking-wider mb-0.5">Salário</span>
                      <strong className="text-emerald-400">R$ {parseFloat(player.wage || 0).toLocaleString("pt-BR")}</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500 block text-[9px] uppercase tracking-wider mb-0.5">Dono</span>
                      {isFree ? (
                        <span className="text-[#10b981] font-bold">🟢 Livre</span>
                      ) : isMine ? (
                        <span className="text-[#3b82f6] font-bold">🛡️ Meu</span>
                      ) : (
                        <span className="text-amber-500 font-bold truncate block" title={player.teams?.name}>
                          🏃‍♂️ {player.teams?.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info Bottom: Ações */}
                  <div className="flex items-center gap-2 pt-0.5">
                    {isFree ? (
                      <button
                        onClick={() => handleBuyPlayer(player)}
                        disabled={actionLoading !== null}
                        className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 py-2 text-xs font-bold text-white shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {actionLoading === player.id ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                            ...
                          </>
                        ) : (
                          <>
                            <span>✍️</span> Contratar
                          </>
                        )}
                      </button>
                    ) : isMine ? (
                      <span className="flex-1 text-center py-2 text-xs font-bold text-gray-500 bg-white/5 border border-white/5 rounded-xl cursor-not-allowed select-none">
                        No seu Elenco
                      </span>
                    ) : (
                      <div className="flex-1 flex gap-1.5">
                        {/* Multa (Roubar) */}
                        <button
                          onClick={() => handleBuyout(player)}
                          disabled={actionLoading !== null}
                          className="flex-1 rounded-xl bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 py-2 text-[9px] font-bold text-white shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-0.5"
                          title={`Multa: R$ ${buyoutPrice.toLocaleString("pt-BR")}`}
                        >
                          <span>💸</span> Multa ({formatBuyoutPrice(buyoutPrice)})
                        </button>

                        {/* Empréstimo */}
                        <button
                          onClick={() => handleOpenLoanModal(player)}
                          className="rounded-xl bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 border border-[#3b82f6]/20 px-3 py-2 text-[9px] font-bold text-[#3b82f6] transition-all text-center flex items-center justify-center gap-0.5"
                          title="Solicitar Empréstimo"
                        >
                          <span>🤝</span> Emp.
                        </button>
                        
                        {/* Troca */}
                        <button
                          onClick={() => {
                            window.location.href = "/dashboard/market?tab=trades";
                          }}
                          className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-[9px] font-bold text-white transition-all text-center flex items-center justify-center"
                          title="Iniciar Proposta de Troca"
                        >
                          <span>🔄</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controles de Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/5 pt-6">
          <span className="text-xs text-gray-400">
            Mostrando <strong className="text-white">{players.length}</strong> de{" "}
            <strong className="text-white">{totalCount}</strong> jogadores
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-white/5"
            >
              Anterior
            </button>
            <span className="text-xs text-gray-400">
              Página <strong className="text-white">{page}</strong> de{" "}
              <strong className="text-white">{totalPages}</strong>
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-white/5"
            >
              Próximo
            </button>
          </div>
        </div>
      )}

      {/* Modal de Empréstimo */}
      {showLoanModal && selectedLoanPlayer && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 p-4 animate-fadeIn">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 bg-[#090d16]/95 shadow-2xl relative text-left">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                <span>🤝</span> Solicitar Empréstimo
              </h3>
              <Tooltip content="Envie uma proposta de empréstimo. Você define a quantidade de rodadas/semanas e a porcentagem do salário que seu clube pagará durante esse tempo." />
            </div>
            
            <p className="text-xs text-gray-400 mb-5">
              Proponha termos de empréstimo para contratar <strong className="text-white">{selectedLoanPlayer.name}</strong> temporariamente.
            </p>

            <div className="space-y-5">
              {/* Informações Básicas do Jogador */}
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="h-12 w-12 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center relative flex-shrink-0">
                  {selectedLoanPlayer.face_url ? (
                    <img src={selectedLoanPlayer.face_url} alt="" className="h-full w-full object-cover scale-110" />
                  ) : (
                    <span className="text-xl">👤</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-white truncate">{selectedLoanPlayer.name}</h4>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                    <span className="font-extrabold text-amber-400">Rating {selectedLoanPlayer.rating}</span>
                    <span>•</span>
                    <span className={`px-1 rounded text-[9px] font-bold ${getPositionStyle(selectedLoanPlayer.position)}`}>{selectedLoanPlayer.position}</span>
                    <span>•</span>
                    <span className="text-gray-400 truncate max-w-[120px]">{selectedLoanPlayer.teams?.name}</span>
                  </p>
                </div>
              </div>

              {/* Duração em Semanas */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2 flex items-center">
                  Duração do Empréstimo
                  <Tooltip content="Defina por quantas semanas/rodadas você quer contar com o jogador em seu elenco." />
                </label>
                <select
                  value={loanDuration}
                  onChange={(e) => setLoanDuration(parseInt(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-[#090d16] py-2.5 px-4 text-white text-sm focus:border-[#3b82f6] outline-none"
                >
                  <option value="2">2 Rodadas / Semanas</option>
                  <option value="4">4 Rodadas / Semanas (Recomendado)</option>
                  <option value="6">6 Rodadas / Semanas</option>
                  <option value="8">8 Rodadas / Semanas</option>
                </select>
              </div>

              {/* Divisão Salarial (Slider) */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-semibold text-gray-300 flex items-center">
                    Divisão do Salário
                    <Tooltip content="Ajuste a porcentagem do salário semanal do atleta que seu clube se compromete a pagar." />
                  </label>
                  <span className="text-xs font-extrabold text-[#3b82f6] bg-[#3b82f6]/10 px-2 py-0.5 rounded-lg border border-[#3b82f6]/20">
                    {loanSalaryPct}% pago por você
                  </span>
                </div>
                <div className="px-1 py-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={loanSalaryPct}
                    onChange={(e) => setLoanSalaryPct(parseInt(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#3b82f6] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-mono mt-1">
                  <div className="bg-emerald-500/[0.03] border border-emerald-500/10 rounded-xl p-2">
                    <span className="text-gray-500 block text-[9px] uppercase font-sans">Seu custo semanal</span>
                    <strong className="text-emerald-400">R$ {((selectedLoanPlayer.wage * loanSalaryPct) / 100).toLocaleString("pt-BR")}</strong>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-2">
                    <span className="text-gray-500 block text-[9px] uppercase font-sans">Dono pagará</span>
                    <strong className="text-gray-400">R$ {((selectedLoanPlayer.wage * (100 - loanSalaryPct)) / 100).toLocaleString("pt-BR")}</strong>
                  </div>
                </div>
              </div>

              {/* Mensagem de Atenção sobre Teto */}
              <div className="text-[10px] text-gray-400 bg-blue-500/5 border border-blue-500/15 p-3.5 rounded-xl leading-relaxed flex gap-2">
                <span className="text-sm">💡</span>
                <div>
                  <strong>Atenção:</strong> A proposta será enviada para a aba "Trocas & Propostas" do dono do jogador. Ao ser aceita, a sua parte salarial será computada na sua folha salarial total contra o seu teto máximo.
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSendLoanOffer}
                  disabled={loanSubmitting}
                  className="w-2/3 rounded-xl bg-gradient-to-r from-[#3b82f6] to-blue-600 hover:from-blue-600 hover:to-blue-700 py-3 text-xs font-bold text-white shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {loanSubmitting ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <span>🤝</span> Enviar Proposta
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLoanModal(false);
                    setSelectedLoanPlayer(null);
                  }}
                  disabled={loanSubmitting}
                  className="w-1/3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-3 text-xs font-bold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
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
                className="flex-1 rounded-xl bg-[#10b981] hover:bg-[#059669] py-3 text-xs font-bold text-white shadow-lg transition-all"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.onCancel) confirmModal.onCancel();
                  setConfirmModal(null);
                }}
                className="flex-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-3 text-xs font-bold text-white transition-all"
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
