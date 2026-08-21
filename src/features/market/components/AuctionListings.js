"use client";

import React, { useState } from "react";

/**
 * Visualização de Mercado em Grade (Estilo Transfermarkt/FUT).
 * Foco visual rápido para os usuários CLT verem:
 * Foto, Preço, Overall e Tempo Restante em 1 segundo.
 */
export default function AuctionListings({
  marketListings,
  myTeam,
  actionLoading,
  handleBuyListing,
  handleCancelListing,
  handlePlaceBid,
  openPlayerProfile,
}) {
  const [bidAmounts, setBidAmounts] = useState({});

  if (marketListings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center glass-card rounded-2xl border border-white/5">
        <span className="text-4xl mb-3">🏪</span>
        <p className="text-sm font-semibold text-gray-300">Mercado Vazio</p>
        <p className="text-xs text-gray-500 mt-1">Nenhum jogador disponível no mercado no momento.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fadeIn">
      {marketListings.map((listing) => {
        const isMyListing = listing.seller_team_id === myTeam?.id;
        const isAuction = listing.listing_type === "auction";
        const player = listing.players;
        const price = (listing.price / 1000).toFixed(0);

        return (
          <div key={listing.id} className="glass-card rounded-2xl border border-white/5 overflow-hidden flex flex-col hover:border-white/10 transition-colors group relative shadow-xl">
            {/* Tag Meu Anúncio */}
            {isMyListing && (
              <div className="absolute top-2 left-2 z-10 bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded shadow-lg">
                SEU
              </div>
            )}
            
            {/* Topo: Imagem e Dados Principais */}
            <div 
              className="relative h-40 bg-[#060913] cursor-pointer flex justify-center items-end pb-0"
              onClick={() => openPlayerProfile(player)}
            >
              {/* Degradê de fundo pra não ficar tão flat */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#090d16] via-transparent to-transparent opacity-80 z-0"></div>
              
              {player?.face_url ? (
                <img src={player.face_url} alt={player?.name} className="h-36 object-contain z-10 transition-transform group-hover:scale-105" />
              ) : (
                <div className="h-36 w-24 bg-white/5 rounded-t-xl border border-white/10 flex items-center justify-center z-10 mb-2">
                  <span className="text-3xl">👤</span>
                </div>
              )}
              
              {/* Overall e Posição overlay */}
              <div className="absolute top-2 right-2 flex flex-col items-end z-10">
                <div className="bg-[#090d16]/80 backdrop-blur-sm border border-white/10 px-2 py-1 rounded text-center">
                  <span className="block text-sm font-black text-emerald-400">{player?.rating}</span>
                  <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-widest">{player?.position}</span>
                </div>
              </div>
            </div>

            {/* Info Container */}
            <div className="p-4 bg-white/[0.02] flex-1 flex flex-col">
              <h3 
                className="text-sm font-bold text-white truncate cursor-pointer hover:text-[#10b981] transition-colors"
                onClick={() => openPlayerProfile(player)}
              >
                {player?.name}
              </h3>
              <p className="text-[10px] text-gray-500 font-semibold mt-0.5 truncate">
                Vendedor: {listing.teams?.name || "Sistema"}
              </p>

              <div className="mt-4 pt-3 border-t border-white/5 flex-1 flex flex-col justify-end">
                <div className="flex justify-between items-end mb-3">
                  <div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                      isAuction ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-[#10b981]"
                    }`}>
                      {isAuction ? "Leilão" : "Compra Imediata"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-sm font-black text-white">R$ {price}k</span>
                    {isAuction && listing.end_date && (
                      <span className="block text-[9px] text-gray-500 font-semibold mt-0.5">
                        Fim: {new Date(listing.end_date).toLocaleDateString("pt-BR", { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="mt-auto">
                  {isMyListing ? (
                    <button
                      onClick={() => handleCancelListing(listing)}
                      disabled={actionLoading !== null}
                      className="w-full px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-bold text-red-400 transition-all disabled:opacity-50"
                    >
                      {actionLoading === listing.id ? "Cancelando..." : "Cancelar Venda"}
                    </button>
                  ) : isAuction ? (
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder={`+ ${price}k`}
                        value={bidAmounts[listing.id] || ""}
                        onChange={(e) => setBidAmounts((prev) => ({
                          ...prev,
                          [listing.id]: e.target.value,
                        }))}
                        className="w-1/2 min-w-0 rounded-xl border border-white/10 bg-[#060913] py-2 px-2 text-white text-xs font-bold outline-none focus:border-amber-500 text-center"
                      />
                      <button
                        onClick={() => handlePlaceBid(listing, bidAmounts[listing.id])}
                        disabled={actionLoading !== null}
                        className="w-1/2 min-w-0 px-2 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-[10px] text-white font-bold transition-all uppercase tracking-wider shadow-lg disabled:opacity-50"
                      >
                        {actionLoading === listing.id ? "..." : "Lançar"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuyListing(listing)}
                      disabled={actionLoading !== null}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-xs font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                      {actionLoading === listing.id ? "Comprando..." : "Comprar Agora"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
