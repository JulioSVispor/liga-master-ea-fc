"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const INPUT_STYLE =
  "w-full bg-[#090d16] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#10b981] transition-colors";

function Feedback({ msg }) {
  if (!msg.text) return null;
  return (
    <div
      className={`p-3 rounded-xl border text-sm flex items-center gap-2 ${
        msg.type === "error"
          ? "bg-red-500/10 border-red-500/20 text-red-400"
          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
      }`}
    >
      <span>{msg.type === "error" ? "⚠️" : "✅"}</span>
      {msg.text}
    </div>
  );
}

export default function AdminSponsorshipsPage() {
  const [teams, setTeams] = useState([]);
  const [sponsorships, setSponsorships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [msgCreate, setMsgCreate] = useState({ text: "", type: "" });
  const [msgToggle, setMsgToggle] = useState({ text: "", type: "" });

  const [form, setForm] = useState({
    sponsor_name: "",
    value: "",
    duration_seasons: "",
    team_id: "",
  });

  const showMsg = (setter, text, type = "success") => {
    setter({ text, type });
    setTimeout(() => setter({ text: "", type: "" }), 5000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: teamsData }, { data: spData }] = await Promise.all([
        supabase.from("teams").select("id, name").order("name"),
        supabase
          .from("sponsorships")
          .select("*, teams(id, name)")
          .order("created_at", { ascending: false }),
      ]);
      setTeams(teamsData || []);
      setSponsorships(spData || []);
    } catch (err) {
      console.error("Erro ao carregar patrocínios:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { error } = await supabase.from("sponsorships").insert({
        sponsor_name: form.sponsor_name,
        value: parseFloat(form.value) || 0,
        duration_seasons: parseInt(form.duration_seasons) || null,
        team_id: form.team_id || null,
        active: true,
      });
      if (error) throw error;
      showMsg(setMsgCreate, "Patrocínio cadastrado com sucesso!");
      setForm({ sponsor_name: "", value: "", duration_seasons: "", team_id: "" });
      load();
    } catch (err) {
      showMsg(setMsgCreate, err.message || "Erro ao cadastrar patrocínio.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (id, currentActive) => {
    try {
      const { error } = await supabase
        .from("sponsorships")
        .update({ active: !currentActive })
        .eq("id", id);
      if (error) throw error;
      setSponsorships((prev) =>
        prev.map((s) => (s.id === id ? { ...s, active: !currentActive } : s))
      );
      showMsg(setMsgToggle, !currentActive ? "Patrocínio ativado." : "Patrocínio desativado.");
    } catch (err) {
      showMsg(setMsgToggle, err.message || "Erro ao atualizar.", "error");
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
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Patrocínios</h1>
        <p className="mt-1 text-sm text-gray-400">
          Cadastre e gerencie patrocínios associados a times da liga.
        </p>
      </div>

      {/* Formulário */}
      <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-6 sm:p-8 space-y-5">
        <h2 className="text-lg font-bold text-white border-b border-white/5 pb-3">Novo Patrocínio</h2>
        <Feedback msg={msgCreate} />
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Nome do Patrocinador *</label>
              <input
                type="text"
                required
                value={form.sponsor_name}
                onChange={(e) => setForm((f) => ({ ...f, sponsor_name: e.target.value }))}
                placeholder="Ex: Nike, Adidas..."
                className={INPUT_STYLE}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Valor (R$) *</label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="Ex: 500000.00"
                className={INPUT_STYLE}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Duração (temporadas)</label>
              <input
                type="number"
                min="1"
                value={form.duration_seasons}
                onChange={(e) => setForm((f) => ({ ...f, duration_seasons: e.target.value }))}
                placeholder="Ex: 2"
                className={INPUT_STYLE}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Time Associado (opcional)</label>
              <select
                value={form.team_id}
                onChange={(e) => setForm((f) => ({ ...f, team_id: e.target.value }))}
                className="w-full bg-[#090d16] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#10b981] transition-colors"
              >
                <option value="">Liga em geral (sem time específico)</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-6 py-2.5 text-xs font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {creating ? "Cadastrando..." : "Cadastrar Patrocínio"}
            </button>
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-6 sm:p-8 space-y-4">
        <h2 className="text-lg font-bold text-white border-b border-white/5 pb-3">
          Patrocínios Cadastrados ({sponsorships.length})
        </h2>
        <Feedback msg={msgToggle} />

        {sponsorships.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">Nenhum patrocínio cadastrado.</p>
        ) : (
          <div className="space-y-3">
            {sponsorships.map((sp) => (
              <div
                key={sp.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/3 border border-white/5 hover:border-white/10 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">💼</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{sp.sponsor_name}</p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          sp.active
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                        }`}
                      >
                        {sp.active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      R$ {parseFloat(sp.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      {sp.duration_seasons ? ` · ${sp.duration_seasons} temporada(s)` : ""}
                      {sp.teams?.name ? ` · ${sp.teams.name}` : " · Liga Geral"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleActive(sp.id, sp.active)}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold border transition-all self-start sm:self-center ${
                    sp.active
                      ? "bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400"
                      : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-400"
                  }`}
                >
                  {sp.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
