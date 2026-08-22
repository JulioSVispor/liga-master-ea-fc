"use client";

import { useEffect, useState } from "react";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";
import PlayerProfileModal from "@/features/dashboard/components/PlayerProfileModal";
import { teamService } from "@/services/teamService";
import { playerService } from "@/services/playerService";
import { transferService } from "@/services/transferService";
import TradeProposals from "./components/TradeProposals";
import AuctionListings from "./components/AuctionListings";
import CreateListingForm from "./components/CreateListingForm";
import TradeProposalModal from "./components/modals/TradeProposalModal";

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

export default function Market() {
  const searchParams = useSearchParams();
  const tabQuery = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabQuery || "trades"); // global, sell, trades
  const [loading, setLoading] = useState(true);
  const [myTeam, setMyTeam] = useState(null);
  const [marketListings, setMarketListings] = useState([]);
  const [mySquad, setMySquad] = useState([]);

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
  
  // Estados para Leilão e Compra Imediata
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [listingType, setListingType] = useState("immediate_buy");
  const [price, setPrice] = useState("");
  const [buyoutPrice, setBuyoutPrice] = useState("");
  const [durationHours, setDurationHours] = useState(24);
  const [listingLoading, setListingLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [bidAmounts, setBidAmounts] = useState({});
  // Estados para o Sistema de Trocas (Trades)
  const [receivedTrades, setReceivedTrades] = useState([]);
  const [sentTrades, setSentTrades] = useState([]);
  const [otherTeams, setOtherTeams] = useState([]);
  const [proposingTrade, setProposingTrade] = useState(false);

  // Estados para Empréstimos (Fase 2)
  const [receivedLoans, setReceivedLoans] = useState([]);
  const [sentLoans, setSentLoans] = useState([]);
  const [tradeOrLoanTab, setTradeOrLoanTab] = useState("trades"); // trades, loans

  // Estados para Chat de Negociação (Fase 2)
  const [activeChat, setActiveChat] = useState(null); // { type: 'trade' | 'loan', id: string, name: string }
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  
  // Formulário de Nova Troca
  const [selectedTargetTeamId, setSelectedTargetTeamId] = useState("");
  const [targetSquad, setTargetSquad] = useState([]);
  const [tradeSendPlayers, setTradeSendPlayers] = useState([]); // IDs dos meus jogadores a enviar
  const [tradeReceivePlayers, setTradeReceivePlayers] = useState([]); // IDs dos jogadores adversários a receber
  const [tradeOfferMoney, setTradeOfferMoney] = useState("0");
  const [tradeRequestMoney, setTradeRequestMoney] = useState("0");
  const [tradeSubmitting, setTradeSubmitting] = useState(false);

  // Perfil de Jogador
  const [selectedPlayerForProfile, setSelectedPlayerForProfile] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const openPlayerProfile = async (player) => {
    setSelectedPlayerForProfile(player);
    setStatsLoading(true);
    try {
      const { data, error } = await supabase
        .from("player_stats")
        .select("*, seasons(name)")
        .eq("player_id", player.id);
      
      if (!error && data) {
        setPlayerStats(data.map(d => ({ ...d, season_name: d.seasons?.name })));
      } else {
        setPlayerStats([]);
      }
    } catch (e) {
      setPlayerStats([]);
    } finally {
      setStatsLoading(false);
    }
  };

  // Carregar dados principais
  useDeferredEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // 1. Carregar meu time
        const { data: teamData } = await supabase
          .from("teams")
          .select("*")
          .eq("user_id", session.user.id)
          .single();

        if (teamData) {
          setMyTeam(teamData);

          // 2. Carregar meu elenco
          const squad = await playerService.getPlayersByTeamId(teamData.id);
          setMySquad(squad || []);

          if (activeTab === "global") {
            // Carregar anúncios globais
            const listings = await transferService.getMarketListings();
            setMarketListings(listings || []);
          } else if (activeTab === "trades") {
            // Carregar dados de trocas e empréstimos
            await loadTradesData(teamData.id);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados do mercado:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, activeTab);

  // Carrega propostas de trocas enviadas e recebidas e outros times
  async function loadTradesData(myTeamId) {
    try {
      // 1. Outros times para propor trocas
      const allTeams = await teamService.getAllTeams();
      setOtherTeams(allTeams.filter(t => t.id !== myTeamId));

      // 2. Trocas e Empréstimos (Pendentes)
      const { receivedTrades, sentTrades, receivedLoans, sentLoans } = await transferService.getPendingTradesAndLoans(myTeamId);
      
      setReceivedTrades(receivedTrades);
      setSentTrades(sentTrades);
      setReceivedLoans(receivedLoans);
      setSentLoans(sentLoans);
    } catch (err) {
      console.error("Erro ao carregar dados de trocas e empréstimos:", err);
    }
  }

  // Carregar mensagens do Chat de Negociação
  const loadChatMessages = async (chat) => {
    try {
      const messages = await transferService.getChatMessages(chat.type, chat.id);
      setChatMessages(messages);
    } catch (err) {
      console.error("Erro ao carregar chat:", err);
    }
  };

  // Polling para Chat
  useDeferredEffect(() => {
    if (!activeChat) return;

    loadChatMessages(activeChat);
    const interval = setInterval(() => {
      loadChatMessages(activeChat);
    }, 3000);

    return () => clearInterval(interval);
  }, activeChat ? `${activeChat.type}:${activeChat.id}` : "no-chat");

  // Enviar Mensagem no Chat
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !myTeam) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      await transferService.sendChatMessage(activeChat.type, activeChat.id, session.user.id, newMessage);

      setNewMessage("");
      await loadChatMessages(activeChat);
    } catch (err) {
      showToast("Erro ao enviar mensagem: " + err.message, "error");
    }
  };

  // Aceitar Empréstimo
  const handleAcceptLoan = async (loanId) => {
    setConfirmModal({
      title: "Aceitar Empréstimo",
      message: "Deseja aceitar esta proposta de empréstimo? O jogador será transferido temporariamente para o time de destino e o salário dividido conforme o acordo.",
      onConfirm: async () => {
        setActionLoading(loanId);
        try {
          const { data, error } = await supabase.rpc("accept_loan_offer", {
            p_offer_id: loanId,
          });

          if (error) throw error;

          if (data && data.success) {
            showToast(data.message, "success");
            const { data: teamData } = await supabase
              .from("teams")
              .select("*")
              .eq("id", myTeam.id)
              .single();
            setMyTeam(teamData);
            await loadTradesData(myTeam.id);
          } else {
            showToast(data.message || "Erro desconhecido ao aceitar o empréstimo.", "error");
          }
        } catch (err) {
          showToast("Erro ao finalizar empréstimo: " + err.message, "error");
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  // Rejeitar Empréstimo
  const handleRejectLoan = async (loanId) => {
    setConfirmModal({
      title: "Recusar Empréstimo",
      message: "Deseja recusar esta proposta de empréstimo?",
      onConfirm: async () => {
        setActionLoading(loanId);
        try {
          await transferService.updateLoanStatus(loanId, "rejected");

          showToast("Proposta de empréstimo recusada!", "success");
          await loadTradesData(myTeam.id);
        } catch (err) {
          showToast("Erro ao recusar: " + err.message, "error");
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  // Cancelar Empréstimo
  const handleCancelLoan = async (loanId) => {
    setConfirmModal({
      title: "Cancelar Empréstimo",
      message: "Deseja cancelar esta proposta de empréstimo enviada?",
      onConfirm: async () => {
        setActionLoading(loanId);
        try {
          await transferService.updateLoanStatus(loanId, "cancelled");

          showToast("Proposta de empréstimo cancelada!", "success");
          await loadTradesData(myTeam.id);
        } catch (err) {
          showToast("Erro ao cancelar: " + err.message, "error");
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  // Carregar o elenco do time alvo selecionado para troca
  const handleTargetTeamChange = async (targetTeamId) => {
    setSelectedTargetTeamId(targetTeamId);
    setTradeReceivePlayers([]);
    
    if (!targetTeamId) {
      setTargetSquad([]);
      return;
    }

    try {
      const squad = await playerService.getPlayersByTeamId(targetTeamId);
      setTargetSquad(squad || []);
    } catch (err) {
      showToast("Erro ao buscar elenco adversário.", "error");
    }
  };

  // Criar anúncio de jogador
  const handleCreateListing = async (e) => {
    e.preventDefault();
    if (!myTeam || !selectedPlayerId || !price) {
      showToast("Por favor, preencha todos os campos do anúncio.", "error");
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      showToast("Preço inválido.", "error");
      return;
    }

    const player = mySquad.find((p) => p.id.toString() === selectedPlayerId.toString());
    if (!player) return;

    setConfirmModal({
      title: "Anunciar Jogador",
      message: `Deseja listar ${player.name} no mercado por R$ ${priceNum.toLocaleString("pt-BR")}? Ele continuará no seu time e disponível para jogos até que a venda seja concluída.`,
      onConfirm: async () => {
        setListingLoading(true);
        try {
          await transferService.createMarketListing({
            playerId: player.id,
            sellerTeamId: myTeam.id,
            listingType,
            price: priceNum,
            buyoutPrice: buyoutPrice,
            durationHours
          });

          showToast("Jogador anunciado com sucesso!", "success");
          setSelectedPlayerId("");
          setPrice("");
          setBuyoutPrice("");
          setActiveTab("global");
        } catch (err) {
          showToast("Erro ao anunciar jogador: " + err.message, "error");
        } finally {
          setListingLoading(false);
        }
      }
    });
  };

  // Comprar anúncio de compra imediata
  const handleBuyListing = async (listing) => {
    if (!myTeam) return;

    setConfirmModal({
      title: "Comprar Jogador",
      message: `Deseja comprar ${listing.players.name} por R$ ${parseFloat(listing.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}?`,
      onConfirm: async () => {
        setActionLoading(listing.id);
        try {
          const data = await transferService.buyMarketListing(listing.id, myTeam.id);

          if (data && data.success) {
            showToast(data.message, "success");
            setMyTeam((prev) => ({ ...prev, budget: prev.budget - listing.price }));
            setMarketListings((prev) => prev.filter((item) => item.id !== listing.id));
          } else {
            showToast(data.message || "Erro ao tentar comprar.", "error");
          }
        } catch (err) {
          showToast("Falha na compra: " + err.message, "error");
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  // Dar lance no leilão
  const handlePlaceBid = async (listing) => {
    if (!myTeam) return;

    const bidVal = bidAmounts[listing.id];
    if (!bidVal) {
      showToast("Insira um valor de lance.", "error");
      return;
    }

    const bidNum = parseFloat(bidVal);
    if (isNaN(bidNum) || bidNum <= listing.price) {
      showToast(`O lance deve ser maior que o valor mínimo de R$ ${listing.price.toLocaleString("pt-BR")}.`, "error");
      return;
    }

    setConfirmModal({
      title: "Dar Lance",
      message: `Deseja registrar o lance de R$ ${bidNum.toLocaleString("pt-BR")} no jogador ${listing.players.name}?`,
      onConfirm: async () => {
        setActionLoading(listing.id);
        try {
          const data = await transferService.placeAuctionBid(listing.id, bidNum);

          if (data && data.success) {
            showToast(data.message, "success");
            // Recarregar
            const { data: updatedListings } = await supabase
              .from("market_listings")
              .select("*, players(*), teams(name)")
              .eq("status", "active")
              .order("created_at", { ascending: false });

            setMarketListings(updatedListings || []);
            setBidAmounts((prev) => ({ ...prev, [listing.id]: "" }));
          } else {
            showToast(data.message || "Erro ao lançar.", "error");
          }
        } catch (err) {
          showToast("Erro ao registrar lance: " + err.message, "error");
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  // Cancelar anúncio
  const handleCancelListing = async (listing) => {
    setConfirmModal({
      title: "Cancelar Anúncio",
      message: `Deseja cancelar o anúncio de ${listing.players.name}? Ele retornará ao seu time.`,
      onConfirm: async () => {
        setActionLoading(listing.id);
        try {
          await transferService.cancelMarketListing(listing.id, listing.player_id, listing.seller_team_id);

          showToast("Anúncio cancelado com sucesso!", "success");
          setMarketListings((prev) => prev.filter((item) => item.id !== listing.id));
        } catch (err) {
          showToast("Erro ao cancelar: " + err.message, "error");
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  // Enviar proposta de troca direta (Trade)
  const handleSendTradeOffer = async (e) => {
    e.preventDefault();
    if (!myTeam || !selectedTargetTeamId) return;

    if (tradeSendPlayers.length === 0 && tradeReceivePlayers.length === 0) {
      showToast("Por favor, selecione pelo menos um jogador envolvido na troca.", "error");
      return;
    }

    const offerMoneyNum = parseFloat(tradeOfferMoney) || 0;
    const requestMoneyNum = parseFloat(tradeRequestMoney) || 0;

    if (offerMoneyNum < 0 || requestMoneyNum < 0) {
      showToast("Valores monetários não podem ser negativos.", "error");
      return;
    }

    if (offerMoneyNum > myTeam.budget) {
      showToast("Você não possui saldo para cobrir o valor em dinheiro oferecido.", "error");
      return;
    }

    setTradeSubmitting(true);
    try {
      await transferService.sendTradeOffer({
        senderTeamId: myTeam.id,
        receiverTeamId: selectedTargetTeamId,
        offerMoney: offerMoneyNum,
        requestMoney: requestMoneyNum,
        sendPlayerIds: tradeSendPlayers,
        receivePlayerIds: tradeReceivePlayers
      });

      // Inserir notificação para o time recebedor
      const targetTeamObj = otherTeams.find(t => t.id === selectedTargetTeamId);
      if (targetTeamObj?.user_id) {
        await transferService.sendNotification(
          targetTeamObj.user_id,
          "Nova Proposta de Troca 🔄",
          `Você recebeu uma nova proposta de troca de jogadores do clube ${myTeam.name}.`
        );
      }

      showToast("Proposta de troca enviada com sucesso!", "success");
      
      // Limpar campos
      setTradeSendPlayers([]);
      setTradeReceivePlayers([]);
      setTradeOfferMoney("0");
      setTradeRequestMoney("0");
      setProposingTrade(false);
      setSelectedTargetTeamId("");
      setTargetSquad([]);
      
      // Recarregar trocas
      await loadTradesData(myTeam.id);
    } catch (err) {
      showToast("Erro ao propor troca: " + err.message, "error");
    } finally {
      setTradeSubmitting(false);
    }
  };

  // Aceitar Proposta de Troca
  const handleAcceptTrade = async (tradeId) => {
    setConfirmModal({
      title: "Aceitar Proposta de Troca",
      message: "Deseja aceitar esta proposta de troca? Os jogadores envolvidos serão transferidos de time e os caixas serão atualizados.",
      onConfirm: async () => {
        setActionLoading(tradeId);
        try {
          const data = await transferService.acceptTradeOffer(tradeId);

          if (data && data.success) {
            showToast(data.message, "success");
            
            // Notificar o proponente (sender) de que a troca foi aceita
            const trade = receivedTrades.find(t => t.id === tradeId);
            if (trade?.sender_team?.user_id) {
              await transferService.sendNotification(
                trade.sender_team.user_id,
                "Proposta de Troca Aceita 🤝",
                `O time ${myTeam.name} aceitou a proposta de troca enviada por você!`
              );
            }

            // Recarregar dados de trocas e meu time
            const teamData = await teamService.getTeamById(myTeam.id);
            setMyTeam(teamData);

            await loadTradesData(myTeam.id);
          } else {
            showToast(data.message || "Erro desconhecido ao aceitar a troca.", "error");
          }
        } catch (err) {
          showToast("Erro ao finalizar troca: " + err.message, "error");
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  // Rejeitar Proposta de Troca
  const handleRejectTrade = async (tradeId) => {
    setConfirmModal({
      title: "Recusar Proposta de Troca",
      message: "Deseja recusar esta proposta de troca?",
      onConfirm: async () => {
        setActionLoading(tradeId);
        try {
          await transferService.updateTradeStatus(tradeId, "rejected");

          // Notificar o proponente (sender) de que a troca foi recusada
          const trade = receivedTrades.find(t => t.id === tradeId);
          if (trade?.sender_team?.user_id) {
            await transferService.sendNotification(
              trade.sender_team.user_id,
              "Proposta de Troca Recusada ❌",
              `O time ${myTeam.name} recusou a proposta de troca de jogadores.`
            );
          }

          showToast("Proposta recusada com sucesso!", "success");
          await loadTradesData(myTeam.id);
        } catch (err) {
          showToast("Erro ao recusar: " + err.message, "error");
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  // Cancelar Proposta de Troca Enviada
  const handleCancelTrade = async (tradeId) => {
    setConfirmModal({
      title: "Cancelar Proposta de Troca",
      message: "Deseja cancelar esta proposta enviada?",
      onConfirm: async () => {
        setActionLoading(tradeId);
        try {
          await transferService.updateTradeStatus(tradeId, "cancelled");

          // Notificar o destinatário (receiver) de que a troca foi cancelada pelo remetente
          const trade = sentTrades.find(t => t.id === tradeId);
          if (trade?.receiver_team?.user_id) {
            await transferService.sendNotification(
              trade.receiver_team.user_id,
              "Proposta de Troca Cancelada ⚠️",
              `O time ${myTeam.name} cancelou a proposta de troca enviada anteriormente.`
            );
          }

          showToast("Proposta de troca cancelada com sucesso!", "success");
          await loadTradesData(myTeam.id);
        } catch (err) {
          showToast("Erro ao cancelar: " + err.message, "error");
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  // Alterna checkboxes para envio de jogadores na troca
  const toggleSendPlayer = (playerId) => {
    setTradeSendPlayers((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
  };

  // Alterna checkboxes para recebimento de jogadores na troca
  const toggleReceivePlayer = (playerId) => {
    setTradeReceivePlayers((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Central de Negociações & Leilões
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Gerencie suas propostas de troca, negocie jogadores e acesse leilões de outros clubes.
          </p>
        </div>
        
        {myTeam && (
          <div className="glass-card px-5 py-3 rounded-2xl border border-[#10b981]/20 bg-[#10b981]/5 flex items-center gap-3 shrink-0 shadow-lg">
            <div className="bg-[#10b981]/20 p-2 rounded-xl">
              <span className="text-xl">💰</span>
            </div>
            <div>
              <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">Orçamento Disponível</p>
              <p className="text-lg font-black text-white leading-tight">R$ {parseFloat(myTeam.budget || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("trades")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "trades"
              ? "border-[#10b981] text-white"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Trocas & Propostas
        </button>
        <button
          onClick={() => setActiveTab("global")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "global"
              ? "border-[#10b981] text-white"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Leilões (Mercado Global)
        </button>
        <button
          onClick={() => setActiveTab("sell")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "sell"
              ? "border-[#10b981] text-white"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Listar Jogador
        </button>
      </div>

      {/* Aba 1: Mercado Global */}
      {activeTab === "global" && (
        <AuctionListings
          marketListings={marketListings}
          myTeam={myTeam}
          actionLoading={actionLoading}
          handleBuyListing={handleBuyListing}
          handleCancelListing={handleCancelListing}
          handlePlaceBid={handlePlaceBid}
          openPlayerProfile={openPlayerProfile}
        />
      )}

      {/* Aba 2: Vender Jogador */}
      {activeTab === "sell" && (
        <CreateListingForm
          mySquad={mySquad}
          selectedPlayerId={selectedPlayerId}
          setSelectedPlayerId={setSelectedPlayerId}
          listingType={listingType}
          setListingType={setListingType}
          price={price}
          setPrice={setPrice}
          durationHours={durationHours}
          setDurationHours={setDurationHours}
          buyoutPrice={buyoutPrice}
          setBuyoutPrice={setBuyoutPrice}
          listingLoading={listingLoading}
          handleCreateListing={handleCreateListing}
        />
      )}

      {/* Aba 3: Trocas & Propostas */}
      {activeTab === "trades" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
            <div>
              <h2 className="text-lg font-bold text-white">Gestão de Trocas</h2>
              <p className="text-xs text-gray-500">Avalie ofertas recebidas e enviadas, ou inicie uma nova negociação direta.</p>
            </div>
            <button
              onClick={() => {
                setProposingTrade(true);
                setSelectedTargetTeamId("");
                setTargetSquad([]);
                setTradeSendPlayers([]);
                setTradeReceivePlayers([]);
              }}
              className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
            >
              <span>+</span> Propor Nova Troca
            </button>
          </div>

          <TradeProposals
            myTeam={myTeam}
            receivedTrades={receivedTrades}
            sentTrades={sentTrades}
            handleAcceptTrade={handleAcceptTrade}
            handleRejectTrade={handleRejectTrade}
            handleCancelTrade={handleCancelTrade}
            openChat={(trade, type) => {
              setActiveChat({ type: 'trade', id: trade.id, name: type === 'received' ? trade.sender_team?.name : trade.target_team?.name });
              loadChatMessages('trade', trade.id);
            }}
            actionLoading={actionLoading}
          />
        </div>
      )}

      {/* Modal de Propor Nova Troca */}
      <TradeProposalModal
        isOpen={proposingTrade}
        onClose={() => setProposingTrade(false)}
        otherTeams={otherTeams}
        selectedTargetTeamId={selectedTargetTeamId}
        handleTargetTeamChange={handleTargetTeamChange}
        mySquad={mySquad}
        targetSquad={targetSquad}
        tradeSendPlayers={tradeSendPlayers}
        toggleSendPlayer={toggleSendPlayer}
        tradeReceivePlayers={tradeReceivePlayers}
        toggleReceivePlayer={toggleReceivePlayer}
        tradeOfferMoney={tradeOfferMoney}
        setTradeOfferMoney={setTradeOfferMoney}
        tradeRequestMoney={tradeRequestMoney}
        setTradeRequestMoney={setTradeRequestMoney}
        myTeam={myTeam}
        tradeSubmitting={tradeSubmitting}
        handleSendTradeOffer={handleSendTradeOffer}
      />

      {/* Painel/Modal do Chat de Negociação (Fase 2) */}
      {/* Painel/Modal do Chat de Negociação (Fase 2) */}
      {activeChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-panel w-full max-w-lg h-[500px] flex flex-col justify-between p-6 rounded-2xl border border-white/10 bg-[#090d16]/95 shadow-2xl relative text-left">
            {/* Header do Chat */}
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Chat de Negociação</h3>
                <p className="text-[10px] text-gray-400">Conversando sobre a proposta de {activeChat.type === "trade" ? "Troca" : "Empréstimo"} ({activeChat.name})</p>
              </div>
              <button
                onClick={() => {
                  setActiveChat(null);
                  setChatMessages([]);
                }}
                className="text-gray-400 hover:text-white text-xs bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg"
              >
                Fechar
              </button>
            </div>

            {/* Corpo com mensagens */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {chatMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-500">
                  Nenhuma mensagem enviada. Comece a negociar abaixo!
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.sender_id === myTeam?.user_id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-md ${
                        isMe
                          ? "bg-gradient-to-r from-[#10b981] to-[#059669] text-white rounded-tr-none"
                          : "bg-white/5 border border-white/5 text-gray-300 rounded-tl-none"
                      }`}>
                        <div className="font-bold text-[9px] text-white/60 mb-0.5">
                          {isMe ? "Você" : msg.profiles?.display_name || "Adversário"}
                        </div>
                        <p className="leading-relaxed font-sans text-white">{msg.message}</p>
                        <span className="text-[8px] text-white/40 block text-right mt-1">
                          {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input de envio */}
            <form noValidate onSubmit={handleSendMessage} className="border-t border-white/5 pt-3 flex gap-2">
              <input
                type="text"
                placeholder="Digite sua mensagem de contraproposta..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-white text-xs outline-none focus:border-[#10b981]"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-5 py-2.5 text-xs font-bold text-white shadow-lg transition-all"
              >
                Enviar
              </button>
            </form>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fadeIn">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 bg-[#090d16]/95 shadow-2xl relative text-left">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <span>❓</span> {confirmModal.title}
            </h3>
            <p className="text-xs text-gray-300 mb-6 whitespace-pre-line leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.onCancel) confirmModal.onCancel();
                  setConfirmModal(null);
                }}
                className="flex-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-3 text-sm font-bold text-white transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="flex-1 rounded-xl bg-[#10b981] hover:bg-[#059669] py-3 text-sm font-bold text-white transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Perfil do Jogador (Side-peeking / Modal) */}
      <PlayerProfileModal
        isOpen={!!selectedPlayerForProfile}
        onClose={() => setSelectedPlayerForProfile(null)}
        player={selectedPlayerForProfile}
        stats={playerStats}
        loading={statsLoading}
      />
    </div>
  );
}
