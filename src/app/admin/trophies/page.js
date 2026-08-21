"use client";

import { useEffect, useState, useRef } from "react";
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

export default function AdminTrophiesPage() {
  const [teams, setTeams] = useState([]);
  const [trophies, setTrophies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [msgCreate, setMsgCreate] = useState({ text: "", type: "" });

  // Formulário criação
  const [form, setForm] = useState({
    name: "",
    description: "",
    competition: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const imageRef = useRef(null);

  // Modal atribuição
  const [modal, setModal] = useState(null); // { trophy }
  const [assignTeam, setAssignTeam] = useState("");
  const [assignSeason, setAssignSeason] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [msgAssign, setMsgAssign] = useState({ text: "", type: "" });

  const showMsg = (setter, text, type = "success") => {
    setter({ text, type });
    setTimeout(() => setter({ text: "", type: "" }), 5000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: teamsData }, { data: trophiesData }] = await Promise.all([
        supabase.from("teams").select("id, name, badge_url").order("name"),
        supabase
          .from("trophies")
          .select("*, team_trophies(id, season, teams(id, name))")
          .order("created_at", { ascending: false }),
      ]);
      setTeams(teamsData || []);
      setTrophies(trophiesData || []);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setCreating(true);
    try {
      let image_url = null;

      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const fileName = `trophy_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("trophies")
          .upload(fileName, imageFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("trophies").getPublicUrl(fileName);
        image_url = urlData?.publicUrl;
      }

      const { error } = await supabase.from("trophies").insert({
        name: form.name,
        description: form.description,
        competition: form.competition,
        image_url,
      });
      if (error) throw error;

      showMsg(setMsgCreate, "Troféu criado com sucesso!");
      setForm({ name: "", description: "", competition: "" });
      setImageFile(null);
      if (imageRef.current) imageRef.current.value = "";
      load();
    } catch (err) {
      showMsg(setMsgCreate, err.message || "Erro ao criar troféu.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignTeam) return;
    setAssigning(true);
    try {
      const { error } = await supabase.from("team_trophies").insert({
        trophy_id: modal.trophy.id,
        team_id: assignTeam,
        season: assignSeason || null,
      });
      if (error) throw error;
      showMsg(setMsgAssign, "Troféu atribuído!");
      setAssignTeam("");
      setAssignSeason("");
      load();
    } catch (err) {
      showMsg(setMsgAssign, err.message || "Erro ao atribuir troféu.", "error");
    } finally {
      setAssigning(false);
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
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Troféus</h1>
        <p className="mt-1 text-sm text-gray-400">Crie troféus e atribua-os a times campeões.</p>
      </div>

      {/* Formulário de Criação */}
      <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-6 sm:p-8 space-y-5">
        <h2 className="text-lg font-bold text-white border-b border-white/5 pb-3">Novo Troféu</h2>
        <Feedback msg={msgCreate} />
        <form noValidate onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Nome do Troféu *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Campeão Nacional"
                className={INPUT_STYLE}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Competição</label>
              <input
                type="text"
                value={form.competition}
                onChange={(e) => setForm((f) => ({ ...f, competition: e.target.value }))}
                placeholder="Ex: Liga Master"
                className={INPUT_STYLE}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-300">Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descrição do troféu..."
                rows={2}
                className={INPUT_STYLE + " resize-none"}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Imagem do Troféu</label>
              <input
                ref={imageRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setImageFile(e.target.files[0] || null)}
                className="w-full text-xs text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-[#10b981]/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#10b981] hover:file:bg-[#10b981]/20"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-6 py-2.5 text-xs font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {creating ? "Criando..." : "Criar Troféu"}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Troféus */}
      <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-6 sm:p-8 space-y-4">
        <h2 className="text-lg font-bold text-white border-b border-white/5 pb-3">
          Troféus Cadastrados ({trophies.length})
        </h2>
        {trophies.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">Nenhum troféu cadastrado ainda.</p>
        ) : (
          <div className="space-y-3">
            {trophies.map((trophy) => (
              <div
                key={trophy.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/3 border border-white/5 hover:border-white/10 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {trophy.image_url ? (
                      <img src={trophy.image_url} alt={trophy.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-2xl">🏅</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{trophy.name}</p>
                    {trophy.competition && (
                      <p className="text-xs text-gray-400">{trophy.competition}</p>
                    )}
                    {trophy.team_trophies && trophy.team_trophies.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {trophy.team_trophies.map((tt) => (
                          <span
                            key={tt.id}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          >
                            {tt.teams?.name}{tt.season ? ` (${tt.season})` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setModal({ trophy })}
                  className="rounded-xl bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 border border-[#3b82f6]/20 px-4 py-2 text-xs font-semibold text-[#3b82f6] transition-all self-start sm:self-center whitespace-nowrap"
                >
                  Atribuir a Time
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Atribuição */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-white/10 bg-[#090d16] p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                Atribuir: {modal.trophy.name}
              </h3>
              <button
                onClick={() => { setModal(null); setAssignTeam(""); setAssignSeason(""); setMsgAssign({ text: "", type: "" }); }}
                className="text-gray-400 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>
            <Feedback msg={msgAssign} />
            <form noValidate onSubmit={handleAssign} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">Time *</label>
                <select
                  required
                  value={assignTeam}
                  onChange={(e) => setAssignTeam(e.target.value)}
                  className="w-full bg-[#090d16] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#10b981] transition-colors"
                >
                  <option value="">Selecione um time...</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">Temporada (opcional)</label>
                <input
                  type="text"
                  value={assignSeason}
                  onChange={(e) => setAssignSeason(e.target.value)}
                  placeholder="Ex: 2024/25"
                  className="w-full bg-[#090d16] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#10b981] transition-colors"
                />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => { setModal(null); setAssignTeam(""); setAssignSeason(""); }}
                  className="rounded-xl bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-semibold text-gray-300 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={assigning}
                  className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-5 py-2 text-xs font-bold text-white transition-all disabled:opacity-50"
                >
                  {assigning ? "Atribuindo..." : "Atribuir Troféu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
