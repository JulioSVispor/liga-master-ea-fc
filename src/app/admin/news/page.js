"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { adminCommandService } from "@/services/adminCommandService";
import { AppImage } from "@/components/ui/AppImage";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";

const CATEGORIES = [
  { value: "admin", label: "📢 Comunicado Oficial" },
  { value: "general", label: "📰 Notícia Geral" },
  { value: "finance", label: "💰 Finanças" },
  { value: "transfer", label: "🤝 Transferência" },
];

export default function AdminNewsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [news, setNews] = useState([]);
  const [teams, setTeams] = useState([]);

  // Estados do Form
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("admin");
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const [msg, setMsg] = useState({ text: "", type: "" });

  const showMsg = (text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 5000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Carregar Notícias mais recentes
      const { data: newsData, error: newsError } = await supabase
        .from("market_news")
        .select(`
          *,
          teams!team_id(name, badge_url)
        `)
        .order("created_at", { ascending: false });

      if (newsError) throw newsError;
      setNews(newsData || []);

      // 2. Carregar lista de times para associar na notícia manual
      const { data: teamsData, error: teamsError } = await supabase
        .from("teams")
        .select("id, name, badge_url")
        .order("name", { ascending: true });

      if (teamsError) throw teamsError;
      setTeams(teamsData || []);

    } catch (err) {
      console.error(err);
      showMsg("Erro ao carregar dados: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useDeferredEffect(loadData);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showMsg("Preencha o título e o conteúdo da notícia!", "error");
      return;
    }

    setSaving(true);
    try {
      await adminCommandService.createNews({
        title: title.trim(),
        content: content.trim(),
        category,
        teamId: selectedTeamId || null,
      });

      showMsg("Notícia publicada com sucesso no Mural!");
      setTitle("");
      setContent("");
      setSelectedTeamId("");
      setCategory("admin");

      // Recarregar lista
      await loadData();
    } catch (err) {
      console.error(err);
      showMsg("Erro ao publicar notícia: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await adminCommandService.removeNews(id);

      showMsg("Notícia removida do Mural com sucesso!");
      setNews((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error(err);
      showMsg("Erro ao remover notícia: " + err.message, "error");
    } finally {
      setDeletingId(null);
    }
  };

  const getCategoryBadgeColor = (cat) => {
    switch (cat) {
      case "admin":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "transfer":
      case "auction":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "finance":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "stage":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-white/5 text-gray-300 border-white/10";
    }
  };

  const getCategoryLabel = (cat) => {
    switch (cat) {
      case "admin": return "Comunicado Oficial";
      case "transfer": return "Transferência";
      case "auction": return "Leilão";
      case "finance": return "Financeiro";
      case "stage": return "Etapa do Campeonato";
      default: return "Notícia Geral";
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
          Gerenciador do Mural de Notícias
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Publique recados manuais para a liga ou remova notícias antigas e automáticas do mural.
        </p>
      </div>

      {/* Feedback Banner */}
      {msg.text && (
        <div
          className={`p-3 rounded-xl border text-sm flex items-center gap-2 transition-all ${
            msg.type === "error"
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          <span>{msg.type === "error" ? "⚠️" : "✅"}</span>
          {msg.text}
        </div>
      )}

      {/* Formulário de Criação */}
      <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-6 sm:p-8 space-y-6">
        <h2 className="text-lg font-bold text-white border-b border-white/5 pb-3 flex items-center gap-2">
          ✍️ Publicar Novo Comunicado/Notícia
        </h2>

        <form noValidate onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Título da Notícia */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-gray-300">Título da Notícia</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Prazos da Rodada 8 Definidos!"
                className="w-full resize-none bg-[#090d16] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#10b981] transition-colors"
                maxLength={100}
              />
            </div>

            {/* Categoria */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full resize-none bg-[#090d16] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#10b981] transition-colors"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value} className="bg-[#090d16] text-white">
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Clube Associado */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Clube Associado (Opcional)</label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full bg-[#090d16] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#10b981] transition-colors"
              >
                <option value="">Nenhum clube específico</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id} className="bg-[#090d16] text-white">
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Conteúdo */}
            <div className="md:col-span-3 space-y-1">
              <label className="text-xs font-semibold text-gray-300">Conteúdo Detalhado</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                placeholder="Escreva os detalhes da notícia que os diretores verão no painel principal..."
                className="w-full resize-none bg-[#090d16] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#10b981] transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-6 py-2.5 text-xs font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "Publicando..." : "📢 Publicar no Mural"}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Notícias Ativas */}
      <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 p-6 sm:p-8 space-y-6">
        <h2 className="text-lg font-bold text-white border-b border-white/5 pb-3">
          📰 Notícias Publicadas no Mural
        </h2>

        {news.length === 0 ? (
          <p className="text-gray-500 text-xs text-center py-6">Nenhuma notícia registrada no mural ainda.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {news.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] flex flex-col justify-between gap-4 transition-all duration-200"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getCategoryBadgeColor(item.category)}`}>
                      {getCategoryLabel(item.category)}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(item.created_at).toLocaleDateString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="flex items-start gap-3">
                    {item.badge_url && (
                      <AppImage src={item.badge_url} alt="" className="w-10 h-10 object-contain rounded bg-white/5 p-1 flex-shrink-0" />
                    )}
                    {item.player_face_url && !item.badge_url && (
                      <AppImage src={item.player_face_url} alt="" className="w-10 h-10 object-cover rounded-full bg-white/5 border border-white/10 flex-shrink-0" />
                    )}
                    <div>
                      <h4 className="text-sm font-bold text-white leading-snug">{item.title}</h4>
                      <p className="text-xs text-gray-400 mt-1.5 leading-relaxed line-clamp-3">{item.content}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end border-t border-white/5 pt-3">
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors py-1 px-2.5 rounded bg-red-500/10 border border-red-500/20"
                  >
                    {deletingId === item.id ? "Removendo..." : "🗑️ Remover Notícia"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
