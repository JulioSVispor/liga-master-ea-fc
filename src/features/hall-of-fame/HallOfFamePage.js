"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function HallOfFamePage() {
  const [loading, setLoading] = useState(true);
  const [achievements, setAchievements] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch all achievements (Titles)
        const { data: achData } = await supabase
          .from("achievements")
          .select("*, teams(id, name, badge_url, profiles(display_name))")
          .order("created_at", { ascending: false });
        
        if (achData) setAchievements(achData);

        // Fetch team statistics for Leaderboard
        const { data: matchData } = await supabase
          .from("matches")
          .select("home_team_id, away_team_id, home_score, away_score, status")
          .eq("status", "completed");

        if (matchData) {
          // Calculate win rates
          const stats = {};
          
          const getOrCreateStats = (teamId) => {
            if (!stats[teamId]) {
              stats[teamId] = { matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
            }
            return stats[teamId];
          };

          matchData.forEach(match => {
            const home = getOrCreateStats(match.home_team_id);
            const away = getOrCreateStats(match.away_team_id);
            
            home.matches += 1;
            away.matches += 1;
            
            home.goalsFor += match.home_score;
            home.goalsAgainst += match.away_score;
            
            away.goalsFor += match.away_score;
            away.goalsAgainst += match.home_score;
            
            if (match.home_score > match.away_score) {
              home.wins += 1;
              home.points += 3;
              away.losses += 1;
            } else if (match.home_score < match.away_score) {
              away.wins += 1;
              away.points += 3;
              home.losses += 1;
            } else {
              home.draws += 1;
              home.points += 1;
              away.draws += 1;
              away.points += 1;
            }
          });

          // Fetch team details for the leaderboard
          const teamIds = Object.keys(stats);
          if (teamIds.length > 0) {
            const { data: teamsData } = await supabase
              .from("teams")
              .select("id, name, badge_url, profiles(display_name)")
              .in("id", teamIds);
              
            if (teamsData) {
              const finalLeaderboard = teamsData.map(t => {
                const s = stats[t.id];
                const winRate = s.matches > 0 ? ((s.wins / s.matches) * 100).toFixed(1) : 0;
                return {
                  ...t,
                  ...s,
                  winRate: parseFloat(winRate)
                };
              });
              
              // Sort by Points, then Win Rate, then Goal Difference
              finalLeaderboard.sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.winRate !== a.winRate) return b.winRate - a.winRate;
                const aGD = a.goalsFor - a.goalsAgainst;
                const bGD = b.goalsFor - b.goalsAgainst;
                return bGD - aGD;
              });
              
              setLeaderboard(finalLeaderboard);
            }
          }
        }
      } catch (error) {
        console.error("Error loading Hall of Fame:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-6xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col items-center justify-center text-center py-10">
        <div className="h-20 w-20 bg-amber-500/10 rounded-full border border-amber-500/20 flex items-center justify-center text-4xl mb-4 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
          🏛️
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          Hall da Fama
        </h1>
        <p className="mt-2 text-sm text-gray-400 max-w-xl">
          O panteão dos imortais. Aqui estão registrados para sempre os grandes campeões e os treinadores mais consistentes da história da nossa Liga Master.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Trophies & Achievements (Takes up 1/3) */}
        <div className="space-y-6 lg:col-span-1">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#090d16]/75 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-yellow-300"></div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
              <span>🏆</span> Galeria de Campeões
            </h2>
            
            {achievements.length === 0 ? (
              <div className="text-center py-10 bg-white/[0.01] rounded-xl border border-dashed border-white/10">
                <p className="text-xs text-gray-500">Nenhum título registrado ainda.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {achievements.map((ach) => (
                  <div key={ach.id} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex items-center gap-4 group hover:bg-white/[0.04] transition-colors">
                    <div className="h-12 w-12 rounded-full bg-[#060913] border border-white/10 flex flex-shrink-0 items-center justify-center p-2">
                      <img src={ach.teams?.badge_url || "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/300px-No_image_available.svg.png"} alt="" className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/dashboard/teams/${ach.teams?.id}`}>
                        <h4 className="text-sm font-bold text-amber-400 truncate hover:underline cursor-pointer">
                          {ach.title}
                        </h4>
                      </Link>
                      <p className="text-xs text-white truncate">{ach.teams?.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{ach.season_name} • {ach.teams?.profiles?.display_name}</p>
                    </div>
                    <div className="text-2xl opacity-50 group-hover:opacity-100 transition-opacity group-hover:scale-110 transform">
                      {ach.icon || "🏅"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Historical Leaderboard (Takes up 2/3) */}
        <div className="space-y-6 lg:col-span-2">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#090d16]/75 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-300"></div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <span>📈</span> Ranking Histórico (All-Time)
            </h2>
            <p className="text-xs text-gray-400 mb-6">Classificação geral de todos os técnicos somando todas as temporadas oficiais jogadas.</p>
            
            {leaderboard.length === 0 ? (
              <div className="text-center py-10 bg-white/[0.01] rounded-xl border border-dashed border-white/10">
                <p className="text-xs text-gray-500">Nenhuma partida oficial registrada para calcular o ranking.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300 border-collapse">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5 bg-white/[0.02]">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Treinador / Clube</th>
                      <th className="py-3 px-4 text-center">Pts</th>
                      <th className="py-3 px-4 text-center">J</th>
                      <th className="py-3 px-4 text-center">V</th>
                      <th className="py-3 px-4 text-center">E</th>
                      <th className="py-3 px-4 text-center">D</th>
                      <th className="py-3 px-4 text-center">SG</th>
                      <th className="py-3 px-4 text-right">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {leaderboard.map((team, idx) => (
                      <tr key={team.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-4 text-center">
                          <span className={`text-xs font-black ${
                            idx === 0 ? "text-amber-400" :
                            idx === 1 ? "text-gray-300" :
                            idx === 2 ? "text-amber-700" :
                            "text-gray-600"
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Link href={`/dashboard/teams/${team.id}`}>
                            <div className="flex items-center gap-3 cursor-pointer group">
                              <div className="h-8 w-8 rounded-full bg-[#060913] border border-white/10 flex items-center justify-center p-1.5 group-hover:border-blue-500 transition-colors">
                                <img src={team.badge_url || "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/300px-No_image_available.svg.png"} alt="" className="max-w-full max-h-full object-contain" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{team.profiles?.display_name || "Treinador Desconhecido"}</h4>
                                <p className="text-[10px] text-gray-500">{team.name}</p>
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-center font-black text-blue-400">{team.points}</td>
                        <td className="py-3 px-4 text-center font-semibold text-gray-400">{team.matches}</td>
                        <td className="py-3 px-4 text-center text-emerald-400">{team.wins}</td>
                        <td className="py-3 px-4 text-center text-gray-500">{team.draws}</td>
                        <td className="py-3 px-4 text-center text-red-400">{team.losses}</td>
                        <td className="py-3 px-4 text-center text-gray-400">
                          {(team.goalsFor - team.goalsAgainst) > 0 ? `+${team.goalsFor - team.goalsAgainst}` : team.goalsFor - team.goalsAgainst}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-white">{team.winRate}%</span>
                            <div className="w-16 h-1.5 bg-white/5 rounded-full mt-1 overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  team.winRate >= 60 ? "bg-emerald-500" :
                                  team.winRate >= 40 ? "bg-amber-500" :
                                  "bg-red-500"
                                }`} 
                                style={{ width: `${Math.min(team.winRate, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
