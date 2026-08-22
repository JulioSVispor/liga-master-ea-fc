"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AppImage } from "@/components/ui/AppImage";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function MatchRoomPage() {
  const { id } = useParams();
  const router = useRouter();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMatch() {
      if (!id) return;
      try {
        const { data: matchData, error } = await supabase
          .from("matches")
          .select(`
            *,
            home_team:teams!home_team_id(*),
            away_team:teams!away_team_id(*)
          `)
          .eq("id", id)
          .single();

        if (error) throw error;
        setMatch(matchData);
      } catch (err) {
        console.error("Erro ao carregar partida:", err);
      } finally {
        setLoading(false);
      }
    }
    loadMatch();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-16 text-gray-500">
        Partida não encontrada.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fadeIn">
      {/* Header / Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="secondary" onClick={() => router.push("/dashboard")} className="text-xs px-3 h-8">
          ← Voltar
        </Button>
        <span className="text-sm font-bold text-gray-400">Match Room (Beta)</span>
      </div>

      {/* Match Banner */}
      <Card className="bg-gradient-to-br from-[#0a1128] to-[#050914] border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/pitch-bg.svg')] bg-cover bg-center opacity-10"></div>
        <CardContent className="p-10 relative z-10 flex flex-col items-center text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#10b981] bg-[#10b981]/10 px-3 py-1 rounded-full mb-6">
            Rodada {match.round_number}
          </span>
          
          <div className="flex items-center justify-center w-full gap-8 md:gap-16">
            {/* Home Team */}
            <div className="flex flex-col items-center gap-4 flex-1">
              <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-2">
                {match.home_team?.badge_url ? (
                  <AppImage src={match.home_team.badge_url} alt={match.home_team.name} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-4xl">🛡️</span>
                )}
              </div>
              <h2 className="text-lg md:text-2xl font-black text-white">{match.home_team?.name}</h2>
            </div>

            {/* Score / VS */}
            <div className="flex flex-col items-center">
              <div className="text-3xl md:text-5xl font-black text-white bg-black/50 px-6 py-3 rounded-2xl border border-white/10 backdrop-blur-md">
                {match.status === "confirmed" ? (
                  `${match.home_score} - ${match.away_score}`
                ) : (
                  <span className="text-gray-500">VS</span>
                )}
              </div>
              <span className="mt-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                {match.status === "confirmed" ? "Finalizado" : "Pendente"}
              </span>
            </div>

            {/* Away Team */}
            <div className="flex flex-col items-center gap-4 flex-1">
              <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-2">
                {match.away_team?.badge_url ? (
                  <AppImage src={match.away_team.badge_url} alt={match.away_team.name} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-4xl">🛡️</span>
                )}
              </div>
              <h2 className="text-lg md:text-2xl font-black text-white">{match.away_team?.name}</h2>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Match Room Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Card className="bg-[#090d16] border-white/5">
          <CardContent className="p-8 text-center">
            <span className="text-4xl block mb-4">📋</span>
            <h3 className="text-lg font-bold text-white mb-2">Ficha Técnica</h3>
            <p className="text-sm text-gray-400 mb-6">Reporte os gols, assistências, cartões e o Melhor em Campo.</p>
            <Button variant="primary" className="w-full bg-[#10b981] hover:bg-emerald-600 border-none" onClick={() => router.push("/dashboard/matches")}>
              Reportar Resultado
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#090d16] border-white/5 opacity-50 relative overflow-hidden group">
          <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 border border-emerald-400/50 bg-emerald-900/30 px-3 py-1.5 rounded-full">
              Em Breve
            </span>
          </div>
          <CardContent className="p-8 text-center relative z-0">
            <span className="text-4xl block mb-4">💬</span>
            <h3 className="text-lg font-bold text-white mb-2">Chat da Partida</h3>
            <p className="text-sm text-gray-400 mb-6">Combine o horário do jogo diretamente com seu adversário.</p>
            <Button variant="secondary" className="w-full" disabled>
              Abrir Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
