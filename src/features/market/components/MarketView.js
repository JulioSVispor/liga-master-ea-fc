"use client";

import { useEffect, useState } from "react";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";
import PlayerProfileModal from "@/features/dashboard/components/PlayerProfileModal";
import { teamService } from "@/services/teamService";
import { playerService } from "@/services/playerService";
import { transferService } from "@/services/transferService";
import TradeProposals from "./TradeProposals";
import AuctionListings from "./AuctionListings";
import CreateListingForm from "./CreateListingForm";
import TradeProposalModal from "./modals/TradeProposalModal";

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

export function MarketView({ model }) {
  const {
    searchParams,
    tabQuery,
    showToast,
    openPlayerProfile,
    loadChatMessages,
    handleSendMessage,
    handleAcceptLoan,
    handleRejectLoan,
    handleCancelLoan,
    handleTargetTeamChange,
    handleCreateListing,
    handleBuyListing,
    handlePlaceBid,
    handleCancelListing,
    handleSendTradeOffer,
    handleAcceptTrade,
    handleRejectTrade,
    handleCancelTrade,
    toggleSendPlayer,
    toggleReceivePlayer,
    activeTab,
    setActiveTab,
    loading,
    setLoading,
    myTeam,
    setMyTeam,
    marketListings,
    setMarketListings,
    mySquad,
    setMySquad,
    toast,
    setToast,
    confirmModal,
    setConfirmModal,
    selectedPlayerId,
    setSelectedPlayerId,
    listingType,
    setListingType,
    price,
    setPrice,
    buyoutPrice,
    setBuyoutPrice,
    durationHours,
    setDurationHours,
    listingLoading,
    setListingLoading,
    actionLoading,
    setActionLoading,
    bidAmounts,
    setBidAmounts,
    receivedTrades,
    setReceivedTrades,
    sentTrades,
    setSentTrades,
    otherTeams,
    setOtherTeams,
    proposingTrade,
    setProposingTrade,
    receivedLoans,
    setReceivedLoans,
    sentLoans,
    setSentLoans,
    tradeOrLoanTab,
    setTradeOrLoanTab,
    activeChat,
    setActiveChat,
    chatMessages,
    setChatMessages,
    newMessage,
    setNewMessage,
    selectedTargetTeamId,
    setSelectedTargetTeamId,
    targetSquad,
    setTargetSquad,
    tradeSendPlayers,
    setTradeSendPlayers,
    tradeReceivePlayers,
    setTradeReceivePlayers,
    tradeOfferMoney,
    setTradeOfferMoney,
    tradeRequestMoney,
    setTradeRequestMoney,
    tradeSubmitting,
    setTradeSubmitting,
    selectedPlayerForProfile,
    setSelectedPlayerForProfile,
    playerStats,
    setPlayerStats,
    statsLoading,
    setStatsLoading,
    loadTradesData,
  } = model;

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
