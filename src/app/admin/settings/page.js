"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ─── Tooltip ℹ️ ────────────────────────────────────────────────────────────
function Tip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center ml-1.5">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        onClick={() => setShow((current) => !current)}
        className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors focus:outline-none"
        aria-label="Ajuda"
      >
        ℹ️
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-[#0d1527] border border-white/10 text-gray-300 text-[11px] leading-relaxed rounded-xl px-3 py-2 shadow-xl z-50 pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#0d1527]" />
        </span>
      )}
    </span>
  );
}

// ─── Feedback inline ───────────────────────────────────────────────────────
function FeedbackBanner({ msg }) {
  if (!msg.text) return null;
  return (
    <div className={`p-3 rounded-xl border text-sm flex items-center gap-2 ${
      msg.type === "error"
        ? "bg-red-500/10 border-red-500/20 text-red-400"
        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
    }`}>
      <span>{msg.type === "error" ? "⚠️" : "✅"}</span>
      {msg.text}
    </div>
  );
}

// ─── Estilos base ──────────────────────────────────────────────────────────
const INPUT = "w-full bg-[#090d16] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#10b981] transition-colors";
const SELECT = "w-44 bg-[#090d16] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#10b981] transition-colors flex-shrink-0";

// ─── Linha de toggle ───────────────────────────────────────────────────────
function ToggleRow({ label, tip, stateKey, toggles, setToggles, options }) {
  const opts = options || [
    { value: "true",  label: "✅ Ativado" },
    { value: "false", label: "❌ Desativado" },
  ];
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-white/5 last:border-0 gap-4">
      <span className="text-sm text-gray-300 leading-snug flex items-center">
        {label}
        {tip && <Tip text={tip} />}
      </span>
      <select
        value={toggles[stateKey]}
        onChange={(e) => setToggles((p) => ({ ...p, [stateKey]: e.target.value }))}
        className={SELECT}
      >
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Linha de input numérico / texto ──────────────────────────────────────
function InputRow({ label, tip, stateKey, params, setParams, placeholder, type = "number", step, min, suffix, half }) {
  return (
    <div className={`space-y-1.5 ${half ? "" : "md:col-span-1"}`}>
      <label className="text-xs font-semibold text-gray-300 flex items-center">
        {label}
        {tip && <Tip text={tip} />}
        {suffix && <span className="ml-1 text-gray-600 font-normal">{suffix}</span>}
      </label>
      <input
        type={type}
        step={step}
        min={min}
        value={params[stateKey]}
        onChange={(e) => setParams((p) => ({ ...p, [stateKey]: e.target.value }))}
        placeholder={placeholder}
        className={INPUT}
      />
    </div>
  );
}

// ─── Abas ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: "mercado",    label: "🔄 Mercado",    title: "Mercado & Transferências" },
  { key: "financas",  label: "💰 Finanças",   title: "Configurações Financeiras" },
  { key: "clube",     label: "🎮 Clube",       title: "Regras do Clube" },
  { key: "prazos",    label: "⏱️ Prazos",     title: "Prazos & Tempos" },
  { key: "parametros",label: "🔢 Parâmetros", title: "Parâmetros Gerais" },
  { key: "perigo",    label: "⚠️ Perigo",     title: "Zona de Perigo" },
];

