"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { playerService } from "@/services/playerService";
import { transferService } from "@/services/transferService";
import { AppImage } from "@/components/ui/AppImage";
import { ScoutingView } from "@/features/scouting/components/ScoutingView";
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
  const router = useRouter();
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
    <ScoutingView
      model={{
      router,
      ITEMS_PER_PAGE,
      showToast,
      positions,
      handleBuyPlayer,
      handleBuyout,
      handleOpenLoanModal,
      handleSendLoanOffer,
      totalPages,
      search,
      setSearch,
      position,
      setPosition,
      minRating,
      setMinRating,
      maxRating,
      setMaxRating,
      availability,
      setAvailability,
      players,
      setPlayers,
      myTeam,
      setMyTeam,
      loading,
      setLoading,
      actionLoading,
      setActionLoading,
      showLoanModal,
      setShowLoanModal,
      selectedLoanPlayer,
      setSelectedLoanPlayer,
      loanSalaryPct,
      setLoanSalaryPct,
      loanDuration,
      setLoanDuration,
      loanSubmitting,
      setLoanSubmitting,
      page,
      setPage,
      totalCount,
      setTotalCount,
      toast,
      setToast,
      confirmModal,
      setConfirmModal,
      }}
    />
  );
}
