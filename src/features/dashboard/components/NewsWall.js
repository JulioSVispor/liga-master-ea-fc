import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AppImage } from "@/components/ui/AppImage";

export default function NewsWall({ news }) {
  if (!news || news.length === 0) return null;

  return (
    <Card className="bg-[#090d16]/50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📰</span>
          <div>
            <CardTitle>Mural de Notícias</CardTitle>
            <p className="text-xs text-gray-400 mt-1">Últimos comunicados, transferências e avisos.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col gap-6">
          {/* Manchete principal */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-white/[0.02] to-white/[0.05] border border-gray-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <Badge variant={
                  news[0].category === "transfer" ? "success"
                  : news[0].category === "stage" ? "warning"
                  : news[0].category === "finance" ? "info"
                  : news[0].category === "auction" ? "warning"
                  : "default"
                }>
                  {news[0].category === "transfer" ? "Transferência" : news[0].category === "stage" ? "Fase da Liga" : news[0].category === "finance" ? "Financeiro" : news[0].category === "auction" ? "Leilão" : "Comunicado"}
                </Badge>
                <span className="text-[10px] text-gray-500 font-medium">{new Date(news[0].created_at).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="flex items-start gap-4">
                {news[0].badge_url && <AppImage src={news[0].badge_url} alt="" className="w-12 h-12 object-contain bg-[#060913] rounded-lg p-1.5 border border-gray-800 flex-shrink-0" />}
                {news[0].player_face_url && !news[0].badge_url && <AppImage src={news[0].player_face_url} alt="" className="w-12 h-12 object-cover bg-[#060913] rounded-full border border-gray-800 flex-shrink-0" />}
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-gray-100 leading-tight">{news[0].title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{news[0].content}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Últimas manchetes */}
          {news.length > 1 && (
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Últimas Atualizações</h3>
              {news.slice(1).map((item) => (
                <div key={item.id} className="p-3 rounded-lg border border-gray-800/50 bg-[#060913] hover:border-gray-700 transition-colors flex items-start gap-3">
                  {item.badge_url ? <AppImage src={item.badge_url} alt="" className="w-8 h-8 object-contain bg-black/20 rounded p-1 border border-gray-800 flex-shrink-0" />
                  : item.player_face_url ? <AppImage src={item.player_face_url} alt="" className="w-8 h-8 object-cover bg-black/20 rounded-full border border-gray-800 flex-shrink-0" />
                  : <div className="w-8 h-8 rounded border border-gray-800 bg-black/20 flex items-center justify-center text-sm flex-shrink-0 opacity-70">📰</div>}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-200 leading-snug truncate">{item.title}</p>
                    <p className="text-[10px] text-gray-500 leading-snug line-clamp-2 mt-0.5">{item.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
