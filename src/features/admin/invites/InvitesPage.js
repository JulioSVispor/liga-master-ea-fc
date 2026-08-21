"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function InvitesPage() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const loadEmails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("allowed_emails")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error) setEmails(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEmails(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("allowed_emails").insert([
        {
          email: newEmail.trim().toLowerCase(),
          display_name: newDisplayName.trim() || null,
          added_by: user?.id || null,
        },
      ]);
      if (error) {
        if (error.code === "23505") showAlert("error", "Este e-mail já está na lista.");
        else showAlert("error", "Erro ao adicionar: " + error.message);
      } else {
        showAlert("success", `E-mail ${newEmail} adicionado com sucesso!`);
        setNewEmail("");
        setNewDisplayName("");
        setShowAddModal(false);
        await loadEmails();
      }
    } catch (err) {
      showAlert("error", "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id, email) => {
    if (!confirm(`Remover ${email} da whitelist?`)) return;
    try {
      const { error } = await supabase.from("allowed_emails").delete().eq("id", id);
      if (!error) {
        showAlert("success", `${email} removido da lista.`);
        await loadEmails();
      }
    } catch (err) {
      showAlert("error", "Erro ao remover.");
    }
  };

  const pending = emails.filter(e => !e.used);
  const registered = emails.filter(e => e.used);

  return (
    <div className="space-y-6">
      {/* Alert */}
      {alert && (
        <div className={`p-3 rounded-xl text-sm border flex items-center gap-2 animate-fadeIn ${
          alert.type === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
        }`}>
          <span>{alert.type === "success" ? "✅" : "⚠️"}</span>
          <span>{alert.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Participantes / Convites</h1>
          <p className="text-sm text-gray-400 mt-1">
            Gerencie os e-mails autorizados a se registrar na liga.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-4 py-2.5 text-sm font-bold text-white shadow transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          + Adicionar E-mail
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 rounded-2xl text-center">
          <p className="text-2xl font-black text-white">{emails.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total na Lista</p>
        </div>
        <div className="glass-card p-4 rounded-2xl text-center">
          <p className="text-2xl font-black text-emerald-400">{registered.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Já Registrados</p>
        </div>
        <div className="glass-card p-4 rounded-2xl text-center">
          <p className="text-2xl font-black text-amber-400">{pending.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Aguardando</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Aguardando registro */}
          {pending.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-4">
              <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                ⏳ Aguardando Registro ({pending.length})
              </h2>
              <div className="space-y-2">
                {pending.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.email}</p>
                      {item.display_name && <p className="text-xs text-gray-400">{item.display_name}</p>}
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Adicionado em {new Date(item.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemove(item.id, item.email)}
                      className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-2.5 py-1 rounded-lg transition-all"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Já registrados */}
          {registered.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-4">
              <h2 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                ✅ Já Registrados ({registered.length})
              </h2>
              <div className="space-y-2">
                {registered.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.email}</p>
                      {item.display_name && <p className="text-xs text-gray-400">{item.display_name}</p>}
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Registrado em {item.used_at ? new Date(item.used_at).toLocaleDateString("pt-BR") : "—"}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      Ativo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {emails.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-4xl mb-2">📋</p>
              <p className="text-sm">Nenhum e-mail cadastrado ainda.</p>
              <p className="text-xs mt-1">Clique em "Adicionar E-mail" para convidar um participante.</p>
            </div>
          )}
        </>
      )}

      {/* Modal de Adição */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <div className="glass-panel w-full max-w-sm p-6 rounded-2xl border border-white/10 bg-[#090d16]/95 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-white">+ Adicionar Participante</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white text-xs bg-white/5 px-2.5 py-1 rounded-lg">✕</button>
            </div>
            <form noValidate onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1">E-mail *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="participante@email.com"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1">Nome (opcional)</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-sm text-white placeholder-gray-500 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 py-2.5 text-xs font-bold text-gray-300 transition-all">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 py-2.5 text-xs font-bold text-white transition-all">
                  {saving ? "Salvando..." : "Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
