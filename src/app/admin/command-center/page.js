"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminService } from "@/services/adminService";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";

export default function CommandCenterPage() {
  const [rounds, setRounds] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  // Carregar configurações de mercado (usando a tabela settings)
  const loadSettings = async () => {
    const { data } = await supabase.from("settings").select("*").in("key", ["market_status"]);
    if (data) {
      const map = {};
      data.forEach((s) => (map[s.key] = s.value));
      setSettings(map);
    }
  };

  // Carregar rodadas (nova tabela)
  const loadRounds = async () => {
    const { data } = await supabase.from("rounds").select("*, leagues(name), seasons(name)").order("sequence_number", { ascending: true });
    if (data) {
      setRounds(data);
    }
    setLoading(false);
  };

  useDeferredEffect(() => {
    loadSettings();
    loadRounds();
  });

  const toggleMarket = async (newStatus) => {
    try {
      await adminService.updateSettings(supabase, { market_status: newStatus });
      setSettings(prev => ({ ...prev, market_status: newStatus }));
    } catch (error) {
      console.error("Erro ao alterar o mercado:", error);
    }
  };

  if (loading) return <div className="p-8 text-white">Carregando Command Center...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Command Center</h1>
        <p className="text-gray-400 text-sm mt-1">Controle global de mercado, temporadas contínuas e painel visual de rodadas.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Controle de Mercado Manual */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#090d16]/75">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">🛒 Controle de Mercado</h2>
          <p className="text-xs text-gray-400 mb-6">Conforme a filosofia da liga, o mercado não fecha automaticamente. Você no controle.</p>
          
          <div className="space-y-3">
            <button 
              onClick={() => toggleMarket("open")}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all border ${settings.market_status === "open" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 ring-1 ring-emerald-500/50" : "bg-white/5 text-gray-400 border-transparent hover:bg-white/10"}`}
            >
              🟢 Mercado Aberto
            </button>
            <button 
              onClick={() => toggleMarket("closed")}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all border ${settings.market_status === "closed" ? "bg-red-500/20 text-red-400 border-red-500/30 ring-1 ring-red-500/50" : "bg-white/5 text-gray-400 border-transparent hover:bg-white/10"}`}
            >
              🔴 Mercado Fechado
            </button>
            <button 
              onClick={() => toggleMarket("special")}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all border ${settings.market_status === "special" ? "bg-amber-500/20 text-amber-400 border-amber-500/30 ring-1 ring-amber-500/50" : "bg-white/5 text-gray-400 border-transparent hover:bg-white/10"}`}
            >
              ⭐ Janela Especial (Draft/Leilão)
            </button>
          </div>
        </div>

        {/* Timeline de Rodadas */}
        <div className="md:col-span-2 glass-panel p-6 rounded-2xl border border-white/5 bg-[#090d16]/75">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">🗓️ Gantt de Rodadas (Timeline)</h2>
          <p className="text-xs text-gray-400 mb-6">Administre os prazos. Ao alterar o prazo de uma rodada, todos os jogos vinculados se atualizam.</p>
          
          <div className="space-y-4">
            {rounds.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-white/5 rounded-2xl">
                Nenhuma rodada estruturada ainda. Gere a tabela na aba Ligas.
              </div>
            ) : (
              rounds.map(round => (
                <div key={round.id} className="p-4 rounded-xl border border-white/5 bg-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#10b981]">{round.leagues?.name}</span>
                    <h3 className="text-sm font-bold text-white mt-1">{round.name}</h3>
                    <p className="text-xs text-gray-400">Prazo: {round.suggested_deadline ? new Date(round.suggested_deadline).toLocaleDateString("pt-BR") : "Sem prazo definido"}</p>
                  </div>
                  <button type="button" disabled title="Edição de prazo será reativada após a recuperação" className="px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-bold border border-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                    Edição pausada
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
