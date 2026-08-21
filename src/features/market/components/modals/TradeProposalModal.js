"use client";

import React from "react";

export default function TradeProposalModal({
  isOpen,
  onClose,
  otherTeams,
  selectedTargetTeamId,
  handleTargetTeamChange,
  mySquad,
  targetSquad,
  tradeSendPlayers,
  toggleSendPlayer,
  tradeReceivePlayers,
  toggleReceivePlayer,
  tradeOfferMoney,
  setTradeOfferMoney,
  tradeRequestMoney,
  setTradeRequestMoney,
  myTeam,
  tradeSubmitting,
  handleSendTradeOffer,
}) {
  if (!isOpen) return null;

  const totalSendCount = tradeSendPlayers.length;
  const totalReceiveCount = tradeReceivePlayers.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fadeIn overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-[#090d16] border border-white/10 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col relative my-8">
        
        {/* Header Modal */}
        <div className="flex justify-between items-center p-5 border-b border-white/5 bg-white/[0.02] shrink-0 rounded-t-3xl">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              🤝 Nova Proposta de Troca
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 bg-gradient-to-b from-transparent to-[#060913]/50">
          <form noValidate id="tradeForm" onSubmit={handleSendTradeOffer} className="space-y-6">
            
            {/* Selecionar Time de Destino */}
            <div className="max-w-md mx-auto">
              <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 text-center">
                Clube Adversário
              </label>
              <div className="relative">
                <select
                  value={selectedTargetTeamId}
                  onChange={(e) => handleTargetTeamChange(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-[#060913] py-3 px-4 text-white text-sm focus:border-blue-500 outline-none font-bold text-center transition-all hover:bg-white/[0.02] cursor-pointer"
                  required
                >
                  <option value="" className="bg-[#090d16] text-gray-500">-- Selecione o clube --</option>
                  {otherTeams.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#090d16] text-white">
                      {t.name} ({t.real_club_name})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center px-2 text-gray-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>

            {selectedTargetTeamId && (
              <div className="space-y-6 animate-fadeIn">
                
                {/* ÁREA DE SELEÇÃO DE JOGADORES (Tabelas Compactas) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* MEU ELENCO */}
                  <div className="flex flex-col border border-white/5 bg-[#060913] rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                      <h4 className="text-[11px] font-black text-white uppercase tracking-widest">
                        Seu Elenco (Ceder)
                      </h4>
                      <span className="text-[10px] font-bold text-gray-500">{mySquad.length} Jog.</span>
                    </div>
                    
                    <div className="max-h-[35vh] overflow-y-auto custom-scrollbar p-2 space-y-1">
                      {mySquad.length === 0 ? (
                        <p className="text-xs text-gray-500 italic py-6 text-center">Elenco vazio.</p>
                      ) : (
                        mySquad.map((p) => (
                          <CompactPlayerCard 
                            key={p.id} 
                            player={p} 
                            isSelected={tradeSendPlayers.includes(p.id)} 
                            onToggle={() => toggleSendPlayer(p.id)}
                            type="send"
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* ELENCO ALVO */}
                  <div className="flex flex-col border border-white/5 bg-[#060913] rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                      <h4 className="text-[11px] font-black text-white uppercase tracking-widest">
                        Elenco Alvo (Receber)
                      </h4>
                      <span className="text-[10px] font-bold text-gray-500">{targetSquad.length} Jog.</span>
                    </div>
                    
                    <div className="max-h-[35vh] overflow-y-auto custom-scrollbar p-2 space-y-1">
                      {targetSquad.length === 0 ? (
                        <p className="text-xs text-gray-500 italic py-6 text-center">Nenhum jogador no time adversário.</p>
                      ) : (
                        targetSquad.map((p) => (
                          <CompactPlayerCard 
                            key={p.id} 
                            player={p} 
                            isSelected={tradeReceivePlayers.includes(p.id)} 
                            onToggle={() => toggleReceivePlayer(p.id)}
                            type="receive"
                          />
                        ))
                      )}
                    </div>
                  </div>

                </div>

                {/* COMPENSAÇÃO FINANCEIRA */}
                <div className="bg-[#060913] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">
                      Dinheiro que VOCÊ vai pagar
                    </label>
                    <div className="flex items-center w-full rounded-xl border border-white/10 bg-[#090d16] focus-within:border-blue-400 transition-colors">
                      <span className="pl-3 pr-2 py-2 text-gray-500 font-bold bg-[#090d16] rounded-l-xl border-r border-white/5 text-xs">R$</span>
                      <input
                        type="number"
                        value={tradeOfferMoney}
                        onChange={(e) => setTradeOfferMoney(e.target.value)}
                        className="flex-1 bg-[#090d16] py-2 px-3 text-white text-sm outline-none font-bold rounded-r-xl"
                        min="0"
                      />
                    </div>
                    <span className="text-[9px] text-gray-500 mt-1 block">Orçamento: <span className="text-emerald-400 font-bold">R$ {parseFloat(myTeam.budget).toLocaleString()}</span></span>
                  </div>

                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">
                      Dinheiro que o ADVERSÁRIO vai pagar
                    </label>
                    <div className="flex items-center w-full rounded-xl border border-white/10 bg-[#090d16] focus-within:border-blue-400 transition-colors">
                      <span className="pl-3 pr-2 py-2 text-gray-500 font-bold bg-[#090d16] rounded-l-xl border-r border-white/5 text-xs">R$</span>
                      <input
                        type="number"
                        value={tradeRequestMoney}
                        onChange={(e) => setTradeRequestMoney(e.target.value)}
                        className="flex-1 bg-[#090d16] py-2 px-3 text-white text-sm outline-none font-bold rounded-r-xl"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

              </div>
            )}
          </form>
        </div>

        {/* STICKY FOOTER: RESUMO E AÇÕES */}
        <div className="border-t border-white/10 bg-[#060913] rounded-b-3xl shrink-0 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="flex gap-4">
            {selectedTargetTeamId && (
              <>
                <div>
                  <p className="text-[9px] uppercase font-bold text-gray-500">Ceder</p>
                  <p className="text-xs font-bold text-white">
                    {totalSendCount} <span className="text-gray-400 font-normal">jog.</span> 
                    {Number(tradeOfferMoney) > 0 && <span className="text-red-400 ml-1">(-R$ {Number(tradeOfferMoney).toLocaleString()})</span>}
                  </p>
                </div>
                <div className="w-px h-6 bg-white/10"></div>
                <div>
                  <p className="text-[9px] uppercase font-bold text-gray-500">Receber</p>
                  <p className="text-xs font-bold text-white">
                    {totalReceiveCount} <span className="text-gray-400 font-normal">jog.</span>
                    {Number(tradeRequestMoney) > 0 && <span className="text-emerald-400 ml-1">(+R$ {Number(tradeRequestMoney).toLocaleString()})</span>}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/10 text-xs font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-all"
            >
              Cancelar
            </button>
            <button
              form="tradeForm"
              type="submit"
              disabled={tradeSubmitting || !selectedTargetTeamId || (totalSendCount === 0 && totalReceiveCount === 0 && Number(tradeOfferMoney) === 0 && Number(tradeRequestMoney) === 0)}
              className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:bg-gray-600"
            >
              {tradeSubmitting ? "Processando..." : "Enviar Proposta"}
            </button>
          </div>
        </div>

        </div>

      </div>
    </div>
  );
}

function CompactPlayerCard({ player, isSelected, onToggle, type }) {
  const isSend = type === "send";
  const selectedBgColor = isSend ? "bg-red-500/10" : "bg-emerald-500/10";
  const selectedBorderColor = isSend ? "border-red-500/30" : "border-emerald-500/30";
  const selectedTextColor = isSend ? "text-red-400" : "text-emerald-400";
  const checkColor = isSend ? "text-red-500" : "text-emerald-500";

  return (
    <div
      onClick={onToggle}
      className={`flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-all duration-150 select-none ${
        isSelected 
          ? `${selectedBorderColor} ${selectedBgColor}` 
          : "border-transparent hover:bg-white/[0.03]"
      }`}
    >
      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
        isSelected 
          ? (isSend ? 'border-red-500 bg-red-500/20' : 'border-emerald-500 bg-emerald-500/20')
          : "border-white/20 bg-[#090d16]"
      }`}>
        {isSelected && (
          <svg className={`w-3 h-3 ${checkColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
        <span className={`text-[12px] font-bold truncate ${isSelected ? selectedTextColor : "text-gray-200"}`}>
          {player.name}
        </span>
        <div className="flex gap-1 shrink-0">
          <span className="text-[9px] font-bold text-gray-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5 w-8 text-center">
            {player.position}
          </span>
          <span className="text-[9px] font-bold text-gray-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5 w-10 text-center">
            {player.rating}
          </span>
        </div>
      </div>
    </div>
  );
}
