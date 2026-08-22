"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminService } from "@/services/adminService";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";

export default function MarketWindowPage() {
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const loadSeason = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("seasons")
        .select("id, name, status, market_open")
        .eq("status", "active")
        .maybeSingle();

      if (!error) setSeason(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useDeferredEffect(loadSeason);

  const handleToggleMarket = async (newValue) => {
    if (!season) return;
    setSaving(true);
    try {
      await adminService.setMarketWindow(supabase, season.id, newValue);

      setSeason((prev) => ({ ...prev, market_open: newValue }));
      showAlert("success", newValue
        ? "✅ Janela de mercado ABERTA — times já podem negociar!"
        : "🔒 Janela de mercado FECHADA — negociações suspensas."
      );
    } catch (err) {
      showAlert("error", "Erro ao atualizar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">🔄 Janela de Mercado</h1>
        <p className="text-sm text-gray-400 mt-1">
          Controle quando os times podem comprar, vender e negociar jogadores.
        </p>
      </div>

      {/* Alert */}
      {alert && (
        <div className={`p-4 rounded-xl border text-sm flex items-center gap-3 animate-fadeIn ${
          alert.type === "success"
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          <span>{alert.message}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent" />
        </div>
      ) : !season ? (
        <div className="glass-panel p-8 rounded-2xl border border-white/5 bg-[#090d16]/75 text-center">
          <span className="text-4xl block mb-3">📭</span>
          <p className="text-white font-semibold">Nenhuma temporada ativa encontrada</p>
          <p className="text-sm text-gray-400 mt-1">
            Crie uma temporada em <strong>Competições</strong> antes de gerenciar o mercado.
          </p>
        </div>
      ) : (
        <>
          {/* Card de status */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Temporada Ativa</p>
                <p className="text-lg font-bold text-white mt-0.5">{season.name}</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ● Ativa
              </span>
            </div>

            <div className="border-t border-white/5 pt-5">
              <div className={`p-5 rounded-2xl border-2 text-center transition-all ${
                season.market_open
                  ? "bg-emerald-500/5 border-emerald-500/30"
                  : "bg-gray-500/5 border-white/10"
              }`}>
                <span className="text-4xl block mb-2">
                  {season.market_open ? "🟢" : "🔴"}
                </span>
                <p className={`text-xl font-black ${season.market_open ? "text-emerald-400" : "text-gray-400"}`}>
                  {season.market_open ? "MERCADO ABERTO" : "MERCADO FECHADO"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {season.market_open
                    ? "Times estão autorizados a negociar jogadores agora."
                    : "Todas as negociações estão suspensas no momento."}
                </p>
              </div>
            </div>

            {/* Botão de toggle */}
            <div className="flex gap-3">
              {season.market_open ? (
                <button
                  onClick={() => handleToggleMarket(false)}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 py-3 text-sm font-bold transition-all disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "🔒 Fechar Janela de Mercado"}
                </button>
              ) : (
                <button
                  onClick={() => handleToggleMarket(true)}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 py-3 text-sm font-bold transition-all disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "🟢 Abrir Janela de Mercado"}
                </button>
              )}
            </div>
          </div>

          {/* Info contextual */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Como funciona</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              {[
                { icon: "🟢", text: "Com o mercado aberto, os times podem comprar agentes livres, receber propostas e participar de leilões." },
                { icon: "🔒", text: "Com o mercado fechado, nenhuma negociação de jogadores é permitida — mesmo que as negociações estejam ativadas nas Configurações." },
                { icon: "⚙️", text: "As regras do que pode ser negociado (empréstimo, troca, multa rescisória) são definidas em Configurações → Mercado." },
                { icon: "📅", text: "Feche o mercado antes de iniciar uma nova rodada para evitar negociações fora de época." },
              ].map(({ icon, text }, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 mt-0.5">{icon}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
