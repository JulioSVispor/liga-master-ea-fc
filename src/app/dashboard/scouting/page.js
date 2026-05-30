"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  const [importId, setImportId] = useState("");
  const [importing, setImporting] = useState(false);

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
        let query = supabase
          .from("players")
          .select("*, teams!team_id(name)", { count: "exact" });

        // Aplicar Filtro de Busca por Nome
        if (search) {
          query = query.ilike("name", `%${search}%`);
        }

        // Aplicar Filtro de Posição
        if (position !== "ALL") {
          query = query.eq("position", position);
        }

        // Aplicar Filtro de Over/Rating
        query = query.gte("rating", minRating).lte("rating", maxRating);

        // Aplicar Filtro de Disponibilidade
        if (availability === "FREE") {
          query = query.is("team_id", null);
        } else if (availability === "OWNED") {
          query = query.not("team_id", "is", null);
        }

        // Ordenar por Rating decrescente por padrão
        query = query.order("rating", { ascending: false });

        // Paginação
        const from = (page - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;

        if (error) throw error;

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
  const handleBuyPlayer = async (player) => {
    if (!myTeam) {
      alert("Erro: Você precisa ter um time registrado para contratar jogadores.");
      return;
    }

    const confirmBuy = window.confirm(
      `Deseja contratar ${player.name} por R$ ${parseFloat(player.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}? \n(Salário: R$ ${player.wage.toLocaleString("pt-BR")})`
    );

    if (!confirmBuy) return;

    setActionLoading(player.id);

    try {
      // Chamar a função RPC segura no Supabase
      const { data, error } = await supabase.rpc("buy_free_agent", {
        p_player_id: player.id,
        p_team_id: myTeam.id,
      });

      if (error) {
        throw error;
      }

      if (data && data.success) {
        alert(data.message);
        
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
        alert(data.message || "Erro desconhecido ao tentar contratar o jogador.");
      }
    } catch (err) {
      alert("Falha na contratação: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Função para sincronizar dados em tempo real com a API SoFIFA
  const handleSyncPlayer = async (playerId) => {
    setActionLoading(playerId);
    try {
      const res = await fetch(`/api/sofifa/sync?id=${playerId}`);
      const data = await res.json();
      
      if (data.success) {
        alert(data.message);
        
        // Atualizar os atributos do jogador na lista local
        setPlayers((prev) =>
          prev.map((p) => (p.id === playerId ? { ...p, ...data.player } : p))
        );
      } else {
        alert(data.message || "Houve uma falha ao tentar sincronizar o jogador.");
      }
    } catch (err) {
      alert("Erro ao conectar à API de sincronização: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Pagar Multa Rescisória (Fase 2)
  const handleBuyout = async (player) => {
    if (!myTeam) {
      alert("Erro: Você precisa ter um time registrado para contratar jogadores.");
      return;
    }

    const buyoutPrice = player.buyout_clause && player.buyout_clause > 0
      ? parseFloat(player.buyout_clause)
      : parseFloat(player.value) * 1.5;

    const confirmBuy = window.confirm(
      `Deseja pagar a Multa Rescisória de ${player.name} no valor de R$ ${buyoutPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}? \n\nO jogador será transferido instantaneamente para seu time sem necessidade de aprovação do outro técnico!`
    );

    if (!confirmBuy) return;

    setActionLoading(player.id);
    try {
      const { data, error } = await supabase.rpc("buy_player_via_buyout", {
        p_player_id: player.id,
        p_buyer_team_id: myTeam.id
      });

      if (error) throw error;

      if (data && data.success) {
        alert(data.message);

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
        alert(data.message || "Erro ao processar pagamento de multa.");
      }
    } catch (err) {
      alert("Erro: " + err.message);
    } finally {
      setActionLoading(null);
    }
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
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 2); // Oferta expira em 2 dias

      const { error } = await supabase
        .from("loan_offers")
        .insert({
          sender_team_id: myTeam.id,
          receiver_team_id: selectedLoanPlayer.team_id,
          player_id: selectedLoanPlayer.id,
          salary_share_pct: parseInt(loanSalaryPct),
          duration_weeks: parseInt(loanDuration),
          status: "pending",
          expires_at: expiresAt.toISOString()
        });

      if (error) throw error;

      alert(`Proposta de empréstimo enviada com sucesso para o ${selectedLoanPlayer.teams?.name}!`);
      setShowLoanModal(false);
      setSelectedLoanPlayer(null);
    } catch (err) {
      alert("Erro ao enviar proposta de empréstimo: " + err.message);
    } finally {
      setLoanSubmitting(false);
    }
  };

  // Função para importar jogador por ID direto do SoFIFA
  const handleImportPlayer = async () => {
    if (!importId.trim()) {
      alert("Por favor, digite o ID do jogador do SoFIFA.");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch(`/api/sofifa/sync?id=${importId.trim()}`);
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setImportId("");
        // Reseta filtros e põe o nome do jogador na busca para ele aparecer na listagem
        setSearch(data.player.name);
        setPage(1);
      } else {
        alert(data.message || "Houve uma falha ao tentar importar o jogador.");
      }
    } catch (err) {
      alert("Erro ao conectar à API de importação: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Olheiro & Banco de Jogadores
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Pesquise e contrate atletas do EA FC 26 para reforçar o seu elenco.
        </p>
      </div>

      {/* Painel de Filtros */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Filtros de Busca</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Nome do Jogador</label>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Ex: Neymar, Mbappe..."
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-white text-sm focus:border-[#10b981] outline-none"
            />
          </div>

          {/* Posição */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Posição</label>
            <select
              value={position}
              onChange={(e) => {
                setPosition(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-white/10 bg-[#090d16] py-2.5 px-4 text-white text-sm focus:border-[#10b981] outline-none"
            >
              {positions.map((pos) => (
                <option key={pos} value={pos}>
                  {pos === "ALL" ? "Todas as Posições" : pos}
                </option>
              ))}
            </select>
          </div>

          {/* Overall Rating (Min - Max) */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">
              Rating Geral ({minRating} - {maxRating})
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
                className="w-1/2 rounded-xl border border-white/10 bg-white/5 py-2.5 px-3 text-center text-white text-sm focus:border-[#10b981] outline-none"
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
                className="w-1/2 rounded-xl border border-white/10 bg-white/5 py-2.5 px-3 text-center text-white text-sm focus:border-[#10b981] outline-none"
                placeholder="Máx"
              />
            </div>
          </div>

          {/* Disponibilidade */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Disponibilidade</label>
            <select
              value={availability}
              onChange={(e) => {
                setAvailability(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-white/10 bg-[#090d16] py-2.5 px-4 text-white text-sm focus:border-[#10b981] outline-none"
            >
              <option value="ALL">Todos os Jogadores</option>
              <option value="FREE">Agentes Livres (Contratação)</option>
              <option value="OWNED">Pertencem a Outros Times</option>
            </select>
          </div>
        </div>

        {/* Importação por ID */}
        <div className="border-t border-white/5 pt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex-1">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Importar Jogador Direto do SoFIFA</h4>
            <p className="text-[11px] text-gray-400 mb-2">
              Se você sabe o ID de um jogador no SoFIFA (ex: 158023 para Messi), digite-o abaixo para importá-lo em tempo real para o banco da liga.
            </p>
            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                placeholder="Ex: 158023"
                value={importId}
                onChange={(e) => setImportId(e.target.value)}
                disabled={importing}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 px-4 text-white text-sm focus:border-[#10b981] outline-none"
              />
              <button
                type="button"
                onClick={handleImportPlayer}
                disabled={importing}
                className="rounded-xl bg-gradient-to-r from-[#10b981] to-[#3b82f6] px-6 py-2 text-xs font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {importing ? "Importando..." : "Importar ID"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Jogadores */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
        </div>
      ) : players.length === 0 ? (
        <div className="glass-card py-16 text-center rounded-2xl">
          <span className="text-4xl block mb-2">🔍</span>
          <p className="text-sm text-gray-400">Nenhum jogador encontrado com os filtros selecionados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {players.map((player) => {
            const isFree = !player.team_id;
            const isMine = player.team_id === myTeam?.id;

            return (
              <div
                key={player.id}
                className="glass-card rounded-2xl overflow-hidden flex flex-col relative"
              >
                {/* Badge de Overall / Posição */}
                <div className="absolute top-4 left-4 flex flex-col items-center">
                  <div className="text-2xl font-black text-white leading-none">
                    {player.rating}
                  </div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">
                    {player.position}
                  </div>
                </div>

                {/* Badge de Dono */}
                <div className="absolute top-4 right-4">
                  {isFree ? (
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-[#10b981]">
                      Livre
                    </span>
                  ) : isMine ? (
                    <span className="rounded-full bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2 py-0.5 text-[10px] font-bold text-[#3b82f6]">
                      Meu Time
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-500 truncate max-w-[100px] block">
                      {player.teams?.name || "Ocupado"}
                    </span>
                  )}
                </div>

                {/* Avatar e Corpo */}
                <div className="pt-8 pb-4 px-6 flex flex-col items-center border-b border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent">
                  <div className="h-20 w-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden mb-3">
                    {player.face_url ? (
                      <img src={player.face_url} alt={player.name} className="h-full w-full object-cover scale-110" />
                    ) : (
                      <span className="text-3xl text-gray-600">👤</span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-white text-center truncate w-full">
                    {player.name}
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {player.nation || "Desconhecido"} • {player.age || "--"} anos
                  </p>
                  
                  <button
                    type="button"
                    onClick={() => handleSyncPlayer(player.id)}
                    disabled={actionLoading !== null}
                    className="text-[9.5px] text-[#3b82f6] hover:text-blue-400 mt-2.5 transition-all flex items-center gap-1 bg-[#3b82f6]/5 px-2.5 py-0.5 rounded-full border border-[#3b82f6]/10 hover:bg-[#3b82f6]/15 disabled:opacity-50"
                  >
                    🔄 Sincronizar SoFIFA
                  </button>
                </div>

                {/* Informações Financeiras */}
                <div className="p-4 flex-1 flex flex-col justify-between bg-white/[0.01] gap-4">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-white/5 rounded-xl p-2">
                      <span className="text-[9px] uppercase font-semibold text-gray-500 block">Preço</span>
                      <span className="text-xs font-bold text-[#10b981]">
                        R$ {(player.value / 1000).toFixed(0)}k
                      </span>
                    </div>
                    <div className="bg-white/5 rounded-xl p-2">
                      <span className="text-[9px] uppercase font-semibold text-gray-500 block">Salário</span>
                      <span className="text-xs font-bold text-gray-300">
                        R$ {player.wage.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div>
                    {isFree ? (
                      <button
                        onClick={() => handleBuyPlayer(player)}
                        disabled={actionLoading !== null}
                        className="w-full rounded-xl bg-[#10b981] hover:bg-[#059669] py-2.5 text-xs font-bold text-white shadow transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                      >
                        {actionLoading === player.id ? "Contratando..." : "Contratar Jogador"}
                      </button>
                    ) : isMine ? (
                      <button
                        disabled
                        className="w-full rounded-xl bg-white/5 border border-white/5 py-2.5 text-xs font-bold text-gray-500 cursor-not-allowed"
                      >
                        No seu Elenco
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-[10px] text-center text-gray-400">
                          Multa Rescisória: <strong className="text-red-400">R$ {parseFloat(player.buyout_clause && player.buyout_clause > 0 ? player.buyout_clause : player.value * 1.5).toLocaleString("pt-BR")}</strong>
                        </div>
                        <button
                          onClick={() => handleBuyout(player)}
                          disabled={actionLoading !== null}
                          className="w-full rounded-xl bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 py-2 text-xs font-bold text-white shadow transition-all hover:scale-[1.01]"
                        >
                          💸 Pagar Multa (Roubar)
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleOpenLoanModal(player)}
                            className="rounded-xl bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 border border-[#3b82f6]/20 py-2 text-xs font-bold text-[#3b82f6] transition-all text-center"
                          >
                            🤝 Empréstimo
                          </button>
                          <button
                            onClick={() => {
                              window.location.href = "/dashboard/market?tab=trades";
                            }}
                            className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-2 text-xs font-bold text-white transition-all text-center"
                          >
                            🔄 Troca
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 bg-[#090d16]/95 shadow-2xl relative text-left">
            <h3 className="text-lg font-bold text-white mb-2">Solicitar Empréstimo</h3>
            <p className="text-xs text-gray-400 mb-6">
              Proponha termos de empréstimo para contratar <strong className="text-white">{selectedLoanPlayer.name}</strong> temporariamente.
            </p>

            <div className="space-y-5">
              {/* Informações Básicas do Jogador */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="h-12 w-12 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                  {selectedLoanPlayer.face_url ? (
                    <img src={selectedLoanPlayer.face_url} alt="" className="h-full w-full object-cover scale-110" />
                  ) : (
                    <span className="text-xl">👤</span>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{selectedLoanPlayer.name}</h4>
                  <p className="text-[10px] text-gray-400">Rating {selectedLoanPlayer.rating} • Posição {selectedLoanPlayer.position} • {selectedLoanPlayer.teams?.name}</p>
                </div>
              </div>

              {/* Duração em Semanas */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2">Duração do Empréstimo:</label>
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
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-gray-300">Divisão do Salário:</label>
                  <span className="text-xs font-bold text-[#3b82f6]">{loanSalaryPct}% pago por você</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={loanSalaryPct}
                  onChange={(e) => setLoanSalaryPct(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-2 font-mono">
                  <span>Seu custo: R$ {((selectedLoanPlayer.wage * loanSalaryPct) / 100).toLocaleString("pt-BR")}</span>
                  <span>Dono paga: R$ {((selectedLoanPlayer.wage * (100 - loanSalaryPct)) / 100).toLocaleString("pt-BR")}</span>
                </div>
              </div>

              {/* Mensagem de Atenção sobre Teto */}
              <p className="text-[10px] text-gray-500 bg-white/5 border border-white/5 p-3 rounded-xl">
                💡 Nota: A proposta será enviada para a aba "Trocas & Propostas" do dono do jogador. Ao ser aceita, a sua parte salarial será computada na sua folha salarial total contra o seu teto máximo.
              </p>

              {/* Botões */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSendLoanOffer}
                  disabled={loanSubmitting}
                  className="w-2/3 rounded-xl bg-[#3b82f6] hover:bg-blue-600 py-3 text-xs font-bold text-white shadow-lg transition-all"
                >
                  {loanSubmitting ? "Enviando..." : "Enviar Proposta"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLoanModal(false);
                    setSelectedLoanPlayer(null);
                  }}
                  disabled={loanSubmitting}
                  className="w-1/3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-3 text-xs font-bold text-white transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