// ═══════════════════════════════════════════════════════════════════════════
export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("mercado");
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [userRole, setUserRole] = useState(null);

  // Estados de confirmação dos Master Resets
  const [masterActionLoading, setMasterActionLoading] = useState(false);
  const [masterMsg, setMasterMsg] = useState({ text: "", type: "" });
  
  const [showResetSquads, setShowResetSquads] = useState(false);
  const [confirmResetSquadsText, setConfirmResetSquadsText] = useState("");

  const [showResetBudgets, setShowResetBudgets] = useState(false);
  const [confirmResetBudgetsText, setConfirmResetBudgetsText] = useState("");

  const [showDeleteClubs, setShowDeleteClubs] = useState(false);
  const [confirmDeleteClubsText, setConfirmDeleteClubsText] = useState("");

  const showMsg = (text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 5000);
  };

  const showMasterMsg = (text, type = "success") => {
    setMasterMsg({ text, type });
    setTimeout(() => setMasterMsg({ text: "", type: "" }), 6000);
  };

  // ── Estado dos parâmetros ────────────────────────────────────────────────
  const [params, setParams] = useState({
    league_name: "",
    default_budget: "",
    default_wage_cap: "",
    salary_to_value_ratio: "",
    default_salary: "",
    max_players_per_team: "",
    result_confirm_hours: "",
    auction_time_value: "",
    auction_time_unit: "Horas",
    buyout_multiplier: "",
  });

  // ── Estado dos toggles ───────────────────────────────────────────────────
  const [toggles, setToggles] = useState({
    // Mercado
    negotiations_enabled: "true",
    negotiations_no_contract: "false",
    loan_enabled: "true",
    trade_enabled: "true",
    buyout_enabled: "true",
    auto_accept_proposals: "false",
    allow_player_auction: "true",
    salary_payer_loans: "owner",
    // Finanças
    wage_cap_enabled: "true",
    statement_public: "false",
    salary_window_open: "false",
    modify_salary_on_buy: "false",
    // Clube
    allow_shield_change: "true",
    allow_repeated_shield: "false",
    allow_sponsor_change: "false",
    allow_money_transfer: "false",
    fire_player_enabled: "true",
    fire_player_penalty: "none",
  });

  // ── Carregar configurações ───────────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    try {
      // Carregar papel do usuário logado
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile) {
          setUserRole(profile.role);
        }
      }

      const { data } = await supabase.from("settings").select("*");
      if (data) {
        const map = {};
        data.forEach((item) => { map[item.key] = item.value; });

        setParams((prev) => ({
          league_name:           map.league_name           ?? prev.league_name,
          default_budget:        map.default_budget        ?? prev.default_budget,
          default_wage_cap:      map.default_wage_cap      ?? prev.default_wage_cap,
          salary_to_value_ratio: map.salary_to_value_ratio ?? prev.salary_to_value_ratio,
          default_salary:        map.default_salary        ?? prev.default_salary,
          max_players_per_team:  map.max_players_per_team  ?? prev.max_players_per_team,
          result_confirm_hours:  map.result_confirm_hours  ?? prev.result_confirm_hours,
          auction_time_value:    map.auction_time_value    ?? prev.auction_time_value,
          auction_time_unit:     map.auction_time_unit     ?? prev.auction_time_unit,
          buyout_multiplier:     map.buyout_multiplier     ?? prev.buyout_multiplier,
        }));

        setToggles((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((k) => {
            if (map[k] !== undefined) next[k] = map[k];
          });
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

  // ── Salvar tudo junto ────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const all = [
        ...Object.entries(params).map(([key, value]) => ({ key, value: String(value) })),
        ...Object.entries(toggles).map(([key, value]) => ({ key, value: String(value) })),
      ];
      const { error } = await supabase.from("settings").upsert(all, { onConflict: "key" });
      if (error) throw error;
      showMsg("Configurações salvas com sucesso!");
    } catch (err) {
      showMsg(err.message || "Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Handlers de Master Reset ─────────────────────────────────────────────
  const handleResetAllSquads = async () => {
    if (confirmResetSquadsText !== "RESETAR ELENCOS") {
      showMasterMsg("Texto de confirmação incorreto.", "error");
      return;
    }
    setMasterActionLoading(true);
    try {
      const { data, error } = await supabase.rpc("reset_all_squads");
      if (error) throw error;
      if (data && data.success) {
        showMasterMsg(data.message, "success");
        setShowResetSquads(false);
        setConfirmResetSquadsText("");
      } else {
        showMasterMsg(data?.message || "Erro ao resetar elencos.", "error");
      }
    } catch (err) {
      showMasterMsg(err.message, "error");
    } finally {
      setMasterActionLoading(false);
    }
  };

  const handleResetAllBudgets = async () => {
    if (confirmResetBudgetsText !== "RESETAR FINANÇAS") {
      showMasterMsg("Texto de confirmação incorreto.", "error");
      return;
    }
    setMasterActionLoading(true);
    try {
      const { data, error } = await supabase.rpc("reset_all_budgets");
      if (error) throw error;
      if (data && data.success) {
        showMasterMsg(data.message, "success");
        setShowResetBudgets(false);
        setConfirmResetBudgetsText("");
      } else {
        showMasterMsg(data?.message || "Erro ao restaurar orçamentos.", "error");
      }
    } catch (err) {
      showMasterMsg(err.message, "error");
    } finally {
      setMasterActionLoading(false);
    }
  };

  const handleDeleteAllClubs = async () => {
    if (confirmDeleteClubsText !== "DELETAR CLUBES") {
      showMasterMsg("Texto de confirmação incorreto.", "error");
      return;
    }
    setMasterActionLoading(true);
    try {
      const { data, error } = await supabase.rpc("delete_all_clubs");
      if (error) throw error;
      if (data && data.success) {
        showMasterMsg(data.message, "success");
        setShowDeleteClubs(false);
        setConfirmDeleteClubsText("");
      } else {
        showMasterMsg(data?.message || "Erro ao deletar clubes.", "error");
      }
    } catch (err) {
      showMasterMsg(err.message, "error");
    } finally {
      setMasterActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent" />
      </div>
    );
  }

  // Abas dinâmicas: apenas master vê a aba de perigo
  const tabs = [
    { key: "mercado",    label: "🔄 Mercado",    title: "Mercado & Transferências" },
    { key: "financas",  label: "💰 Finanças",   title: "Configurações Financeiras" },
    { key: "clube",     label: "🎮 Clube",       title: "Regras do Clube" },
    { key: "prazos",    label: "⏱️ Prazos",     title: "Prazos & Tempos" },
    { key: "parametros",label: "🔢 Parâmetros", title: "Parâmetros Gerais" },
  ];
  if (userRole === "master") {
    tabs.push({ key: "perigo", label: "⚠️ Master Reset", title: "Zona de Master Reset (Dono da Liga)" });
  }

  const activeTabData = tabs.find((t) => t.key === activeTab);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Configurações da Liga</h1>
          <p className="mt-1 text-sm text-gray-400">
            Passe o mouse no <span className="text-gray-500">ℹ️</span> de cada opção para entender o que ela faz.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? "Salvando..." : "💾 Salvar Tudo"}
        </button>
      </div>

      <FeedbackBanner msg={msg} />

      {/* Abas */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all ${
              activeTab === tab.key
                ? "bg-[#090d16]/75 text-white border border-white/10 border-b-[#090d16]/75 -mb-px"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Painel da aba */}
      <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-6 sm:p-8">
        <div className="border-b border-white/5 pb-4 mb-6">
          <h2 className="text-base font-bold text-white">{activeTabData?.title}</h2>
        </div>

        {/* ── ABA: MERCADO ─────────────────────────────────────────────── */}
        {activeTab === "mercado" && (
          <div className="space-y-0">
            <ToggleRow
              label="Negociações entre times"
              tip="Quando ativado, os times podem enviar e receber propostas de compra/venda de jogadores entre si."
              stateKey="negotiations_enabled"
              toggles={toggles} setToggles={setToggles}
            />
            <ToggleRow
              label="Negociar jogador sem contrato"
              tip="Permite que times façam propostas por jogadores que estão na lista de agentes livres (sem time)."
              stateKey="negotiations_no_contract"
              toggles={toggles} setToggles={setToggles}
            />
            <ToggleRow
              label="Empréstimo de jogadores"
              tip="Times podem ceder jogadores temporariamente para outro time por uma temporada."
              stateKey="loan_enabled"
              toggles={toggles} setToggles={setToggles}
            />
            <ToggleRow
              label="Troca de jogadores"
              tip="Permite que dois times troquem jogadores diretamente entre si, com ou sem compensação financeira."
              stateKey="trade_enabled"
              toggles={toggles} setToggles={setToggles}
            />
            <ToggleRow
              label="Compra via Multa Rescisória"
              tip='Qualquer time pode "roubar" um jogador de outro pagando a multa rescisória definida. O time vendedor não pode recusar.'
              stateKey="buyout_enabled"
              toggles={toggles} setToggles={setToggles}
            />
            <ToggleRow
              label="Aceitar propostas automaticamente"
              tip="Jogadores colocados à venda têm suas propostas aceitas automaticamente se o valor for atingido."
              stateKey="auto_accept_proposals"
              toggles={toggles} setToggles={setToggles}
            />
            <ToggleRow
              label="Times podem enviar jogadores ao leilão"
              tip="Quando ativado, o dono do time pode marcar jogadores para o leilão. O admin ainda precisa abrir o leilão."
              stateKey="allow_player_auction"
              toggles={toggles} setToggles={setToggles}
            />
            <ToggleRow
              label="Quem paga o salário do emprestado?"
              tip="Define se o salário do jogador em empréstimo é debitado do time dono ou do time que o recebeu."
              stateKey="salary_payer_loans"
              toggles={toggles} setToggles={setToggles}
              options={[
                { value: "owner",     label: "🏠 Time Dono" },
                { value: "loan_team", label: "🔁 Time Tomador" },
              ]}
            />
          </div>
        )}

        {/* ── ABA: FINANÇAS ────────────────────────────────────────────── */}
        {activeTab === "financas" && (
          <div className="space-y-0">
            <ToggleRow
              label="Teto Salarial"
              tip="Ativa o limite máximo de folha salarial por time. Times não podem contratar se ultrapassar o teto."
              stateKey="wage_cap_enabled"
              toggles={toggles} setToggles={setToggles}
            />
            <ToggleRow
              label="Janela de Ajuste Salarial"
              tip="Quando aberta, os donos dos times podem ajustar livremente o salário dos seus jogadores sem precisar do admin."
              stateKey="salary_window_open"
              toggles={toggles} setToggles={setToggles}
            />
            <ToggleRow
              label="Modificar salário na compra"
              tip="Quando um time compra um jogador, o salário é recalculado automaticamente com base no valor de transferência."
              stateKey="modify_salary_on_buy"
              toggles={toggles} setToggles={setToggles}
            />
            <ToggleRow
              label="Extrato financeiro público"
              tip="Se ativado, qualquer participante pode ver o extrato de receitas e despesas de todos os times."
              stateKey="statement_public"
              toggles={toggles} setToggles={setToggles}
            />
            <ToggleRow
              label="Permitir transferência de dinheiro"
              tip="Times podem transferir saldo diretamente para outros times (ex: como parte de uma negociação manual)."
              stateKey="allow_money_transfer"
              toggles={toggles} setToggles={setToggles}
            />
          </div>
        )}

        {/* ── ABA: CLUBE ───────────────────────────────────────────────── */}
        {activeTab === "clube" && (
          <div className="space-y-0">
            <ToggleRow
              label="Trocar Escudo do Time"
              tip="Permite que o dono do time faça upload de uma nova imagem de escudo pelo painel do clube."
              stateKey="allow_shield_change"
              toggles={toggles} setToggles={setToggles}
            />
            <ToggleRow
              label="Escudo Repetido"
              tip="Quando desativado, dois times não podem ter o mesmo escudo. Útil para evitar duplicatas."
              stateKey="allow_repeated_shield"
              toggles={toggles} setToggles={setToggles}
            />
            <ToggleRow
              label="Alterar Patrocínio"
              tip="Permite que o time troque o patrocinador ativo pelo painel. Se desativado, apenas o admin pode alterar."
              stateKey="allow_sponsor_change"
              toggles={toggles} setToggles={setToggles}
            />
            <ToggleRow
              label="Demitir Jogador"
              tip="Permite que o dono do time dispense jogadores do elenco pelo painel. Jogadores dispensados viram agentes livres."
              stateKey="fire_player_enabled"
              toggles={toggles} setToggles={setToggles}
            />
            <ToggleRow
              label="Consequência ao Demitir"
              tip="Define se há penalidade financeira (multa para o time) ou benefício (bônus ao jogador) quando um time demite um jogador."
              stateKey="fire_player_penalty"
              toggles={toggles} setToggles={setToggles}
              options={[
                { value: "none",    label: "— Sem consequência" },
                { value: "penalty", label: "💸 Multa para o time" },
                { value: "bonus",   label: "🎁 Bônus ao jogador" },
              ]}
            />
          </div>
        )}

        {/* ── ABA: PRAZOS ──────────────────────────────────────────────── */}
        {activeTab === "prazos" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <InputRow
              label="Confirmação automática de resultado"
              tip="Horas que um time tem para contestar um resultado. Após esse prazo, o resultado é confirmado automaticamente."
              stateKey="result_confirm_hours"
              params={params} setParams={setParams}
              placeholder="Ex: 24"
              suffix="horas"
            />
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300 flex items-center">
                Tempo para finalizar leilão
                <Tip text="Quanto tempo um lance pode ficar sem ser superado antes do leilão ser finalizado automaticamente." />
              </label>
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
                  className="w-28 bg-[#090d16] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#10b981] transition-colors"
                >
                  {["Minutos", "Horas", "Dias"].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── ABA: PARÂMETROS ──────────────────────────────────────────── */}
        {activeTab === "parametros" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <InputRow
              label="Nome Oficial da Liga"
              tip="Nome exibido no cabeçalho do painel e nas notícias geradas automaticamente."
              stateKey="league_name"
              params={params} setParams={setParams}
              placeholder="Ex: Liga Master EA FC 26"
              type="text"
            />
            <InputRow
              label="Orçamento padrão de novos times"
              tip="Saldo inicial que todo time recebe ao se cadastrar na liga. Pode ser ajustado individualmente em Usuários & Times."
              stateKey="default_budget"
              params={params} setParams={setParams}
              placeholder="Ex: 50000000"
              suffix="R$" step="0.01"
            />
            <InputRow
              label="Teto Salarial padrão"
              tip="Limite máximo de folha salarial que cada time pode ter. Times com teto cheio não conseguem contratar."
              stateKey="default_wage_cap"
              params={params} setParams={setParams}
              placeholder="Ex: 15000"
              suffix="R$/mês" step="0.01"
            />
            <InputRow
              label="Salário padrão de jogadores"
              tip="Salário inicial atribuído a jogadores recém-importados sem salário definido."
              stateKey="default_salary"
              params={params} setParams={setParams}
              placeholder="Ex: 200"
              suffix="R$/mês" step="0.01"
            />
            <InputRow
              label="Ratio Salário → Passe"
              tip="Multiplicador usado para calcular o valor de mercado (passe) a partir do salário. Ex: salário R$1.000 × 20 = passe R$20.000."
              stateKey="salary_to_value_ratio"
              params={params} setParams={setParams}
              placeholder="Ex: 20"
              suffix="×" step="0.01"
            />
            <InputRow
              label="Máximo de jogadores por time"
              tip="Limite de jogadores no elenco. Times não conseguem contratar além desse limite. Use 0 para desativar o limite."
              stateKey="max_players_per_team"
              params={params} setParams={setParams}
              placeholder="Ex: 26 (0 = sem limite)"
              min="0"
            />
            <InputRow
              label="Multiplicador da Multa Rescisória"
              tip="A multa rescisória de um jogador é calculada como: passe × multiplicador. Ex: passe R$100k × 1.5 = multa R$150k."
              stateKey="buyout_multiplier"
              params={params} setParams={setParams}
              placeholder="Ex: 1.5"
              suffix="×" step="0.01"
            />
          </div>
        )}

        {/* ── ABA: PERIGO (ZONA DE MASTER RESET) ───────────────────────── */}
        {activeTab === "perigo" && userRole === "master" && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-sm text-red-300 flex items-start gap-3">
              <span className="text-lg flex-shrink-0">⚠️</span>
              <div>
                <p className="font-bold text-white uppercase tracking-wide text-xs">Acesso Restrito: Dono da Liga</p>
                <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                  As ações abaixo realizam alterações estruturais profundas no banco de dados e são <strong>totalmente irreversíveis</strong>.
                  Elas requerem digitação de um texto chave de confirmação para serem executadas.
                </p>
              </div>
            </div>

            {masterMsg.text && (
              <div className={`p-3 rounded-xl border text-sm flex items-center gap-2 ${
                masterMsg.type === "error"
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              }`}>
                <span>{masterMsg.type === "error" ? "⚠️" : "✅"}</span>
                <span className="text-xs font-semibold">{masterMsg.text}</span>
              </div>
            )}

            {/* Reset de Elencos */}
            <div className="p-5 rounded-xl border border-red-500/20 bg-red-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">🔄 Resetar Todos os Elencos</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-xl">
                  Remove os vínculos de todos os jogadores ativos. Todos os atletas cadastrados na liga voltarão a ser Agentes Livres. Os times ficarão sem nenhum jogador. O histórico de transferências registrará as liberações.
                </p>
              </div>
              <button
                onClick={() => setShowResetSquads(true)}
                className="rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-5 py-2.5 text-xs font-bold text-red-400 transition-all whitespace-nowrap self-start sm:self-center"
              >
                Resetar Elencos
              </button>
            </div>

            {/* Reset de Finanças */}
            <div className="p-5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">💰 Restaurar Finanças Globais</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-xl">
                  Restaura o orçamento em caixa e o limite de teto salarial de todos os times para os valores padrões definidos nos parâmetros gerais (Orçamento Padrão e Teto Salarial Padrão).
                </p>
              </div>
              <button
                onClick={() => setShowResetBudgets(true)}
                className="rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 px-5 py-2.5 text-xs font-bold text-amber-400 transition-all whitespace-nowrap self-start sm:self-center"
              >
                Restaurar Finanças
              </button>
            </div>

            {/* Reset Absoluto */}
            <div className="p-5 rounded-xl border border-red-500/30 bg-red-950/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white text-red-400">🔥 Deletar Todos os Clubes e Contas</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-xl">
                  Ação drástica! Exclui todos os clubes, limpa tabelas de jogos (ligas/copas), esvazia lances do mercado, zera históricos de transações e deleta do sistema todas as contas de usuários normais (treinadores). Deixa a liga limpa para recomeçar o campeonato.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteClubs(true)}
                className="rounded-xl bg-red-600 hover:bg-red-700 px-5 py-2.5 text-xs font-bold text-white transition-all whitespace-nowrap self-start sm:self-center shadow-lg shadow-red-500/20"
              >
                Deletar Clubes e Contas
              </button>
            </div>
          </div>
        )}

        {/* Botão Salvar fixo no rodapé do painel (exceto aba Perigo) */}
        {activeTab !== "perigo" && (
          <div className="flex justify-end pt-6 border-t border-white/5 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-6 py-2.5 text-sm font-bold text-white shadow transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "Salvando..." : "💾 Salvar"}
            </button>
          </div>
        )}
      </div>

      {/* Modais de Confirmação Master Reset */}
      {showResetSquads && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 bg-[#090d16] shadow-2xl space-y-5">
            <h3 className="text-base font-bold text-white">Confirmar Reset de Elencos</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Esta ação removerá TODOS os jogadores de seus times e os colocará como agentes livres. Os times ficarão vazios. Digite <strong className="text-red-400 font-bold">RESETAR ELENCOS</strong> abaixo para confirmar:
            </p>
            <input
              type="text"
              placeholder="Digite aqui..."
              value={confirmResetSquadsText}
              onChange={(e) => setConfirmResetSquadsText(e.target.value)}
              className="w-full bg-[#060913] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500"
            />
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => { setShowResetSquads(false); setConfirmResetSquadsText(""); }}
                className="rounded-xl bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-gray-300 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleResetAllSquads}
                disabled={masterActionLoading}
                className="rounded-xl bg-red-500 hover:bg-red-600 px-5 py-2 text-xs font-bold text-white transition-all disabled:opacity-50"
              >
                {masterActionLoading ? "Processando..." : "Confirmar Reset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetBudgets && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md glass-panel p-6 sm:p-8 rounded-2xl border border-white/10 bg-[#090d16] shadow-2xl space-y-5">
            <h3 className="text-base font-bold text-white">Confirmar Reset de Finanças</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Todos os orçamentos e tetos salariais dos times serão redefinidos para os padrões globais da liga. Digite <strong className="text-amber-400 font-bold">RESETAR FINANÇAS</strong> abaixo para confirmar:
            </p>
            <input
              type="text"
              placeholder="Digite aqui..."
              value={confirmResetBudgetsText}
              onChange={(e) => setConfirmResetBudgetsText(e.target.value)}
              className="w-full bg-[#060913] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
            />
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => { setShowResetBudgets(false); setConfirmResetBudgetsText(""); }}
                className="rounded-xl bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-gray-300 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleResetAllBudgets}
                disabled={masterActionLoading}
                className="rounded-xl bg-amber-500 hover:bg-amber-600 px-5 py-2 text-xs font-bold text-black transition-all disabled:opacity-50"
              >
                {masterActionLoading ? "Processando..." : "Confirmar Restauro"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteClubs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md glass-panel p-6 sm:p-8 rounded-2xl border border-red-500/20 bg-[#090d16] shadow-2xl space-y-5">
            <h3 className="text-base font-bold text-white text-red-500 uppercase tracking-wide text-sm">🔥 AÇÃO EXTREMAMENTE CRÍTICA</h3>
            <p className="text-xs text-red-300 leading-relaxed">
              Esta ação apagará permanentemente todos os times, jogos, histórico de transferências, copas e removerá todas as contas dos técnicos (profiles comuns). Digite <strong className="text-red-500 font-bold">DELETAR CLUBES</strong> abaixo para confirmar:
            </p>
            <input
              type="text"
              placeholder="Digite aqui..."
              value={confirmDeleteClubsText}
              onChange={(e) => setConfirmDeleteClubsText(e.target.value)}
              className="w-full bg-[#060913] border border-red-500/20 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-red-500"
            />
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => { setShowDeleteClubs(false); setConfirmDeleteClubsText(""); }}
                className="rounded-xl bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-gray-300 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAllClubs}
                disabled={masterActionLoading}
                className="rounded-xl bg-red-600 hover:bg-red-700 px-5 py-2 text-xs font-bold text-white transition-all disabled:opacity-50"
              >
                {masterActionLoading ? "Deletando Tudo..." : "Sim, Deletar Tudo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
