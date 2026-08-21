"use client";

import React, { useState } from "react";

export default function TradeProposals({
  myTeam,
  receivedTrades,
  sentTrades,
  handleAcceptTrade,
  handleRejectTrade,
  handleCancelTrade,
  openChat,
  actionLoading,
}) {
  const [tab, setTab] = useState("received"); // received | sent
  const pendingSent = sentTrades.filter((t) => t.status === "pending");

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Abas Rápidas de Navegação */}
      <div className="flex space-x-2 bg-white/5 p-1.5 rounded-xl w-fit border border-white/5 shadow-inner">
        <button
          onClick={() => setTab("received")}
          className={`px-6 py-2.5 text-[13px] font-bold rounded-lg transition-all flex items-center gap-2 ${
            tab === "received"
              ? "bg-[#10b981] text-white shadow-md shadow-emerald-500/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Propostas Recebidas
          {receivedTrades.length > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] shadow-sm">
              {receivedTrades.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("sent")}
          className={`px-6 py-2.5 text-[13px] font-bold rounded-lg transition-all flex items-center gap-2 ${
            tab === "sent"
              ? "bg-[#3b82f6] text-white shadow-md shadow-blue-500/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          Propostas Enviadas
          {pendingSent.length > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] shadow-sm">
              {pendingSent.length}
            </span>
          )}
        </button>
      </div>

      {/* Container Principal */}
      <div className="space-y-4">
        {tab === "received" && (
          receivedTrades.length === 0 ? (
            <EmptyState 
              icon="📥" 
              title="Sua mesa está limpa" 
              description="Você não possui propostas de troca pendentes para avaliar no momento." 
            />
          ) : (
            receivedTrades.map((trade) => (
              <TradeDuelCard
                key={trade.id}
                trade={trade}
                myTeam={myTeam}
                isReceived={true}
                actionLoading={actionLoading}
                handleAcceptTrade={handleAcceptTrade}
                handleRejectTrade={handleRejectTrade}
                handleCancelTrade={handleCancelTrade}
                openChat={openChat}
              />
            ))
          )
        )}

        {tab === "sent" && (
          pendingSent.length === 0 ? (
            <EmptyState 
              icon="📤" 
              title="Nenhum negócio em andamento" 
              description="Acesse o mercado e envie propostas de troca para reforçar seu elenco." 
            />
          ) : (
            pendingSent.map((trade) => (
              <TradeDuelCard
                key={trade.id}
                trade={trade}
                myTeam={myTeam}
                isReceived={false}
                actionLoading={actionLoading}
                handleAcceptTrade={handleAcceptTrade}
                handleRejectTrade={handleRejectTrade}
                handleCancelTrade={handleCancelTrade}
                openChat={openChat}
              />
            ))
          )
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center bg-[#090d16]/40 backdrop-blur-md rounded-2xl border border-white/5 shadow-xl">
      <span className="text-4xl mb-4 grayscale opacity-50">{icon}</span>
      <h3 className="text-base font-semibold text-gray-200">{title}</h3>
      <p className="text-sm text-gray-500 mt-2 max-w-sm">{description}</p>
    </div>
  );
}

function TradeDuelCard({
  trade,
  myTeam,
  isReceived,
  actionLoading,
  handleAcceptTrade,
  handleRejectTrade,
  handleCancelTrade,
  openChat,
}) {
  const isPendingAction = actionLoading === trade.id;

  let myLosses = [];
  let myGains = [];
  let myMoneyLoss = 0;
  let myMoneyGain = 0;
  let opponentName = "";
  let opponentRealName = "";

  if (isReceived) {
    opponentName = trade.sender_team?.name;
    opponentRealName = trade.sender_team?.real_club_name;
    myLosses = trade.trade_players.filter((tp) => tp.direction === "receive");
    myGains = trade.trade_players.filter((tp) => tp.direction === "send");
    myMoneyLoss = trade.requested_money || 0;
    myMoneyGain = trade.offered_money || 0;
  } else {
    opponentName = trade.receiver_team?.name;
    opponentRealName = trade.receiver_team?.real_club_name;
    myLosses = trade.trade_players.filter((tp) => tp.direction === "send");
    myGains = trade.trade_players.filter((tp) => tp.direction === "receive");
    myMoneyLoss = trade.offered_money || 0;
    myMoneyGain = trade.requested_money || 0;
  }

  const renderPlayerBadge = (tp) => (
    <div key={tp.id} className="flex items-center gap-3 py-2 px-3 hover:bg-white/[0.02] transition-colors rounded-xl border border-transparent hover:border-white/5 group">
      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-800 to-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0 border border-white/10 shadow-sm">
        {tp.players?.face_url ? (
          <img src={tp.players.face_url} alt="" className="w-full h-full object-cover scale-110" />
        ) : (
          <span className="text-xs text-gray-400">👤</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-gray-100 truncate group-hover:text-white transition-colors">{tp.players?.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/5 text-gray-400 border border-white/5">
            {tp.players?.position}
          </span>
          <span className="text-[10px] font-bold text-gray-400">
            {tp.players?.rating} OVR
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-[#090d16]/80 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all hover:border-white/20">
      
      {/* HEADER EXECUTIVO */}
      <div className="bg-white/[0.02] border-b border-white/5 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isReceived ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">Proposta Recebida</span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded border border-blue-400/20">Proposta Enviada</span>
            )}
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Expira em {new Date(trade.expires_at).toLocaleDateString()}
            </span>
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="text-gray-400 font-normal">Clube Envolvido:</span> 
            {opponentName || "Desconhecido"}
            {opponentRealName && <span className="text-xs text-gray-500 font-normal">({opponentRealName})</span>}
          </h3>
        </div>
        
        <button 
          onClick={() => openChat(trade, isReceived ? 'received' : 'sent')}
          className="text-[13px] font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition-all border border-white/5 flex items-center gap-2 w-fit"
        >
          <span>💬</span> Chat do Acordo
        </button>
      </div>

      {/* ÁREA DE TROCA (CLEAN) */}
      <div className="p-6 flex flex-col md:flex-row relative gap-8">
        
        {/* Lado Esquerdo: O QUE VOCÊ CEDE */}
        <div className="flex-1 space-y-4">
          <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2">
            Você cede
          </h4>
          <div className="space-y-1">
            {myLosses.map(renderPlayerBadge)}
            {myLosses.length === 0 && myMoneyLoss === 0 && (
              <p className="text-[13px] text-gray-600 italic py-2">Nada solicitado em troca.</p>
            )}
          </div>
          
          {myMoneyLoss > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl border border-red-500/20 bg-red-500/5 mt-4">
              <span className="text-[11px] font-bold text-red-400/80 uppercase">Compensação Fin.</span>
              <span className="text-sm font-black text-red-400">- R$ {parseFloat(myMoneyLoss).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Marcador Central (Transfer) */}
        <div className="hidden md:flex shrink-0 w-10 h-10 bg-[#090d16] border border-white/10 rounded-full items-center justify-center text-gray-400 shadow-2xl self-center mx-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
        </div>

        {/* Lado Direito: O QUE VOCÊ RECEBE */}
        <div className="flex-1 space-y-4">
          <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2">
            Você recebe
          </h4>
          <div className="space-y-1">
            {myGains.map(renderPlayerBadge)}
            {myGains.length === 0 && myMoneyGain === 0 && (
              <p className="text-[13px] text-gray-600 italic py-2">Nenhum retorno estipulado.</p>
            )}
          </div>

          {myMoneyGain > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 mt-4">
              <span className="text-[11px] font-bold text-emerald-400/80 uppercase">Compensação Fin.</span>
              <span className="text-sm font-black text-emerald-400">+ R$ {parseFloat(myMoneyGain).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER AÇÕES RÁPIDAS (LINEAR STYLE) */}
      <div className="bg-[#060913]/60 px-6 py-4 flex justify-end gap-3 border-t border-white/5">
        {isReceived ? (
          <>
            <button
              onClick={() => handleRejectTrade(trade.id)}
              disabled={isPendingAction}
              className="px-6 py-2.5 rounded-xl bg-transparent hover:bg-white/5 border border-white/10 text-[13px] font-bold text-gray-300 hover:text-white transition-all disabled:opacity-50"
            >
              {isPendingAction ? "Aguarde..." : "Rejeitar"}
            </button>
            <button
              onClick={() => handleAcceptTrade(trade.id)}
              disabled={isPendingAction}
              className="px-8 py-2.5 rounded-xl bg-white text-[#060913] hover:bg-gray-200 text-[13px] font-bold shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
            >
              {isPendingAction ? "Processando..." : "Aceitar Acordo"}
            </button>
          </>
        ) : (
          <button
            onClick={() => handleCancelTrade(trade.id)}
            disabled={isPendingAction}
            className="px-6 py-2.5 rounded-xl bg-transparent hover:bg-white/5 border border-white/10 text-[13px] font-bold text-gray-300 hover:text-white transition-all disabled:opacity-50"
          >
            {isPendingAction ? "Aguarde..." : "Cancelar Oferta"}
          </button>
        )}
      </div>

    </div>
  );
}
