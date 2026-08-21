"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/Badge";

export default function NewsPage() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNews() {
      try {
        const { data, error } = await supabase
          .from("market_news")
          .select("*, teams!team_id(name, badge_url)")
          .order("created_at", { ascending: false })
          .limit(30);

        if (!error && data) {
          setNews(data);
        }
      } catch (err) {
        console.error("Erro ao carregar notícias:", err);
      } finally {
        setLoading(false);
      }
    }
    loadNews();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Mural de Notícias</h1>
        <p className="mt-1 text-sm text-gray-400">Últimos comunicados, transferências e avisos da Liga.</p>
      </div>

      {news.length === 0 ? (
        <div className="glass-panel p-8 text-center rounded-2xl border border-white/5 bg-[#090d16]/75">
          <span className="text-4xl mb-4 block">📭</span>
          <h3 className="text-lg font-bold text-white">Nenhuma notícia</h3>
          <p className="text-gray-400 text-sm mt-1">O mural de notícias está vazio no momento.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {news.map((item) => (
            <div key={item.id} className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#090d16]/75 flex flex-col sm:flex-row gap-5 items-start transition-all hover:bg-white/[0.02]">
              <div className="flex-shrink-0 flex items-center justify-center h-14 w-14 rounded-xl bg-black/20 border border-white/10">
                {item.badge_url ? (
                  <img src={item.badge_url} alt="" className="w-10 h-10 object-contain drop-shadow-md" />
                ) : item.player_face_url ? (
                  <img src={item.player_face_url} alt="" className="w-10 h-10 object-cover rounded-full drop-shadow-md" />
                ) : (
                  <span className="text-2xl">📰</span>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      item.category === "transfer" ? "success"
                      : item.category === "stage" ? "warning"
                      : item.category === "finance" ? "info"
                      : item.category === "auction" ? "warning"
                      : "default"
                    }>
                      {item.category === "transfer" ? "Transferência" : item.category === "stage" ? "Fase da Liga" : item.category === "finance" ? "Financeiro" : item.category === "auction" ? "Leilão" : "Comunicado"}
                    </Badge>
                    {item.teams?.name && (
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{item.teams.name}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 font-medium">
                    {new Date(item.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <h3 className="text-base font-bold text-gray-100">{item.title}</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{item.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
