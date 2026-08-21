"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import PlayerProfileModal from "@/features/dashboard/components/PlayerProfileModal";

export default function PublicTeamProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;

  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(null);
  const [stats, setStats] = useState({ matches: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, winRate: 0 });
  const [achievements, setAchievements] = useState([]);
  const [squad, setSquad] = useState([]);

  // Perfil do Jogador
  const [selectedPlayerForProfile, setSelectedPlayerForProfile] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const openPlayerProfile = async (player) => {
    setSelectedPlayerForProfile(player);
    setStatsLoading(true);
    try {
      const { data, error } = await supabase
        .from("player_stats")
        .select("*, seasons(name)")
        .eq("player_id", player.id);
      
      if (!error && data) {
        setPlayerStats(data.map(d => ({ ...d, season_name: d.seasons?.name })));
      } else {
        setPlayerStats([]);
      }
    } catch (e) {
      setPlayerStats([]);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        // Load Team and Profile (Manager)
        const { data: teamData, error: teamErr } = await supabase
          .from("teams")
          .select("*, profiles(display_name, created_at)")
          .eq("id", id)
          .single();

        if (teamErr || !teamData) {
          router.push("/dashboard/hall-of-fame");
          return;
        }
        setTeam(teamData);

        // Load Squad
        const { data: squadData } = await supabase
          .from("players")
          .select("*")
          .eq("team_id", id)
          .order("rating", { ascending: false });
        if (squadData) setSquad(squadData);

        // Load Achievements
        const { data: achData } = await supabase
          .from("achievements")
          .select("*")
          .eq("team_id", id)
          .order("created_at", { ascending: false });
        if (achData) setAchievements(achData);

        // Load Matches for All-Time Stats
        const { data: matches } = await supabase
          .from("matches")
          .select("home_team_id, away_team_id, home_score, away_score")
          .eq("status", "completed")
          .or(`home_team_id.eq.${id},away_team_id.eq.${id}`);

        if (matches) {
          let w = 0, d = 0, l = 0, gf = 0, ga = 0;
          matches.forEach(m => {
            const isHome = m.home_team_id === id;
            const myScore = isHome ? m.home_score : m.away_score;
            const theirScore = isHome ? m.away_score : m.home_score;
            
            gf += myScore;
            ga += theirScore;

            if (myScore > theirScore) w++;
            else if (myScore === theirScore) d++;
            else l++;
          });
          
          const totalMatches = w + d + l;
          const winRate = totalMatches > 0 ? ((w / totalMatches) * 100).toFixed(1) : 0;
          
          setStats({ matches: totalMatches, wins: w, draws: d, losses: l, goalsFor: gf, goalsAgainst: ga, winRate });
        }
      } catch (err) {
        console.error("Error loading team profile:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
      </div>
    );
  }

  if (!team) return null;

  const joinDate = new Date(team.profiles?.created_at || team.created_at).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <Link href="/dashboard/hall-of-fame" className="inline-flex items-center text-xs text-gray-400 hover:text-white transition-colors mb-2">
        <span className="mr-1">←</span> Voltar para Hall da Fama
      </Link>

      {/* Profile Header (Steam/LinkedIn Style) */}
      <div className="glass-panel rounded-2xl border border-white/5 bg-[#090d16]/75 relative overflow-hidden">
        {/* Cover Background */}
        <div className="h-32 w-full bg-gradient-to-r from-blue-900/50 via-emerald-900/50 to-purple-900/50 absolute top-0 left-0 opacity-50 z-0"></div>
        <div className="absolute top-0 left-0 w-full h-32 backdrop-blur-3xl z-0" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")', opacity: 0.1 }}></div>
        
        <div className="relative z-10 pt-16 px-8 pb-8 flex flex-col md:flex-row items-start md:items-end gap-6">
          <div className="h-32 w-32 rounded-2xl bg-[#060913] border-4 border-[#090d16] flex items-center justify-center shadow-2xl p-2 overflow-hidden flex-shrink-0">
            <img src={team.badge_url || "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/No_image_available.svg/300px-No_image_available.svg.png"} alt="Escudo" className="max-w-full max-h-full object-contain" />
          </div>
          
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-black text-white">{team.profiles?.display_name || "Treinador"}</h1>
            <p className="text-sm font-semibold text-gray-400 mt-1 uppercase tracking-wider">{team.name} <span className="lowercase text-gray-600 font-normal">({team.real_club_name})</span></p>
            <div className="flex items-center gap-4 mt-4 text-[10px] uppercase font-bold text-gray-500">
              <span className="flex items-center gap-1"><span>📆</span> Na liga desde {joinDate}</span>
              <span className="flex items-center gap-1"><span>🏆</span> {achievements.length} Títulos</span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 min-w-[120px] text-center backdrop-blur-md">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Win Rate</span>
            <span className={`text-2xl font-black ${
              stats.winRate >= 60 ? "text-emerald-400" :
              stats.winRate >= 40 ? "text-amber-400" :
              "text-red-400"
            }`}>
              {stats.winRate}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Stats & Achievements) */}
        <div className="space-y-6 lg:col-span-1">
          {/* Stats Overview */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#090d16]/75">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span>📊</span> Histórico de Partidas
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">Jogos</span>
                <span className="text-lg font-black text-white">{stats.matches}</span>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-0.5">Saldo</span>
                <span className="text-lg font-black text-gray-300">{(stats.goalsFor - stats.goalsAgainst) > 0 ? `+${stats.goalsFor - stats.goalsAgainst}` : stats.goalsFor - stats.goalsAgainst}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Vitórias</span>
                <span className="font-bold text-emerald-400">{stats.wins}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Empates</span>
                <span className="font-bold text-gray-500">{stats.draws}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Derrotas</span>
                <span className="font-bold text-red-400">{stats.losses}</span>
              </div>
              <div className="pt-2 border-t border-white/5 mt-2 flex justify-between items-center text-[10px] text-gray-500">
                <span>Gols Pro: {stats.goalsFor}</span>
                <span>Gols Contra: {stats.goalsAgainst}</span>
              </div>
            </div>
          </div>

          {/* Achievements */}
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#090d16]/75">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span>🏆</span> Sala de Troféus
            </h3>
            
            {achievements.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4 bg-white/[0.02] rounded-xl border border-dashed border-white/5">Nenhum título.</p>
            ) : (
              <div className="space-y-3">
                {achievements.map(ach => (
                  <div key={ach.id} className="flex items-center gap-3 bg-white/[0.02] p-3 rounded-xl border border-amber-500/10">
                    <div className="text-2xl">{ach.icon || "🏅"}</div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-400 leading-tight">{ach.title}</h4>
                      <p className="text-[10px] text-gray-500">{ach.season_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Squad) */}
        <div className="space-y-6 lg:col-span-2">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#090d16]/75">
            <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
              <span>📋</span> Elenco Atual
            </h3>

            {squad.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-10 bg-white/[0.02] rounded-xl border border-dashed border-white/5">Sem jogadores no elenco.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300 border-collapse">
                  <thead>
                    <tr className="text-[9px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5 bg-white/[0.02]">
                      <th className="py-3 px-4">Jogador</th>
                      <th className="py-3 px-4 text-center">Posição</th>
                      <th className="py-3 px-4 text-center">OVR</th>
                      <th className="py-3 px-4 text-center">Idade</th>
                      <th className="py-3 px-4 text-right">Salário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {squad.map((player) => (
                      <tr key={player.id} className="hover:bg-white/[0.03] transition-colors cursor-pointer group" onClick={() => openPlayerProfile(player)}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-[#060913] border border-white/10 flex flex-shrink-0 items-center justify-center overflow-hidden">
                              {player.face_url ? (
                                <img src={player.face_url} alt="" className="h-full w-full object-cover scale-110" />
                              ) : (
                                <span>👤</span>
                              )}
                            </div>
                            <span className="font-bold text-white text-xs group-hover:text-[#10b981] transition-colors">{player.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{player.position}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-black text-emerald-400">{player.rating}</td>
                        <td className="py-3 px-4 text-center text-xs text-gray-400">{player.age || "--"}</td>
                        <td className="py-3 px-4 text-right text-xs font-semibold text-gray-300">R$ {parseFloat(player.wage).toLocaleString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <PlayerProfileModal
        isOpen={!!selectedPlayerForProfile}
        onClose={() => setSelectedPlayerForProfile(null)}
        player={selectedPlayerForProfile}
        stats={playerStats}
        loading={statsLoading}
      />
    </div>
  );
}
