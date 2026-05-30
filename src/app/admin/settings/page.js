"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const AUCTION_TIME_UNITS = ["Horas", "Minutos", "Dias"];

const TOGGLE_FIELDS = [
  { label: "Teto Salarial", key: "wage_cap_enabled" },
  { label: "Negociações", key: "negotiations_enabled" },
  { label: "Negociação jogador sem contrato", key: "negotiations_no_contract" },
  { label: "Empréstimo", key: "loan_enabled" },
  { label: "Troca", key: "trade_enabled" },
  { label: "Compra na Multa (Roubo)", key: "buyout_enabled" },
  { label: "Aceitar propostas automaticamente de jogadores à venda", key: "auto_accept_proposals" },
  { label: "Permitir usuário adicionar jogador no leilão", key: "allow_player_auction" },
  { label: "Liberar Alteração Patrocínio", key: "allow_sponsor_change" },
  { label: "Trocar Escudo", key: "allow_shield_change" },
  { label: "Escudo Repetido", key: "allow_repeated_shield" },
  { label: "Permitir usuário transferir dinheiro", key: "allow_money_transfer" },
  { label: "Extrato de dinheiro visível para todos", key: "statement_public" },
  { label: "Janela de Ajuste Salarial", key: "salary_window_open" },
  { label: "Demitir Jogador", key: "fire_player_enabled" },
  { label: "Modificar salário baseado no valor de transferência (Compra)", key: "modify_salary_on_buy" },
];

const INPUT_STYLE =
  "w-full bg-[#090d16] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#10b981] transition-colors";
const SELECT_STYLE =
  "w-48 bg-[#090d16] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#10b981] transition-colors";

