"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { adminCommandService } from "@/services/adminCommandService";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function ShieldCard({ team, onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const inputRef = useRef(null);

  const showMsg = (text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 5000);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      showMsg("Tipo de arquivo inválido. Use JPG, PNG ou WEBP.", "error");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showMsg("Arquivo muito grande. Máximo 2 MB.", "error");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.set("kind", "shield");
      form.set("teamId", team.id);
      form.set("file", file);
      const { url: publicUrl } = await adminCommandService.uploadAsset(form);

      showMsg("Escudo atualizado!");
      onUploadSuccess(team.id, publicUrl);
    } catch (err) {
      showMsg("Erro: " + err.message, "error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="glass-card rounded-2xl border border-white/5 bg-[#090d16]/60 p-5 flex flex-col items-center gap-3 hover:border-[#10b981]/30 transition-all">
      {/* Escudo */}
      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
        {team.badge_url ? (
          <img
            src={team.badge_url}
            alt={`Escudo ${team.name}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-3xl">🛡️</span>
        )}
      </div>

      {/* Nome do time */}
      <p className="text-sm font-semibold text-white text-center leading-tight">{team.name}</p>

      {/* Feedback */}
      {msg.text && (
        <p className={`text-xs text-center ${msg.type === "error" ? "text-red-400" : "text-emerald-400"}`}>
          {msg.text}
        </p>
      )}

      {/* Botão upload */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
        id={`shield-upload-${team.id}`}
      />
      <label
        htmlFor={`shield-upload-${team.id}`}
        className={`w-full text-center rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer transition-all ${
          uploading
            ? "bg-white/5 text-gray-500 pointer-events-none"
            : "bg-[#10b981]/10 hover:bg-[#10b981]/20 border border-[#10b981]/20 text-[#10b981]"
        }`}
      >
        {uploading ? "Enviando..." : "Alterar Escudo"}
      </label>
    </div>
  );
}

export default function AdminShieldsPage() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadTeams() {
      try {
        const { data, error } = await supabase
          .from("teams")
          .select("id, name, badge_url")
          .order("name");
        if (error) throw error;
        setTeams(data || []);
      } catch (err) {
        console.error("Erro ao carregar times:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTeams();
  }, []);

  const handleUploadSuccess = (teamId, newUrl) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, badge_url: newUrl } : t))
    );
  };

  const filtered = teams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Escudos dos Times
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Gerencie os escudos de cada equipe. Faça upload de imagens JPG, PNG ou WEBP (máx. 2 MB).
        </p>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filtrar times..."
        className="w-full max-w-sm bg-[#090d16] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#10b981] transition-colors"
      />

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">Nenhum time encontrado.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map((team) => (
            <ShieldCard key={team.id} team={team} onUploadSuccess={handleUploadSuccess} />
          ))}
        </div>
      )}
    </div>
  );
}
