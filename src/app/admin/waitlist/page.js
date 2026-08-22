"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminCommandService } from "@/services/adminCommandService";

const INPUT_STYLE =
  "w-full bg-[#090d16] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#10b981] transition-colors";

const STATUS_CONFIG = {
  pending: { label: "Pendente", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  approved: { label: "Aprovado", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  rejected: { label: "Rejeitado", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

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

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("all");
  const [msgCreate, setMsgCreate] = useState({ text: "", type: "" });
  const [msgAction, setMsgAction] = useState({ text: "", type: "" });

  const [form, setForm] = useState({
    name: "",
    whatsapp: "",
    email: "",
    desired_team: "",
    notes: "",
  });

  const showMsg = (setter, text, type = "success") => {
    setter({ text, type });
    setTimeout(() => setter({ text: "", type: "" }), 5000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("waitlist")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      console.error("Erro ao carregar lista de espera:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await adminCommandService.createWaitlistEntry({
        name: form.name,
        whatsapp: form.whatsapp,
        email: form.email || null,
        desiredTeam: form.desired_team || null,
        notes: form.notes || null,
      });
      showMsg(setMsgCreate, "Entrada adicionada à lista de espera!");
      setForm({ name: "", whatsapp: "", email: "", desired_team: "", notes: "" });
      load();
    } catch (err) {
      showMsg(setMsgCreate, err.message || "Erro ao adicionar.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await adminCommandService.setWaitlistStatus(id, status);
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
      showMsg(
        setMsgAction,
        status === "approved" ? "Entrada aprovada!" : "Entrada rejeitada."
      );
    } catch (err) {
      showMsg(setMsgAction, err.message || "Erro ao atualizar status.", "error");
    }
  };

  const filtered =
    filter === "all" ? entries : entries.filter((e) => e.status === filter);

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
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Lista de Espera</h1>
        <p className="mt-1 text-sm text-gray-400">
          Gerencie candidatos que desejam participar da liga.
        </p>
      </div>

      {/* Formulário */}
      <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-6 sm:p-8 space-y-5">
        <h2 className="text-lg font-bold text-white border-b border-white/5 pb-3">Adicionar Candidato</h2>
        <Feedback msg={msgCreate} />
        <form noValidate onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Nome *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nome completo"
                className={INPUT_STYLE}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">WhatsApp *</label>
              <input
                type="tel"
                required
                value={form.whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                placeholder="(11) 99999-9999"
                className={INPUT_STYLE}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Email (opcional)</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com"
                className={INPUT_STYLE}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Time Desejado (opcional)</label>
              <input
                type="text"
                value={form.desired_team}
                onChange={(e) => setForm((f) => ({ ...f, desired_team: e.target.value }))}
                placeholder="Ex: Flamengo"
                className={INPUT_STYLE}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-300">Observações (opcional)</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Informações adicionais..."
                rows={2}
                className={INPUT_STYLE + " resize-none"}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-6 py-2.5 text-xs font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {creating ? "Adicionando..." : "Adicionar à Lista"}
            </button>
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
          <h2 className="text-lg font-bold text-white">
            Candidatos ({entries.length})
          </h2>
          {/* Filtros */}
          <div className="flex gap-1.5">
            {[
              { key: "all", label: "Todos" },
              { key: "pending", label: "Pendentes" },
              { key: "approved", label: "Aprovados" },
              { key: "rejected", label: "Rejeitados" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filter === f.key
                    ? "bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30"
                    : "bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <Feedback msg={msgAction} />

        {filtered.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">Nenhuma entrada encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-white/5">
                  <th className="pb-3 pr-4">Nome</th>
                  <th className="pb-3 pr-4">WhatsApp</th>
                  <th className="pb-3 pr-4">Time Desejado</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((entry) => {
                  const statusCfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-white/3 transition-colors group"
                    >
                      <td className="py-3 pr-4">
                        <div>
                          <p className="text-white font-medium">{entry.name}</p>
                          {entry.email && (
                            <p className="text-xs text-gray-500">{entry.email}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{entry.whatsapp}</td>
                      <td className="py-3 pr-4 text-gray-300">
                        {entry.desired_team || <span className="text-gray-600">—</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusCfg.cls}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3">
                        {entry.status === "pending" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStatusChange(entry.id, "approved")}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-semibold text-emerald-400 transition-all"
                            >
                              Aprovar
                            </button>
                            <button
                              onClick={() => handleStatusChange(entry.id, "rejected")}
                              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs font-semibold text-red-400 transition-all"
                            >
                              Rejeitar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