function FeedbackBanner({ message }) {
  if (!message.text) return null;
  return (
    <div
      className={`p-3 rounded-xl border text-sm flex items-center gap-2 transition-all ${
        message.type === "error"
          ? "bg-red-500/10 border-red-500/20 text-red-400"
          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
      }`}
    >
      <span>{message.type === "error" ? "⚠️" : "✅"}</span>
      {message.text}
    </div>
  );
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingParams, setSavingParams] = useState(false);
  const [savingToggles, setSavingToggles] = useState(false);
  const [purging, setPurging] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const [msgParams, setMsgParams] = useState({ text: "", type: "" });
  const [msgToggles, setMsgToggles] = useState({ text: "", type: "" });
  const [msgPurge, setMsgPurge] = useState({ text: "", type: "" });

  // --- Parâmetros da Liga ---
  const [params, setParams] = useState({
    league_name: "",
    default_budget: "",
    default_wage_cap: "",
    salary_wage_ratio: "",
    default_salary: "",
    max_players_per_team: "",
    result_confirm_hours: "",
    auction_time_value: "",
    auction_time_unit: "Horas",
    buyout_multiplier: "",
  });

  // --- Toggles ---
  const [toggles, setToggles] = useState(() => {
    const init = {};
    TOGGLE_FIELDS.forEach((f) => { init[f.key] = "true"; });
    init.salary_payer_loans = "owner";
    init.fire_player_penalty = "none";
    return init;
  });

  const showMsg = (setter, text, type = "success") => {
    setter({ text, type });
    setTimeout(() => setter({ text: "", type: "" }), 5000);
  };

  const loadSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("settings").select("*");
      if (error) throw error;
      if (data) {
        const map = {};
        data.forEach((item) => { map[item.key] = item.value; });

        setParams((prev) => ({
          league_name: map.league_name ?? prev.league_name,
          default_budget: map.default_budget ?? prev.default_budget,
          default_wage_cap: map.default_wage_cap ?? prev.default_wage_cap,
          salary_wage_ratio: map.salary_wage_ratio ?? prev.salary_wage_ratio,
          default_salary: map.default_salary ?? prev.default_salary,
          max_players_per_team: map.max_players_per_team ?? prev.max_players_per_team,
          result_confirm_hours: map.result_confirm_hours ?? prev.result_confirm_hours,
          auction_time_value: map.auction_time_value ?? prev.auction_time_value,
          auction_time_unit: map.auction_time_unit ?? prev.auction_time_unit,
          buyout_multiplier: map.buyout_multiplier ?? prev.buyout_multiplier,
        }));

        setToggles((prev) => {
          const next = { ...prev };
          TOGGLE_FIELDS.forEach((f) => {
            if (map[f.key] !== undefined) next[f.key] = map[f.key];
          });
          if (map.salary_payer_loans !== undefined) next.salary_payer_loans = map.salary_payer_loans;
          if (map.fire_player_penalty !== undefined) next.fire_player_penalty = map.fire_player_penalty;
          return next;
        });
      }
    } catch (err) {
      console.error("Erro ao carregar configurações:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSaveParams = async (e) => {
    e.preventDefault();
    setSavingParams(true);
    try {
      const toSave = Object.entries(params).map(([key, value]) => ({ key, value: String(value) }));
      const { error } = await supabase.from("settings").upsert(toSave, { onConflict: "key" });
      if (error) throw error;
      showMsg(setMsgParams, "Parâmetros salvos com sucesso!");
    } catch (err) {
      showMsg(setMsgParams, err.message || "Erro ao salvar parâmetros.", "error");
    } finally {
      setSavingParams(false);
    }
  };

  const handleSaveToggles = async (e) => {
    e.preventDefault();
    setSavingToggles(true);
    try {
      const toSave = Object.entries(toggles).map(([key, value]) => ({ key, value: String(value) }));
      const { error } = await supabase.from("settings").upsert(toSave, { onConflict: "key" });
      if (error) throw error;
      showMsg(setMsgToggles, "Configurações de toggles salvas!");
    } catch (err) {
      showMsg(setMsgToggles, err.message || "Erro ao salvar toggles.", "error");
    } finally {
      setSavingToggles(false);
    }
  };

  const handlePurgeFreeAgents = async () => {
    setPurging(true);
    try {
      const { data, error } = await supabase.rpc("purge_free_agents");
      if (error) throw error;
      if (data && data.success) {
        showMsg(setMsgPurge, data.message || "Jogadores livres purgados!");
      } else {
        showMsg(setMsgPurge, data?.message || "Erro desconhecido ao purgar.", "error");
      }
    } catch (err) {
      showMsg(setMsgPurge, "Erro ao purgar: " + err.message, "error");
    } finally {
      setPurging(false);
      setShowPurgeConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Configurações Globais da Liga
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Ajuste parâmetros, regras e funcionalidades da liga.
        </p>
      </div>

      {/* ===== SEÇÃO 1: Parâmetros da Liga ===== */}
      <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-6 sm:p-8 space-y-6">
        <div className="border-b border-white/5 pb-4">
          <h2 className="text-lg font-bold text-white">Parâmetros da Liga</h2>
          <p className="text-xs text-gray-400 mt-1">
            Defina valores padrão usados nas regras gerais da competição.
          </p>
        </div>

        <FeedbackBanner message={msgParams} />

        <form onSubmit={handleSaveParams} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Nome da Liga */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Nome Oficial da Liga</label>
              <input
                type="text"
                value={params.league_name}
                onChange={(e) => setParams((p) => ({ ...p, league_name: e.target.value }))}
                placeholder="Ex: Liga Master EA FC 26"
                className={INPUT_STYLE}
              />
            </div>

            {/* Orçamento Padrão */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Orçamento Padrão para Novos Times (R$)</label>
              <input
                type="number"
                step="0.01"
                value={params.default_budget}
                onChange={(e) => setParams((p) => ({ ...p, default_budget: e.target.value }))}
                placeholder="Ex: 50000000.00"
                className={INPUT_STYLE}
              />
            </div>

            {/* Teto Salarial */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Teto Salarial Padrão (R$)</label>
              <input
                type="number"
                step="0.01"
                value={params.default_wage_cap}
                onChange={(e) => setParams((p) => ({ ...p, default_wage_cap: e.target.value }))}
                placeholder="Ex: 15000.00"
                className={INPUT_STYLE}
              />
            </div>

            {/* Relação Salário/Passe */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Relação Salário/Passe (multiplicador)</label>
              <input
                type="number"
                step="0.01"
                value={params.salary_wage_ratio}
                onChange={(e) => setParams((p) => ({ ...p, salary_wage_ratio: e.target.value }))}
                placeholder="Ex: 20"
                className={INPUT_STYLE}
              />
            </div>

            {/* Salário Default */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Salário Default (R$)</label>
              <input
                type="number"
                step="0.01"
                value={params.default_salary}
                onChange={(e) => setParams((p) => ({ ...p, default_salary: e.target.value }))}
                placeholder="Ex: 200"
                className={INPUT_STYLE}
              />
            </div>

            {/* Máximo de jogadores */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Nº máx. de jogadores por equipe (0 = desativado)</label>
              <input
                type="number"
                min="0"
                value={params.max_players_per_team}
                onChange={(e) => setParams((p) => ({ ...p, max_players_per_team: e.target.value }))}
                placeholder="Ex: 26"
                className={INPUT_STYLE}
              />
            </div>

            {/* Horas para confirmação */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Horas para confirmação automática do resultado</label>
              <input
                type="number"
                min="0"
                value={params.result_confirm_hours}
                onChange={(e) => setParams((p) => ({ ...p, result_confirm_hours: e.target.value }))}
                placeholder="Ex: 24"
                className={INPUT_STYLE}
              />
            </div>

            {/* Tempo para Finalizar Leilão */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Tempo para Finalizar Leilão</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={params.auction_time_value}
                  onChange={(e) => setParams((p) => ({ ...p, auction_time_value: e.target.value }))}
                  placeholder="Ex: 48"
                  className="flex-1 bg-[#090d16] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#10b981] transition-colors"
                />
                <select
                  value={params.auction_time_unit}
                  onChange={(e) => setParams((p) => ({ ...p, auction_time_unit: e.target.value }))}
                  className="w-32 bg-[#090d16] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#10b981] transition-colors"
                >
                  {AUCTION_TIME_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Multiplicador Multa */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-300">Multiplicador da Multa Rescisória</label>
              <input
                type="number"
                step="0.01"
                value={params.buyout_multiplier}
                onChange={(e) => setParams((p) => ({ ...p, buyout_multiplier: e.target.value }))}
                placeholder="Ex: 1.50"
                className="w-full md:w-1/2 bg-[#090d16] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#10b981] transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingParams}
              className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-6 py-2.5 text-xs font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {savingParams ? "Salvando..." : "Salvar Parâmetros"}
            </button>
          </div>
        </form>
      </div>

      {/* ===== SEÇÃO 2: Toggles ===== */}
      <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-6 sm:p-8 space-y-6">
        <div className="border-b border-white/5 pb-4">
          <h2 className="text-lg font-bold text-white">Funcionalidades da Liga</h2>
          <p className="text-xs text-gray-400 mt-1">
            Ative ou desative cada funcionalidade individualmente.
          </p>
        </div>

        <FeedbackBanner message={msgToggles} />

        <form onSubmit={handleSaveToggles} className="space-y-6">
          {/* Grid de toggles booleanos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            {TOGGLE_FIELDS.map((field, idx) => (
              <div
                key={field.key}
                className={`flex justify-between items-center py-3 border-b border-white/5 ${
                  idx === TOGGLE_FIELDS.length - 1 || idx === TOGGLE_FIELDS.length - 2
                    ? "md:border-b-0"
                    : ""
                }`}
              >
                <span className="text-sm text-gray-300 pr-4 leading-snug">{field.label}</span>
                <select
                  value={toggles[field.key]}
                  onChange={(e) =>
                    setToggles((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className={SELECT_STYLE}
                >
                  <option value="true">✅ Ativado</option>
                  <option value="false">❌ Desativado</option>
                </select>
              </div>
            ))}
          </div>

          {/* Selects especiais */}
          <div className="border-t border-white/5 pt-4 space-y-1">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Configurações Especiais</h3>

            <div className="flex justify-between items-center py-3 border-b border-white/5">
              <span className="text-sm text-gray-300">Quem paga o salário dos jogadores emprestados?</span>
              <select
                value={toggles.salary_payer_loans}
                onChange={(e) => setToggles((prev) => ({ ...prev, salary_payer_loans: e.target.value }))}
                className={SELECT_STYLE}
              >
                <option value="owner">Dono do Jogador</option>
                <option value="loan_team">Time Tomador</option>
              </select>
            </div>

            <div className="flex justify-between items-center py-3">
              <span className="text-sm text-gray-300">Multa/Bônus ao Demitir Jogador</span>
              <select
                value={toggles.fire_player_penalty}
                onChange={(e) => setToggles((prev) => ({ ...prev, fire_player_penalty: e.target.value }))}
                className={SELECT_STYLE}
              >
                <option value="none">Nenhuma ação</option>
                <option value="penalty">Multa</option>
                <option value="bonus">Bônus</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingToggles}
              className="rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] px-6 py-2.5 text-xs font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {savingToggles ? "Salvando..." : "Salvar Funcionalidades"}
            </button>
          </div>
        </form>
      </div>

      {/* ===== ZONA DE PERIGO ===== */}
      <div className="glass-panel rounded-2xl border border-red-500/20 bg-[#090d16]/75 p-6 sm:p-8 space-y-4">
        <div className="border-b border-red-500/10 pb-4">
          <h2 className="text-lg font-bold text-red-400">⚠️ Zona de Perigo</h2>
          <p className="text-xs text-gray-400 mt-1">Ações críticas e irreversíveis sobre a base de dados.</p>
        </div>

        <FeedbackBanner message={msgPurge} />

        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Purgar Jogadores Livres</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Apaga todos os jogadores sem time associado (agentes livres) e seus leilões ativos. Irreversível.
            </p>
          </div>
          {!showPurgeConfirm ? (
            <button
              onClick={() => setShowPurgeConfirm(true)}
              className="rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-5 py-2.5 text-xs font-bold text-red-400 transition-all active:scale-[0.98] whitespace-nowrap self-start sm:self-center"
            >
              Purgar Jogadores
            </button>
          ) : (
            <div className="flex gap-2 self-start sm:self-center">
              <button
                onClick={handlePurgeFreeAgents}
                disabled={purging}
                className="rounded-xl bg-red-500 hover:bg-red-600 px-5 py-2.5 text-xs font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50 whitespace-nowrap"
              >
                {purging ? "Purgando..." : "Confirmar Purga"}
              </button>
              <button
                onClick={() => setShowPurgeConfirm(false)}
                className="rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 text-xs font-bold text-gray-300 transition-all"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
