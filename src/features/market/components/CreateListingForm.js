"use client";

import React from "react";

export default function CreateListingForm({
  mySquad,
  selectedPlayerId,
  setSelectedPlayerId,
  listingType,
  setListingType,
  price,
  setPrice,
  durationHours,
  setDurationHours,
  buyoutPrice,
  setBuyoutPrice,
  listingLoading,
  handleCreateListing,
}) {
  return (
    <div className="max-w-xl mx-auto animate-fadeIn mt-6">
      <div className="glass-panel p-8 rounded-xl border border-white/10 bg-[#090d16] shadow-xl">
        <div className="flex flex-col mb-8">
          <h3 className="text-xl font-bold text-white mb-1">Anunciar Jogador</h3>
          <p className="text-sm text-gray-400">Configure a venda ou leilão do seu atleta para o mercado global.</p>
        </div>

        {mySquad.length === 0 ? (
          <div className="bg-white/5 border border-white/10 p-6 rounded-xl text-center">
            <p className="text-sm text-gray-400">Você não possui jogadores no elenco para anunciar.</p>
          </div>
        ) : (
          <form noValidate className="space-y-6" onSubmit={handleCreateListing}>
            
            <div className="space-y-5">
              {/* Jogador */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Jogador Selecionado
                </label>
                <select
                  value={selectedPlayerId}
                  onChange={(e) => {
                    setSelectedPlayerId(e.target.value);
                    const p = mySquad.find((item) => item.id.toString() === e.target.value.toString());
                    if (p) setPrice((p.wage * 10).toString());
                  }}
                  className="w-full rounded-xl border border-white/10 bg-[#060913] py-3 px-4 text-white text-sm focus:border-[#10b981] outline-none font-semibold transition-all"
                  required
                >
                  <option value="" className="bg-[#090d16] text-gray-500">Selecione o atleta do elenco...</option>
                  {mySquad.map((player) => (
                    <option key={player.id} value={player.id} className="bg-[#090d16] text-white">
                      {player.name} (Posição: {player.position} | OVR: {player.rating})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo e Preço */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Tipo de Venda
                  </label>
                  <select
                    value={listingType}
                    onChange={(e) => setListingType(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#060913] py-3 px-4 text-white text-sm focus:border-[#10b981] outline-none font-semibold transition-all"
                  >
                    <option value="immediate_buy" className="bg-[#090d16] text-white">Compra Imediata</option>
                    <option value="auction" className="bg-[#090d16] text-white">Leilão por Lances</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {listingType === "auction" ? "Lance Mínimo" : "Preço de Venda"}
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ex: 50000"
                    className="w-full rounded-xl border border-white/10 bg-[#060913] py-3 px-4 text-white text-sm focus:border-[#10b981] outline-none font-bold transition-all"
                    required
                  />
                </div>
              </div>

              {/* Opções de Leilão */}
              {listingType === "auction" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-white/5">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                      Duração (Horas)
                    </label>
                    <select
                      value={durationHours}
                      onChange={(e) => setDurationHours(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#060913] py-3 px-4 text-white text-sm focus:border-[#10b981] outline-none font-semibold transition-all"
                    >
                      <option value="12" className="bg-[#090d16] text-white">12 Horas</option>
                      <option value="24" className="bg-[#090d16] text-white">24 Horas</option>
                      <option value="48" className="bg-[#090d16] text-white">48 Horas</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                      Arremate Imediato
                    </label>
                    <input
                      type="number"
                      value={buyoutPrice}
                      onChange={(e) => setBuyoutPrice(e.target.value)}
                      placeholder="Opcional"
                      className="w-full rounded-xl border border-white/10 bg-[#060913] py-3 px-4 text-white text-sm focus:border-[#10b981] outline-none font-bold transition-all placeholder-gray-600"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Botão */}
            <div className="pt-6 mt-6 border-t border-white/5">
              <button
                type="submit"
                disabled={listingLoading}
                className="w-full rounded-xl bg-[#10b981] hover:bg-[#059669] px-8 py-3.5 text-sm font-bold text-white transition-all disabled:opacity-50"
              >
                {listingLoading ? "Processando..." : "Colocar no Mercado"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
