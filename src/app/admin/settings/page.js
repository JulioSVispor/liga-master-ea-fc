"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" }); // type: 'success' | 'error'

  // Settings states
  const [leagueName, setLeagueName] = useState("");
  const [defaultBudget, setDefaultBudget] = useState("");
  const [defaultWageCap, setDefaultWageCap] = useState("");
  const [buyoutMultiplier, setBuyoutMultiplier] = useState("");

  const showMessage = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 5000);
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data, error } = await supabase
          .from("settings")
          .select("*");

        if (error) throw error;

        if (data) {
          data.forEach((item) => {
            if (item.key === "league_name") setLeagueName(item.value);
            if (item.key === "default_budget") setDefaultBudget(item.value);
            if (item.key === "default_wage_cap") setDefaultWageCap(item.value);
            if (item.key === "buyout_multiplier") setBuyoutMultiplier(item.value);
          });
        }
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
        showMessage("Erro ao carregar configurações: " + err.message, "error");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const settingsToSave = [
        { key: "league_name", value: leagueName },
        { key: "default_budget", value: defaultBudget },
        { key: "default_wage_cap", value: defaultWageCap },
        { key: "buyout_multiplier", value: buyoutMultiplier },
      ];

      const { error } = await supabase
        .from("settings")
        .upsert(settingsToSave, { onConflict: "key" });

      if (error) throw error;
      showMessage("Configurações atualizadas com sucesso!");
    } catch (err) {
      showMessage(err.message || "Erro ao salvar configurações.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePurgeFreeAgents = async () => {
    const confirmPurge = window.confirm(
      "ATENÇÃO MÁXIMA!\n\nVocê tem certeza que deseja excluir permanentemente todos os jogadores livres (que não pertencem a nenhum time)?\nIsso limpará os registros de leilões ativos desses jogadores também. Essa ação não pode ser desfeita!"
    );

    if (!confirmPurge) return;

    setPurging(true);
    try {
      const { data, error } = await supabase.rpc("purge_free_agents");

      if (error) throw error;

      if (data && data.success) {
        showMessage(data.message);
      } else {
        showMessage(data.message || "Houve um erro desconhecido ao purgar.", "error");
      }
    } catch (err) {
      showMessage("Erro ao purgar: " + err.message, "error");
    } finally {
      setPurging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Configurações Globais da Liga
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Ajuste as regras padrão de novos times, valores de multa rescisória e limpe o banco de dados.
        </p>
      </div>

      {/* Alerta de Feedback */}
      {message.text && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-2 animate-fadeIn transition-all ${
            message.type === "error"
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          <span>{message.type === "error" ? "⚠️" : "✅"}</span>
          {message.text}
        </div>
      )}

      {/* Painel de Configurações */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-8">
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="border-b border-white/5 pb-4">
            <h2 className="text-lg font-bold text-white">Parâmetros da Liga</h2>
            <p className="text-xs text-gray-400">Esses valores são usados para as regras gerais da competição.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300">Nome Oficial da Liga</label>
              <input
                type="text"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                required
                placeholder="Ex: Liga Master EA FC 26"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300">Orçamento Padrão para Novos Times (R$)</label>
              <input
                type="number"
                step="0.01"
                value={defaultBudget}
                onChange={(e) => setDefaultBudget(e.target.value)}
                required
                placeholder="Ex: 50000000.00"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300">Teto Salarial Semanal Padrão (R$)</label>
              <input
                type="number"
                step="0.01"
                value={defaultWageCap}
                onChange={(e) => setDefaultWageCap(e.target.value)}
                required
                placeholder="Ex: 15000.00"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300">Multiplicador da Multa Rescisória (Ex: 1.50 = 150%)</label>
              <input
                type="number"
                step="0.01"
                value={buyoutMultiplier}
                onChange={(e) => setBuyoutMultiplier(e.target.value)}
                required
                placeholder="Ex: 1.50"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-6 py-2.5 text-xs font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar Configurações"}
            </button>
          </div>
        </form>

        {/* Zona de Perigo */}
        <div className="border-t border-white/5 pt-8 space-y-4">
          <div>
            <h3 className="text-base font-bold text-red-400">Zona de Perigo</h3>
            <p className="text-xs text-gray-400">Ações críticas e irreversíveis sobre a base de dados.</p>
          </div>

          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Purgar Jogadores Livres</p>
              <p className="text-xs text-gray-400">
                Apaga todos os jogadores da base de dados que estão sem time associado (agentes livres). Use com cuidado.
              </p>
            </div>
            <button
              onClick={handlePurgeFreeAgents}
              disabled={purging}
              className="rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-5 py-2.5 text-xs font-bold text-red-400 transition-all active:scale-[0.98] disabled:opacity-50 whitespace-nowrap self-start sm:self-center"
            >
              {purging ? "Purgando..." : "Purgar Jogadores"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
