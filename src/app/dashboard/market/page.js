"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Market() {
  const [activeTab, setActiveTab] = useState("global"); // global, sell, trades
  const [loading, setLoading] = useState(true);
  const [myTeam, setMyTeam] = useState(null);
  const [marketListings, setMarketListings] = useState([]);
  const [mySquad, setMySquad] = useState([]);
  
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

  // Carregar dados principais
  useEffect(() => {
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
          const { data: squad } = await supabase
            .from("players")
            .select("*")
            .eq("team_id", teamData.id)
            .order("rating", { ascending: false });

          setMySquad(squad || []);

          if (activeTab === "global") {
            // Carregar anúncios globais
            const { data: listings } = await supabase
              .from("market_listings")
              .select("*, players(*), teams(name)")
              .eq("status", "active")
              .order("created_at", { ascending: false });
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
  }, [activeTab]);

  // Carrega propostas de trocas enviadas e recebidas e outros times
  const loadTradesData = async (myTeamId) => {
    try {
      // 1. Outros times para propor trocas
      const { data: teams } = await supabase
        .from("teams")
        .select("*")
        .neq("id", myTeamId);
      setOtherTeams(teams || []);

      // 2. Trocas recebidas pendentes
      const { data: received } = await supabase
        .from("trade_offers")
        .select("*, sender_team:teams!sender_team_id(name), trade_players(*, players(*))")
        .eq("receiver_team_id", myTeamId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      setReceivedTrades(received || []);

      // 3. Trocas enviadas pendentes
      const { data: sent } = await supabase
        .from("trade_offers")
        .select("*, receiver_team:teams!receiver_team_id(name), trade_players(*, players(*))")
        .eq("sender_team_id", myTeamId)
        .order("created_at", { ascending: false });
      setSentTrades(sent || []);

      // 4. Empréstimos recebidos pendentes
      const { data: recLoans } = await supabase
        .from("loan_offers")
        .select("*, sender_team:teams!sender_team_id(name), players(*)")
        .eq("receiver_team_id", myTeamId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      setReceivedLoans(recLoans || []);

      // 5. Empréstimos enviados pendentes/gerais
      const { data: sLoans } = await supabase
        .from("loan_offers")
        .select("*, receiver_team:teams!receiver_team_id(name), players(*)")
        .eq("sender_team_id", myTeamId)
        .order("created_at", { ascending: false });
      setSentLoans(sLoans || []);
    } catch (err) {
      console.error("Erro ao carregar dados de trocas e empréstimos:", err);
    }
  };

  // Carregar mensagens do Chat de Negociação
  const loadChatMessages = async (chat) => {
    try {
      const field = chat.type === 'trade' ? 'trade_offer_id' : 'loan_offer_id';
      const { data, error } = await supabase
        .from("negotiation_messages")
        .select("*, profiles(display_name)")
        .eq(field, chat.id)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      setChatMessages(data || []);
    } catch (err) {
      console.error("Erro ao carregar chat:", err);
    }
  };

  // Polling para Chat
  useEffect(() => {
    if (!activeChat) return;

    loadChatMessages(activeChat);
    const interval = setInterval(() => {
      loadChatMessages(activeChat);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeChat]);

  // Enviar Mensagem no Chat
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !myTeam) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const field = activeChat.type === 'trade' ? 'trade_offer_id' : 'loan_offer_id';
      const { error } = await supabase
        .from("negotiation_messages")
        .insert({
          [field]: activeChat.id,
          sender_id: session.user.id,
          message: newMessage.trim()
        });

      if (error) throw error;

      setNewMessage("");
      await loadChatMessages(activeChat);
    } catch (err) {
      alert("Erro ao enviar mensagem: " + err.message);
    }
  };

  // Aceitar Empréstimo
  const handleAcceptLoan = async (loanId) => {
    const confirmAccept = window.confirm(
      "Deseja aceitar esta proposta de empréstimo? O jogador será transferido temporariamente para o time de destino e o salário dividido conforme o acordo."
    );
    if (!confirmAccept) return;

    setActionLoading(loanId);
    try {
      const { data, error } = await supabase.rpc("accept_loan_offer", {
        p_offer_id: loanId,
      });

      if (error) throw error;

      if (data && data.success) {
        alert(data.message);
        const { data: teamData } = await supabase
          .from("teams")
          .select("*")
          .eq("id", myTeam.id)
          .single();
        setMyTeam(teamData);
        await loadTradesData(myTeam.id);
      } else {
        alert(data.message || "Erro desconhecido ao aceitar o empréstimo.");
      }
    } catch (err) {
      alert("Erro ao finalizar empréstimo: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Rejeitar Empréstimo
  const handleRejectLoan = async (loanId) => {
    const confirmReject = window.confirm("Deseja recusar esta proposta de empréstimo?");
    if (!confirmReject) return;

    setActionLoading(loanId);
    try {
      const { error } = await supabase
        .from("loan_offers")
        .update({ status: "rejected" })
        .eq("id", loanId);

      if (error) throw error;

      alert("Proposta de empréstimo recusada!");
      await loadTradesData(myTeam.id);
    } catch (err) {
      alert("Erro ao recusar: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Cancelar Empréstimo
  const handleCancelLoan = async (loanId) => {
    const confirmCancel = window.confirm("Deseja cancelar esta proposta de empréstimo enviada?");
    if (!confirmCancel) return;

    setActionLoading(loanId);
    try {
      const { error } = await supabase
        .from("loan_offers")
        .update({ status: "cancelled" })
        .eq("id", loanId);

      if (error) throw error;

      alert("Proposta de empréstimo cancelada!");
      await loadTradesData(myTeam.id);
    } catch (err) {
      alert("Erro ao cancelar: " + err.message);
    } finally {
      setActionLoading(null);
    }
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
      const { data: squad } = await supabase
        .from("players")
        .select("*")
        .eq("team_id", targetTeamId)
        .order("rating", { ascending: false });
      setTargetSquad(squad || []);
    } catch (err) {
      alert("Erro ao buscar elenco adversário.");
    }
  };

  // Criar anúncio de jogador
  const handleCreateListing = async (e) => {
    e.preventDefault();
    if (!myTeam || !selectedPlayerId || !price) {
      alert("Por favor, preencha todos os campos do anúncio.");
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert("Preço inválido.");
      return;
    }

    const player = mySquad.find((p) => p.id.toString() === selectedPlayerId.toString());
    if (!player) return;

    const confirmList = window.confirm(
      `Deseja listar ${player.name} no mercado por R$ ${priceNum.toLocaleString("pt-BR")}? \nEle sairá do seu elenco disponível para jogos enquanto estiver anunciado.`
    );

    if (!confirmList) return;

    setListingLoading(true);

    try {
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + parseInt(durationHours));

      // 1. Criar listagem
      const { error: listError } = await supabase
        .from("market_listings")
        .insert([
          {
            player_id: player.id,
            seller_team_id: myTeam.id,
            listing_type: listingType,
            price: priceNum,
            buyout_price: buyoutPrice ? parseFloat(buyoutPrice) : null,
            status: "active",
            end_date: listingType === "auction" ? expirationDate.toISOString() : null,
          },
        ]);

      if (listError) throw listError;

      // 2. Desvincular jogador do time
      const { error: playerError } = await supabase
        .from("players")
        .update({ team_id: null })
        .eq("id", player.id);

      if (playerError) throw playerError;

      alert("Jogador anunciado com sucesso!");
      setSelectedPlayerId("");
      setPrice("");
      setBuyoutPrice("");
      setActiveTab("global");
    } catch (err) {
      alert("Erro ao anunciar jogador: " + err.message);
    } finally {
      setListingLoading(false);
    }
  };

  // Comprar anúncio de compra imediata
  const handleBuyListing = async (listing) => {
    if (!myTeam) return;

    const confirmBuy = window.confirm(
      `Deseja comprar ${listing.players.name} por R$ ${parseFloat(listing.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}?`
    );

    if (!confirmBuy) return;

    setActionLoading(listing.id);

    try {
      const { data, error } = await supabase.rpc("buy_market_listing", {
        p_listing_id: listing.id,
        p_buyer_team_id: myTeam.id,
      });

      if (error) throw error;

      if (data && data.success) {
        alert(data.message);
        setMyTeam((prev) => ({ ...prev, budget: prev.budget - listing.price }));
        setMarketListings((prev) => prev.filter((item) => item.id !== listing.id));
      } else {
        alert(data.message || "Erro ao tentar comprar.");
      }
    } catch (err) {
      alert("Falha na compra: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Dar lance no leilão
  const handlePlaceBid = async (listing) => {
    if (!myTeam) return;

    const bidVal = bidAmounts[listing.id];
    if (!bidVal) {
      alert("Insira um valor de lance.");
      return;
    }

    const bidNum = parseFloat(bidVal);
    if (isNaN(bidNum) || bidNum <= listing.price) {
      alert(`O lance deve ser maior que o valor mínimo.`);
      return;
    }

    const confirmBid = window.confirm(
      `Deseja registrar o lance de R$ ${bidNum.toLocaleString("pt-BR")} no jogador ${listing.players.name}?`
    );

    if (!confirmBid) return;

    setActionLoading(listing.id);

    try {
      const { data, error } = await supabase.rpc("place_auction_bid", {
        p_listing_id: listing.id,
        p_bidder_team_id: myTeam.id,
        p_amount: bidNum,
      });

      if (error) throw error;

      if (data && data.success) {
        alert(data.message);
        // Recarregar
        const { data: updatedListings } = await supabase
          .from("market_listings")
          .select("*, players(*), teams(name)")
          .eq("status", "active")
          .order("created_at", { ascending: false });

        setMarketListings(updatedListings || []);
        setBidAmounts((prev) => ({ ...prev, [listing.id]: "" }));
      } else {
        alert(data.message || "Erro ao lançar.");
      }
    } catch (err) {
      alert("Erro ao registrar lance: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Cancelar anúncio
  const handleCancelListing = async (listing) => {
    const confirmCancel = window.confirm(
      `Deseja cancelar o anúncio de ${listing.players.name}? Ele retornará ao seu time.`
    );

    if (!confirmCancel) return;

    setActionLoading(listing.id);

    try {
      const { error: listErr } = await supabase
        .from("market_listings")
        .update({ status: "cancelled" })
        .eq("id", listing.id);

      if (listErr) throw listErr;

      const { error: playerErr } = await supabase
        .from("players")
        .update({ team_id: listing.seller_team_id })
        .eq("id", listing.player_id);

      if (playerErr) throw playerErr;

      alert("Anúncio cancelado!");
      setMarketListings((prev) => prev.filter((item) => item.id !== listing.id));
    } catch (err) {
      alert("Erro ao cancelar: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Enviar proposta de troca direta (Trade)
  const handleSendTradeOffer = async (e) => {
    e.preventDefault();
    if (!myTeam || !selectedTargetTeamId) return;

    if (tradeSendPlayers.length === 0 && tradeReceivePlayers.length === 0) {
      alert("Por favor, selecione pelo menos um jogador envolvido na troca.");
      return;
    }

    const offerMoneyNum = parseFloat(tradeOfferMoney) || 0;
    const requestMoneyNum = parseFloat(tradeRequestMoney) || 0;

    if (offerMoneyNum < 0 || requestMoneyNum < 0) {
      alert("Valores monetários não podem ser negativos.");
      return;
    }

    if (offerMoneyNum > myTeam.budget) {
      alert("Você não possui saldo para cobrir o valor em dinheiro oferecido.");
      return;
    }

    const confirmTrade = window.confirm("Deseja enviar esta proposta de troca?");
    if (!confirmTrade) return;

    setTradeSubmitting(true);

    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48); // Expiração em 48h

      // 1. Criar proposta de troca
      const { data: tradeOffer, error: tradeErr } = await supabase
        .from("trade_offers")
        .insert([
          {
            sender_team_id: myTeam.id,
            receiver_team_id: selectedTargetTeamId,
            offered_money: offerMoneyNum,
            requested_money: requestMoneyNum,
            status: "pending",
            expires_at: expiresAt.toISOString(),
          },
        ])
        .select()
        .single();

      if (tradeErr) throw tradeErr;

      // 2. Associar jogadores à proposta
      const tradePlayers = [];

      tradeSendPlayers.forEach((pid) => {
        tradePlayers.push({
          trade_offer_id: tradeOffer.id,
          player_id: pid,
          direction: "send",
        });
      });

      tradeReceivePlayers.forEach((pid) => {
        tradePlayers.push({
          trade_offer_id: tradeOffer.id,
          player_id: pid,
          direction: "receive",
        });
      });

      const { error: playersErr } = await supabase
        .from("trade_players")
        .insert(tradePlayers);

      if (playersErr) throw playersErr;

      alert("Proposta de troca enviada com sucesso!");
      
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
      alert("Erro ao propor troca: " + err.message);
    } finally {
      setTradeSubmitting(false);
    }
  };

  // Aceitar Proposta de Troca
  const handleAcceptTrade = async (tradeId) => {
    const confirmAccept = window.confirm(
      "Deseja aceitar esta proposta de troca? Os jogadores envolvidos serão transferidos de time e os caixas serão atualizados."
    );

    if (!confirmAccept) return;

    setActionLoading(tradeId);

    try {
      const { data, error } = await supabase.rpc("accept_trade_offer", {
        p_trade_id: tradeId,
      });

      if (error) throw error;

      if (data && data.success) {
        alert(data.message);
        // Recarregar dados de trocas e meu time
        const { data: teamData } = await supabase
          .from("teams")
          .select("*")
          .eq("id", myTeam.id)
          .single();
        setMyTeam(teamData);

        await loadTradesData(myTeam.id);
      } else {
        alert(data.message || "Erro desconhecido ao aceitar a troca.");
      }
    } catch (err) {
      alert("Erro ao finalizar troca: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Rejeitar Proposta de Troca
  const handleRejectTrade = async (tradeId) => {
    const confirmReject = window.confirm("Deseja recusar esta proposta de troca?");
    if (!confirmReject) return;

    setActionLoading(tradeId);

    try {
      const { error } = await supabase
        .from("trade_offers")
        .update({ status: "rejected" })
        .eq("id", tradeId);

      if (error) throw error;

      alert("Proposta recusada!");
      await loadTradesData(myTeam.id);
    } catch (err) {
      alert("Erro ao recusar: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Cancelar Proposta de Troca Enviada
  const handleCancelTrade = async (tradeId) => {
    const confirmCancel = window.confirm("Deseja cancelar esta proposta enviada?");
    if (!confirmCancel) return;

    setActionLoading(tradeId);

    try {
      const { error } = await supabase
        .from("trade_offers")
        .update({ status: "cancelled" })
        .eq("id", tradeId);

      if (error) throw error;

      alert("Proposta de troca cancelada!");
      await loadTradesData(myTeam.id);
    } catch (err) {
      alert("Erro ao cancelar: " + err.message);
    } finally {
      setActionLoading(null);
    }
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
            Mercado de Transferências
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Adquira atletas listados por outros clubes ou comercialize jogadores do seu próprio elenco.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 gap-2">
        <button
          onClick={() => setActiveTab("global")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "global"
              ? "border-[#10b981] text-white"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Mercado Global
        </button>
        <button
          onClick={() => setActiveTab("sell")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "sell"
              ? "border-[#10b981] text-white"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Vender Jogador
        </button>
        <button
          onClick={() => setActiveTab("trades")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "trades"
              ? "border-[#10b981] text-white"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          Trocas & Propostas
        </button>
      </div>

      {/* Aba 1: Mercado Global */}
      {activeTab === "global" && (
        <div className="space-y-6">
          {marketListings.length === 0 ? (
            <div className="glass-card py-16 text-center rounded-2xl">
              <span className="text-4xl block mb-2">🏪</span>
              <p className="text-sm text-gray-400">Não há anúncios ativos no mercado no momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {marketListings.map((listing) => {
                const isMyListing = listing.seller_team_id === myTeam?.id;
                const isAuction = listing.listing_type === "auction";

                return (
                  <div
                    key={listing.id}
                    className="glass-card rounded-2xl overflow-hidden flex flex-col justify-between border border-white/5 bg-[#090d16]/30 relative"
                  >
                    {/* Badge de Overall / Posição */}
                    <div className="absolute top-4 left-4 flex flex-col items-center">
                      <span className="text-2xl font-black text-white leading-none">
                        {listing.players.rating}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">
                        {listing.players.position}
                      </span>
                    </div>

                    {/* Badge de Tipo de Venda */}
                    <div className="absolute top-4 right-4 flex gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        isAuction 
                          ? "bg-amber-500/10 border border-amber-500/20 text-amber-500" 
                          : "bg-emerald-500/10 border border-emerald-500/20 text-[#10b981]"
                      }`}>
                        {isAuction ? "Leilão" : "Compra Imediata"}
                      </span>
                      {isMyListing && (
                        <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[9px] font-bold text-blue-400">
                          Seu
                        </span>
                      )}
                    </div>

                    {/* Foto e Nome */}
                    <div className="pt-8 pb-3 px-6 flex flex-col items-center border-b border-white/5 bg-gradient-to-b from-white/[0.01] to-transparent">
                      <div className="h-16 w-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden mb-3">
                        {listing.players.face_url ? (
                          <img src={listing.players.face_url} alt={listing.players.name} className="h-full w-full object-cover scale-110" />
                        ) : (
                          <span className="text-2xl text-gray-600">👤</span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white text-center truncate w-full">
                        {listing.players.name}
                      </h3>
                      <p className="text-[10px] text-gray-500">
                        Vendido por: <strong className="text-gray-300">{listing.teams?.name || "Sistema"}</strong>
                      </p>
                    </div>

                    {/* Preço e Lances */}
                    <div className="p-4 bg-white/[0.01] space-y-4 flex-1 flex flex-col justify-between">
                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="bg-white/5 rounded-xl p-2">
                          <span className="text-[9px] uppercase font-semibold text-gray-500 block">
                            {isAuction ? "Lance Mínimo" : "Valor de Compra"}
                          </span>
                          <span className="text-sm font-black text-emerald-400">
                            R$ {(listing.price / 1000).toFixed(0)}k
                          </span>
                        </div>
                        <div className="bg-white/5 rounded-xl p-2">
                          <span className="text-[9px] uppercase font-semibold text-gray-500 block">Salário</span>
                          <span className="text-sm font-black text-gray-300">
                            R$ {listing.players.wage.toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </div>

                      {/* Controle de Compra/Lances */}
                      <div className="space-y-2 pt-2">
                        {isMyListing ? (
                          <button
                            onClick={() => handleCancelListing(listing)}
                            disabled={actionLoading !== null}
                            className="w-full rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 py-2.5 text-xs font-bold text-red-400 transition-all"
                          >
                            {actionLoading === listing.id ? "Removendo..." : "Cancelar Anúncio"}
                          </button>
                        ) : isAuction ? (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="number"
                                placeholder={`Min. R$ ${(listing.price + 1).toFixed(0)}`}
                                value={bidAmounts[listing.id] || ""}
                                onChange={(e) => setBidAmounts((prev) => ({
                                  ...prev,
                                  [listing.id]: e.target.value,
                                }))}
                                className="w-1/2 rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-white text-xs outline-none focus:border-amber-500"
                              />
                              <button
                                onClick={() => handlePlaceBid(listing)}
                                disabled={actionLoading !== null}
                                className="w-1/2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all py-2"
                              >
                                {actionLoading === listing.id ? "Enviando..." : "Dar Lance"}
                              </button>
                            </div>
                            {listing.end_date && (
                              <span className="text-[9px] text-gray-500 text-center block">
                                Encerra em: {new Date(listing.end_date).toLocaleString("pt-BR")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleBuyListing(listing)}
                            disabled={actionLoading !== null}
                            className="w-full rounded-xl bg-[#10b981] hover:bg-[#059669] py-2.5 text-xs font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                          >
                            {actionLoading === listing.id ? "Processando..." : "Comprar Agora"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Aba 2: Vender Jogador */}
      {activeTab === "sell" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formulário de Criação de Anúncio */}
          <div className="lg:col-span-2">
            <div className="glass-panel p-8 rounded-2xl border border-white/5 bg-[#090d16]/75">
              <h3 className="text-lg font-bold text-white mb-6">Criar Novo Anúncio no Mercado</h3>

              {mySquad.length === 0 ? (
                <p className="text-sm text-gray-400">Você não possui jogadores no elenco para anunciar.</p>
              ) : (
                <form className="space-y-6" onSubmit={handleCreateListing}>
                  {/* Escolha do Jogador */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Selecione o Jogador:
                    </label>
                    <select
                      value={selectedPlayerId}
                      onChange={(e) => {
                        setSelectedPlayerId(e.target.value);
                        const p = mySquad.find((item) => item.id.toString() === e.target.value.toString());
                        if (p) setPrice((p.wage * 10).toString());
                      }}
                      className="w-full rounded-xl border border-white/10 bg-[#090d16] py-3 px-4 text-white text-sm focus:border-[#10b981] outline-none"
                      required
                    >
                      <option value="">Selecione um jogador do elenco...</option>
                      {mySquad.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.name} (Position: {player.position} | Rating: {player.rating} | Salário: R$ {player.wage.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tipo de Anúncio */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Tipo de Anúncio:
                      </label>
                      <select
                        value={listingType}
                        onChange={(e) => setListingType(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-[#090d16] py-3 px-4 text-white text-sm focus:border-[#10b981] outline-none"
                      >
                        <option value="immediate_buy">Compra Imediata</option>
                        <option value="auction">Leilão por Lances</option>
                      </select>
                    </div>

                    {/* Preço */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        {listingType === "auction" ? "Preço Inicial (Lance Mín.)" : "Preço de Compra:"}
                      </label>
                      <input
                        type="number"
                        placeholder="Ex: R$ 15.000"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white text-sm focus:border-[#10b981] outline-none"
                        required
                      />
                    </div>
                  </div>

                  {/* Configurações Extra de Leilão */}
                  {listingType === "auction" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Duração */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          Duração do Leilão:
                        </label>
                        <select
                          value={durationHours}
                          onChange={(e) => setDurationHours(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-[#090d16] py-3 px-4 text-white text-sm focus:border-[#10b981] outline-none"
                        >
                          <option value="12">12 Horas</option>
                          <option value="24">24 Horas (Padrão)</option>
                          <option value="48">48 Horas</option>
                          <option value="72">72 Horas</option>
                        </select>
                      </div>

                      {/* Buyout Price */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          Preço de Arremate (Buyout - Opcional):
                        </label>
                        <input
                          type="number"
                          placeholder="Valor para compra imediata"
                          value={buyoutPrice}
                          onChange={(e) => setBuyoutPrice(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white text-sm focus:border-[#10b981] outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Submeter */}
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={listingLoading}
                      className="w-full sm:w-auto rounded-xl bg-[#10b981] hover:bg-[#059669] px-8 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99]"
                    >
                      {listingLoading ? "Anunciando..." : "Colocar no Mercado"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Dicas e Detalhes de Mercado */}
          <div className="glass-card p-6 rounded-2xl h-fit space-y-4">
            <h3 className="text-base font-bold text-white">Regras de Venda</h3>
            <ul className="space-y-3 text-xs text-gray-400 leading-relaxed font-sans">
              <li>
                ⚠️ Ao anunciar um jogador, ele será **removido temporariamente do seu time**. Ele não poderá ser escalado para reporte de partidas até que o anúncio seja concluído ou cancelado.
              </li>
              <li>
                📈 No formato de **Compra Imediata**, o primeiro participante que pagar o preço do anúncio contrata o atleta na hora.
              </li>
              <li>
                ⚖️ No formato de **Leilão**, os competidores dão lances livres. Ao fim do período do leilão, o administrador resolve a transação e o maior lance ganha o jogador.
              </li>
              <li>
                🔄 O valor de venda arrecadado será somado **integralmente** ao orçamento do seu clube.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Aba 3: Trocas & Propostas */}
      {activeTab === "trades" && (
        <div className="space-y-8">
          {/* Seção de Criação de Troca / Proposta */}
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Central de Negociação de Trocas</h2>
            <button
              onClick={() => {
                setProposingTrade(!proposingTrade);
                setSelectedTargetTeamId("");
                setTargetSquad([]);
                setTradeSendPlayers([]);
                setTradeReceivePlayers([]);
              }}
              className="rounded-xl bg-[#3b82f6] hover:bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-all"
            >
              {proposingTrade ? "Voltar para o Painel" : "Propor Nova Troca"}
            </button>
          </div>

          {proposingTrade ? (
            <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#090d16]/75">
              <h3 className="text-lg font-bold text-white mb-6">Propor Troca Direta</h3>
              
              <form onSubmit={handleSendTradeOffer} className="space-y-6">
                {/* Selecionar Time de Destino */}
                <div className="max-w-md">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Selecionar Time para Negociar:
                  </label>
                  <select
                    value={selectedTargetTeamId}
                    onChange={(e) => handleTargetTeamChange(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#090d16] py-3 px-4 text-white text-sm focus:border-[#3b82f6] outline-none"
                    required
                  >
                    <option value="">Selecione a equipe adversária...</option>
                    {otherTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.real_club_name})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTargetTeamId && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Meus Jogadores a Oferecer (Send) */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                        <h4 className="text-sm font-bold text-[#10b981] border-b border-white/5 pb-2">
                          Meus Jogadores a Oferecer (Enviar)
                        </h4>
                        {mySquad.length === 0 ? (
                          <p className="text-xs text-gray-500">Seu elenco está vazio.</p>
                        ) : (
                          <div className="max-h-72 overflow-y-auto space-y-2">
                            {mySquad.map((p) => (
                              <label
                                key={p.id}
                                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 cursor-pointer text-xs"
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={tradeSendPlayers.includes(p.id)}
                                    onChange={() => toggleSendPlayer(p.id)}
                                    className="rounded border-white/10 bg-[#090d16] text-[#10b981] focus:ring-0 h-4 w-4"
                                  />
                                  <div>
                                    <p className="font-bold text-white">{p.name}</p>
                                    <p className="text-[10px] text-gray-500">{p.position} • Rating {p.rating}</p>
                                  </div>
                                </div>
                                <span className="text-[10px] text-gray-400">Salário: {p.wage}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Jogadores Adversários a Receber (Receive) */}
                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
                        <h4 className="text-sm font-bold text-[#3b82f6] border-b border-white/5 pb-2">
                          Jogadores Desejados do Adversário (Receber)
                        </h4>
                        {targetSquad.length === 0 ? (
                          <p className="text-xs text-gray-500">Este time não possui jogadores cadastrados.</p>
                        ) : (
                          <div className="max-h-72 overflow-y-auto space-y-2">
                            {targetSquad.map((p) => (
                              <label
                                key={p.id}
                                className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 cursor-pointer text-xs"
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={tradeReceivePlayers.includes(p.id)}
                                    onChange={() => toggleReceivePlayer(p.id)}
                                    className="rounded border-white/10 bg-[#090d16] text-[#3b82f6] focus:ring-0 h-4 w-4"
                                  />
                                  <div>
                                    <p className="font-bold text-white">{p.name}</p>
                                    <p className="text-[10px] text-gray-500">{p.position} • Rating {p.rating}</p>
                                  </div>
                                </div>
                                <span className="text-[10px] text-gray-400">Salário: {p.wage}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Valores Monetários envolvidos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white/[0.01] border border-white/5 p-5 rounded-2xl">
                      <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">
                          Dinheiro Adicional Oferecido por Você (R$):
                        </label>
                        <input
                          type="number"
                          value={tradeOfferMoney}
                          onChange={(e) => setTradeOfferMoney(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-white text-sm focus:border-[#10b981] outline-none"
                          min="0"
                        />
                        <span className="text-[10px] text-gray-500 mt-1 block">Saldo disponível: R$ {parseFloat(myTeam.budget).toLocaleString()}</span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">
                          Dinheiro Solicitado ao Adversário (R$):
                        </label>
                        <input
                          type="number"
                          value={tradeRequestMoney}
                          onChange={(e) => setTradeRequestMoney(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-white text-sm focus:border-[#3b82f6] outline-none"
                          min="0"
                        />
                      </div>
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={tradeSubmitting}
                      className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-8 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                      {tradeSubmitting ? "Enviando Proposta..." : "Enviar Proposta de Troca"}
                    </button>
                  </div>
                )}
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Sub-abas de Trocas vs Empréstimos */}
              <div className="flex bg-white/5 p-1 rounded-xl w-fit gap-1">
                <button
                  onClick={() => setTradeOrLoanTab("trades")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    tradeOrLoanTab === "trades"
                      ? "bg-[#3b82f6] text-white"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  🔄 Trocas Diretas ({receivedTrades.length + sentTrades.filter(t => t.status === 'pending').length})
                </button>
                <button
                  onClick={() => setTradeOrLoanTab("loans")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    tradeOrLoanTab === "loans"
                      ? "bg-[#3b82f6] text-white"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  🤝 Empréstimos ({receivedLoans.length + sentLoans.filter(l => l.status === 'pending').length})
                </button>
              </div>

              {tradeOrLoanTab === "trades" ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Propostas Recebidas */}
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-white border-l-2 border-[#3b82f6] pl-2">
                      Propostas Recebidas ({receivedTrades.length})
                    </h3>

                    {receivedTrades.length === 0 ? (
                      <div className="glass-card py-10 text-center rounded-xl text-xs text-gray-500">
                        Você não possui propostas de trocas pendentes.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {receivedTrades.map((trade) => {
                          const offeredPlayers = trade.trade_players.filter((tp) => tp.direction === "send");
                          const requestedPlayers = trade.trade_players.filter((tp) => tp.direction === "receive");

                          return (
                            <div key={trade.id} className="glass-card p-5 rounded-2xl border border-white/5 space-y-4">
                              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                <span className="text-xs font-semibold text-gray-400">
                                  Proposta de: <strong className="text-white">{trade.sender_team?.name}</strong>
                                </span>
                                <span className="text-[10px] text-gray-500">
                                  Validade: {new Date(trade.expires_at).toLocaleDateString()}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-xs">
                                {/* O que ele oferece para nós */}
                                <div className="space-y-2">
                                  <span className="text-[9px] uppercase font-bold text-[#10b981]">Você Recebe:</span>
                                  <ul className="space-y-1">
                                    {offeredPlayers.map((tp) => (
                                      <li key={tp.id} className="text-gray-300">• {tp.players.name} ({tp.players.position} - Over {tp.players.rating})</li>
                                    ))}
                                    {trade.offered_money > 0 && (
                                      <li className="font-bold text-emerald-400">+ R$ {parseFloat(trade.offered_money).toLocaleString()}</li>
                                    )}
                                  </ul>
                                </div>

                                {/* O que ele quer em troca */}
                                <div className="space-y-2">
                                  <span className="text-[9px] uppercase font-bold text-[#3b82f6]">Você Envia:</span>
                                  <ul className="space-y-1">
                                    {requestedPlayers.map((tp) => (
                                      <li key={tp.id} className="text-gray-300">• {tp.players.name} ({tp.players.position} - Over {tp.players.rating})</li>
                                    ))}
                                    {trade.requested_money > 0 && (
                                      <li className="font-bold text-amber-500">+ R$ {parseFloat(trade.requested_money).toLocaleString()}</li>
                                    )}
                                  </ul>
                                </div>
                              </div>

                              {/* Ações */}
                              <div className="flex gap-2 pt-2 border-t border-white/5">
                                <button
                                  onClick={() => handleAcceptTrade(trade.id)}
                                  disabled={actionLoading !== null}
                                  className="w-1/3 rounded-xl bg-[#10b981] hover:bg-[#059669] py-2 text-xs font-bold text-white shadow"
                                >
                                  Aceitar
                                </button>
                                <button
                                  onClick={() => handleRejectTrade(trade.id)}
                                  disabled={actionLoading !== null}
                                  className="w-1/3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 py-2 text-xs font-bold text-red-400"
                                >
                                  Recusar
                                </button>
                                <button
                                  onClick={() => setActiveChat({ type: 'trade', id: trade.id, name: `${trade.sender_team?.name} x Você` })}
                                  className="w-1/3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-2 text-xs font-bold text-white flex items-center justify-center gap-1"
                                >
                                  💬 Chat
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Propostas Enviadas */}
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-white border-l-2 border-gray-500 pl-2">
                      Propostas Enviadas ({sentTrades.length})
                    </h3>

                    {sentTrades.length === 0 ? (
                      <div className="glass-card py-10 text-center rounded-xl text-xs text-gray-500">
                        Você não enviou nenhuma proposta recentemente.
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[500px] overflow-y-auto">
                        {sentTrades.map((trade) => {
                          const offeredPlayers = trade.trade_players.filter((tp) => tp.direction === "send");
                          const requestedPlayers = trade.trade_players.filter((tp) => tp.direction === "receive");

                          return (
                            <div key={trade.id} className="glass-card p-5 rounded-2xl border border-white/5 space-y-4 opacity-85">
                              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                <span className="text-xs font-semibold text-gray-400">
                                  Proposta para: <strong className="text-white">{trade.receiver_team?.name}</strong>
                                </span>
                                <span className={`text-[10px] uppercase font-black ${
                                  trade.status === "pending"
                                    ? "text-amber-400 animate-pulse"
                                    : trade.status === "accepted"
                                      ? "text-emerald-400"
                                      : "text-red-400"
                                }`}>
                                  {trade.status === "pending" ? "Pendente" : trade.status === "accepted" ? "Aceita" : "Recusada/Cancelada"}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="space-y-2">
                                  <span className="text-[9px] uppercase font-bold text-gray-500">Você Envia:</span>
                                  <ul className="space-y-1 text-gray-400">
                                    {offeredPlayers.map((tp) => (
                                      <li key={tp.id}>• {tp.players.name} ({tp.players.position})</li>
                                    ))}
                                    {trade.offered_money > 0 && (
                                      <li className="font-bold text-emerald-600">+ R$ {parseFloat(trade.offered_money).toLocaleString()}</li>
                                    )}
                                  </ul>
                                </div>

                                <div className="space-y-2">
                                  <span className="text-[9px] uppercase font-bold text-gray-500">Você Recebe:</span>
                                  <ul className="space-y-1 text-gray-400">
                                    {requestedPlayers.map((tp) => (
                                      <li key={tp.id}>• {tp.players.name} ({tp.players.position})</li>
                                    ))}
                                    {trade.requested_money > 0 && (
                                      <li className="font-bold text-blue-400">+ R$ {parseFloat(trade.requested_money).toLocaleString()}</li>
                                    )}
                                  </ul>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                {trade.status === "pending" && (
                                  <button
                                    onClick={() => handleCancelTrade(trade.id)}
                                    disabled={actionLoading !== null}
                                    className="w-1/2 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/10 hover:text-red-400 py-2 text-xs font-bold text-gray-300 transition-all"
                                  >
                                    Cancelar
                                  </button>
                                )}
                                <button
                                  onClick={() => setActiveChat({ type: 'trade', id: trade.id, name: `Você x ${trade.receiver_team?.name}` })}
                                  className={`${trade.status === "pending" ? "w-1/2" : "w-full"} rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-2 text-xs font-bold text-white flex items-center justify-center gap-1`}
                                >
                                  💬 Chat
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Empréstimos Recebidos */}
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-white border-l-2 border-[#3b82f6] pl-2">
                      Empréstimos Recebidos ({receivedLoans.length})
                    </h3>

                    {receivedLoans.length === 0 ? (
                      <div className="glass-card py-10 text-center rounded-xl text-xs text-gray-500">
                        Você não possui propostas de empréstimo pendentes.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {receivedLoans.map((loan) => (
                          <div key={loan.id} className="glass-card p-5 rounded-2xl border border-white/5 space-y-4">
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                              <span className="text-xs font-semibold text-gray-400">
                                Proposta de: <strong className="text-white">{loan.sender_team?.name}</strong>
                              </span>
                              <span className="text-[10px] text-gray-500">
                                Validade: {new Date(loan.expires_at).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="text-xs space-y-2">
                              <p className="text-gray-300">
                                Jogador solicitado: <strong className="text-white">{loan.players?.name}</strong> ({loan.players?.position} - Over {loan.players?.rating})
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/5 p-2 rounded-xl">
                                <div>
                                  <span className="text-gray-500 block">Duração:</span>
                                  <span className="text-white font-bold">{loan.duration_weeks} Semanas</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 block">Divisão Salarial:</span>
                                  <span className="text-[#3b82f6] font-bold">Você paga {100 - loan.salary_share_pct}% / Eles pagam {loan.salary_share_pct}%</span>
                                </div>
                              </div>
                            </div>

                            {/* Ações */}
                            <div className="flex gap-2 pt-2 border-t border-white/5">
                              <button
                                onClick={() => handleAcceptLoan(loan.id)}
                                disabled={actionLoading !== null}
                                className="w-1/3 rounded-xl bg-[#10b981] hover:bg-[#059669] py-2 text-xs font-bold text-white shadow"
                              >
                                Aceitar
                              </button>
                              <button
                                onClick={() => handleRejectLoan(loan.id)}
                                disabled={actionLoading !== null}
                                className="w-1/3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 py-2 text-xs font-bold text-red-400"
                              >
                                Recusar
                              </button>
                              <button
                                onClick={() => setActiveChat({ type: 'loan', id: loan.id, name: loan.players?.name })}
                                className="w-1/3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-2 text-xs font-bold text-white flex items-center justify-center gap-1"
                              >
                                💬 Chat
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Empréstimos Enviados */}
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-white border-l-2 border-gray-500 pl-2">
                      Empréstimos Enviados ({sentLoans.length})
                    </h3>

                    {sentLoans.length === 0 ? (
                      <div className="glass-card py-10 text-center rounded-xl text-xs text-gray-500">
                        Você não enviou propostas de empréstimo.
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[500px] overflow-y-auto">
                        {sentLoans.map((loan) => (
                          <div key={loan.id} className="glass-card p-5 rounded-2xl border border-white/5 space-y-4 opacity-90">
                            <div className="flex justify-between items-center border-b border-white/5 pb-2">
                              <span className="text-xs font-semibold text-gray-400">
                                Proposta para: <strong className="text-white">{loan.receiver_team?.name}</strong>
                              </span>
                              <span className={`text-[10px] uppercase font-black ${
                                loan.status === "pending"
                                  ? "text-amber-400 animate-pulse"
                                  : loan.status === "accepted"
                                    ? "text-emerald-400"
                                    : "text-red-400"
                              }`}>
                                {loan.status === "pending" ? "Pendente" : loan.status === "accepted" ? "Aceito" : "Recusado/Cancelado"}
                              </span>
                            </div>

                            <div className="text-xs space-y-2">
                              <p className="text-gray-300">
                                Jogador solicitado: <strong className="text-white">{loan.players?.name}</strong> ({loan.players?.position} - Over {loan.players?.rating})
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/5 p-2 rounded-xl">
                                <div>
                                  <span className="text-gray-500 block">Duração:</span>
                                  <span className="text-white font-bold">{loan.duration_weeks} Semanas</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 block">Divisão Salarial:</span>
                                  <span className="text-[#3b82f6] font-bold">Você paga {loan.salary_share_pct}% / Eles pagam {100 - loan.salary_share_pct}%</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-2 pt-2 border-t border-white/5">
                              {loan.status === "pending" && (
                                <button
                                  onClick={() => handleCancelLoan(loan.id)}
                                  disabled={actionLoading !== null}
                                  className="w-1/2 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/10 hover:text-red-400 py-2 text-xs font-bold text-gray-300 transition-all"
                                >
                                  Cancelar
                                </button>
                              )}
                              <button
                                onClick={() => setActiveChat({ type: 'loan', id: loan.id, name: loan.players?.name })}
                                className={`${loan.status === "pending" ? "w-1/2" : "w-full"} rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-2 text-xs font-bold text-white flex items-center justify-center gap-1`}
                              >
                                💬 Chat
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Painel/Modal do Chat de Negociação (Fase 2) */}
      {activeChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
            <form onSubmit={handleSendMessage} className="border-t border-white/5 pt-3 flex gap-2">
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
    </div>
  );
}
