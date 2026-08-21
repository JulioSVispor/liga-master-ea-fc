import { supabase } from "@/lib/supabase";
import { assertMutationsAllowed } from "@/lib/maintenance";

export const transferService = {
  // --- MARKET LISTINGS ---
  
  async getMarketListings() {
    const { data, error } = await supabase
      .from("market_catalog")
      .select("id, player_id, seller_team_id, listing_type, price, buyout_price, status, end_date, created_at, players, teams")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async createMarketListing({ playerId, listingType, price, buyoutPrice, durationHours }) {
    assertMutationsAllowed();
    const { data, error } = await supabase.rpc("create_market_listing", {
      p_player_id: playerId,
      p_listing_type: listingType,
      p_price: Number(price),
      p_buyout_price: buyoutPrice ? Number(buyoutPrice) : null,
      p_duration_hours: Number(durationHours),
    });
    if (error) throw error;
    return data;
  },

  async cancelMarketListing(listingId) {
    assertMutationsAllowed();
    const { data, error } = await supabase.rpc("cancel_market_listing", { p_listing_id: listingId });
    if (error) throw error;
    return data;
  },

  async buyMarketListing(listingId) {
    assertMutationsAllowed();
    const { data, error } = await supabase.rpc("buy_market_listing", {
      p_listing_id: listingId,
    });

    if (error) throw error;
    return data;
  },

  async placeAuctionBid(listingId, amount) {
    assertMutationsAllowed();
    const { data, error } = await supabase.rpc("place_auction_bid", {
      p_listing_id: listingId,
      p_amount: amount,
    });

    if (error) throw error;
    return data;
  },

  // --- LOAN OFFERS ---

  async sendLoanOffer({ receiverTeamId, playerId, salarySharePct, durationWeeks }) {
    assertMutationsAllowed();
    const { data, error } = await supabase.rpc("create_loan_offer", {
      p_receiver_team_id: receiverTeamId,
      p_player_id: playerId,
      p_salary_share_pct: Number(salarySharePct),
      p_duration_weeks: Number(durationWeeks),
    });
    if (error) throw error;
    return data;
  },

  async acceptLoanOffer(loanId) {
    assertMutationsAllowed();
    const { data, error } = await supabase.rpc("accept_loan_offer", {
      p_offer_id: loanId,
    });
    if (error) throw error;
    return data;
  },

  async updateLoanStatus(loanId, status) {
    assertMutationsAllowed();
    const rpc = status === "rejected" ? "reject_loan_offer" : "cancel_loan_offer";
    const { data, error } = await supabase.rpc(rpc, { p_offer_id: loanId });
    if (error) throw error;
    return data;
  },

  // --- TRADES AND LOANS (Aggregated) ---

  async getPendingTradesAndLoans(teamId) {
    const [
      { data: receivedTrades },
      { data: sentTrades },
      { data: receivedLoans },
      { data: sentLoans },
      { data: directory }
    ] = await Promise.all([
      supabase
        .from("trade_offers")
        .select("*, trade_players(*, players(*))")
        .eq("receiver_team_id", teamId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("trade_offers")
        .select("*, trade_players(*, players(*))")
        .eq("sender_team_id", teamId)
        .order("created_at", { ascending: false }),
      supabase
        .from("loan_offers")
        .select("*, players(*)")
        .eq("receiver_team_id", teamId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("loan_offers")
        .select("*, players(*)")
        .eq("sender_team_id", teamId)
        .order("created_at", { ascending: false }),
      supabase.from("team_directory").select("id, name, real_club_name, badge_url, coach_name")
    ]);

    const teamsById = new Map((directory || []).map((team) => [team.id, team]));
    const decorateTrade = (trade) => ({
      ...trade,
      sender_team: teamsById.get(trade.sender_team_id) || null,
      receiver_team: teamsById.get(trade.receiver_team_id) || null,
      target_team: teamsById.get(trade.receiver_team_id) || null,
    });
    const decorateLoan = (loan) => ({
      ...loan,
      sender_team: teamsById.get(loan.sender_team_id) || null,
      receiver_team: teamsById.get(loan.receiver_team_id) || null,
    });

    return {
      receivedTrades: (receivedTrades || []).map(decorateTrade),
      sentTrades: (sentTrades || []).map(decorateTrade),
      receivedLoans: (receivedLoans || []).map(decorateLoan),
      sentLoans: (sentLoans || []).map(decorateLoan)
    };
  },

  // --- TRADE OFFERS ---

  async sendTradeOffer({ receiverTeamId, offerMoney, requestMoney, sendPlayerIds, receivePlayerIds }) {
    assertMutationsAllowed();
    const { data, error } = await supabase.rpc("create_trade_offer", {
      p_receiver_team_id: receiverTeamId,
      p_offered_money: Number(offerMoney),
      p_requested_money: Number(requestMoney),
      p_send_player_ids: sendPlayerIds,
      p_receive_player_ids: receivePlayerIds,
    });
    if (error) throw error;
    return data;
  },

  async acceptTradeOffer(tradeId) {
    assertMutationsAllowed();
    const { data, error } = await supabase.rpc("accept_trade_offer", {
      p_trade_id: tradeId,
    });
    if (error) throw error;
    return data;
  },

  async updateTradeStatus(tradeId, status) {
    assertMutationsAllowed();
    const rpc = status === "rejected" ? "reject_trade_offer" : "cancel_trade_offer";
    const { data, error } = await supabase.rpc(rpc, { p_trade_id: tradeId });
    if (error) throw error;
    return data;
  },

  // --- NEGOTIATION CHAT ---

  async getChatMessages(chatType, chatId) {
    const field = chatType === 'trade' ? 'trade_offer_id' : 'loan_offer_id';
    const { data, error } = await supabase
      .from("negotiation_messages")
      .select("id, trade_offer_id, loan_offer_id, sender_id, message, created_at")
      .eq(field, chatId)
      .order("created_at", { ascending: true });
    
    if (error) throw error;
    const senderIds = [...new Set((data || []).map((message) => message.sender_id))];
    const { data: profiles } = senderIds.length
      ? await supabase.from("public_profiles").select("id, display_name").in("id", senderIds)
      : { data: [] };
    const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    return (data || []).map((message) => ({ ...message, profiles: profilesById.get(message.sender_id) || null }));
  },

  async sendChatMessage(chatType, chatId, senderId, message) {
    assertMutationsAllowed();
    const { data, error } = await supabase.rpc("send_negotiation_message", {
      p_trade_offer_id: chatType === "trade" ? chatId : null,
      p_loan_offer_id: chatType === "loan" ? chatId : null,
      p_message: message.trim(),
    });
    if (error) throw error;
    return data;
  },

  // --- NOTIFICATIONS (Utility within transfers) ---

  async sendNotification(userId, title, content) {
    // Notificações de domínio são emitidas pelas RPCs na mesma transação.
    return Boolean(userId && title && content);
  }
};
