import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";

export default function NextMatchBanner({ nextMatch, myTeamId }) {
  if (!nextMatch) {
    return (
      <Card className="bg-gradient-to-r from-emerald-900/20 to-[#060913] border-emerald-900/30">
        <CardContent className="p-6 md:p-8 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-200">Temporada Livre</h3>
            <p className="text-sm text-gray-500 mt-1">Nenhum confronto oficial pendente de reporte no momento.</p>
          </div>
          <span className="text-4xl opacity-50 grayscale">⚽</span>
        </CardContent>
      </Card>
    );
  }

  const isHome = nextMatch.home_team_id === myTeamId;
  const opponent = isHome ? nextMatch.away_team : nextMatch.home_team;
  
  return (
    <Card className="bg-gradient-to-r from-blue-900/20 to-[#060913] border-blue-900/30 relative overflow-hidden">
      <div className="absolute -right-10 -top-10 text-9xl opacity-5">⚽</div>
      <CardContent className="p-6 md:p-8 relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="inline-block px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 mb-3">
            Próximo Jogo Oficial
          </span>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <span className={isHome ? "text-emerald-400" : "text-gray-400"}>
              {isHome ? "Seu Clube" : opponent.name}
            </span>
            <span className="text-lg text-gray-600">x</span>
            <span className={!isHome ? "text-emerald-400" : "text-gray-400"}>
              {!isHome ? "Seu Clube" : opponent.name}
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-2 font-semibold">
            {nextMatch.seasons?.name || "Temporada Atual"} • Rodada {nextMatch.round_number}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Link href="/dashboard/matches" className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-blue-500/50 bg-blue-600 px-4 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:w-auto">
            <span>Ir para a partida</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
