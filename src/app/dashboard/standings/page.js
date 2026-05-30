"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function StandingsPage() {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  
  const [activeTab, setActiveTab] = useState("table"); // "table", "scorers", "assists", "motm", "suspensions", "cups"
  
  const [standings, setStandings] = useState([]);
  const [topScorers, setTopScorers] = useState([]);
  const [topAssists, setTopAssists] = useState([]);
  const [topMotm, setTopMotm] = useState([]);
  const [suspensions, setSuspensions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Copas (Mata-Mata)
  const [allCups, setAllCups] = useState([]);
  const [selectedCup, setSelectedCup] = useState("");
  const [cupMatches, setCupMatches] = useState([]);

  useEffect(() => {
    loadSeasons();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      loadLeagues(selectedSeason.id);
      loadCups(selectedSeason.id);
    } else {
      setLeagues([]);
      setSelectedLeague(null);
      setAllCups([]);
      setSelectedCup("");
    }
  }, [selectedSeason]);

  useEffect(() => {
    if (selectedCup && selectedSeason) {
      loadCupMatches(selectedCup, selectedSeason.id);
    } else {
      setCupMatches([]);
    }
  }, [selectedCup, selectedSeason]);

  useEffect(() => {
    if (selectedLeague) {
      loadLeagueData(selectedLeague.id);
    } else {
      setStandings([]);
      setTopScorers([]);
      setTopAssists([]);
      setSuspensions([]);
    }
  }, [selectedLeague]);

  const loadSeasons = async () => {
    const { data, error } = await supabase
      .from("seasons")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSeasons(data);
      if (data.length > 0) setSelectedSeason(data[0]);
    }
  };

  const loadLeagues = async (seasonId) => {
    const { data, error } = await supabase
      .from("leagues")
      .select("*")
      .eq("season_id", seasonId)
      .order("division", { ascending: true });

    if (!error && data) {
      setLeagues(data);
      if (data.length > 0) setSelectedLeague(data[0]);
    }
  };

  const loadCups = async (seasonId) => {
    const { data, error } = await supabase
      .from("matches")
      .select("cup_name")
      .eq("season_id", seasonId)
      .is("league_id", null)
      .not("cup_name", "is", null);

    if (!error && data) {
      const uniqueCups = Array.from(new Set(data.map(m => m.cup_name).filter(Boolean)));
      setAllCups(uniqueCups);
      if (uniqueCups.length > 0) {
        setSelectedCup(uniqueCups[0]);
      } else {
        setSelectedCup("");
      }
    }
  };

  const loadCupMatches = async (cupName, seasonId) => {
    const { data, error } = await supabase
      .from("matches")
      .select("*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)")
      .eq("season_id", seasonId)
      .eq("cup_name", cupName)
      .is("league_id", null)
      .order("round_number", { ascending: true });

    if (!error && data) {
      setCupMatches(data);
    }
  };

  const loadLeagueData = async (leagueId) => {
    setLoading(true);
    try {
      // 1. Tabela de Classificação
      const { data: standingsData, error: stError } = await supabase
        .from("league_teams")
        .select("*, teams(*)")
        .eq("league_id", leagueId)
        .order("points", { ascending: false })
        .order("goals_difference", { ascending: false })
        .order("goals_for", { ascending: false });

      if (!stError && standingsData) {
        setStandings(standingsData);
      }

      // 2. Artilheiros (Gols em partidas confirmadas nesta liga)
      const { data: scorersData, error: scError } = await supabase
        .from("match_events")
        .select(`
          player_id,
          players!player_id(name, common_name, rating, position, face_url),
          teams!team_id(name, real_club_name),
          matches!match_id(league_id, status)
        `)
        .eq("event_type", "goal")
        .eq("matches.league_id", leagueId)
        .eq("matches.status", "confirmed");

      if (!scError && scorersData) {
        // Agrupar e contar no JS para contornar limitações do supabase client client-side aggregations
        const scoresMap = {};
        scorersData.forEach(event => {
          // Filtragem de segurança pois o query no matches traz null se a correspondência falhar
          if (event.matches) {
            const pId = event.player_id;
            if (!scoresMap[pId]) {
              scoresMap[pId] = {
                player: event.players,
                team: event.teams,
                goals: 0
              };
            }
            scoresMap[pId].goals += 1;
          }
        });
        const sortedScorers = Object.values(scoresMap).sort((a, b) => b.goals - a.goals);
        setTopScorers(sortedScorers);
      }

      // 3. Assistências (Em partidas confirmadas nesta liga)
      const { data: assistsData, error: asError } = await supabase
        .from("match_events")
        .select(`
          player_id,
          players!player_id(name, common_name, rating, position, face_url),
          teams!team_id(name, real_club_name),
          matches!match_id(league_id, status)
        `)
        .eq("event_type", "assist")
        .eq("matches.league_id", leagueId)
        .eq("matches.status", "confirmed");

      if (!asError && assistsData) {
        const assistsMap = {};
        assistsData.forEach(event => {
          if (event.matches) {
            const pId = event.player_id;
            if (!assistsMap[pId]) {
              assistsMap[pId] = {
                player: event.players,
                team: event.teams,
                assists: 0
              };
            }
            assistsMap[pId].assists += 1;
          }
        });
        const sortedAssists = Object.values(assistsMap).sort((a, b) => b.assists - a.assists);
        setTopAssists(sortedAssists);
      }

      // 4. Melhor em Campo (MOTM) (Em partidas confirmadas nesta liga)
      const { data: motmData, error: motmError } = await supabase
        .from("matches")
        .select(`
          motm_player_id,
          player:players!motm_player_id(name, common_name, rating, position, face_url, teams!team_id(name, real_club_name))
        `)
        .eq("league_id", leagueId)
        .eq("status", "confirmed")
        .not("motm_player_id", "is", null);

      if (!motmError && motmData) {
        const motmMap = {};
        motmData.forEach(match => {
          if (match.player) {
            const pId = match.motm_player_id;
            if (!motmMap[pId]) {
              motmMap[pId] = {
                player: match.player,
                team: match.player.teams || null,
                motm: 0
              };
            }
            motmMap[pId].motm += 1;
          }
        });
        const sortedMotm = Object.values(motmMap).sort((a, b) => b.motm - a.motm);
        setTopMotm(sortedMotm);
      } else {
        setTopMotm([]);
      }

      // 5. Suspensões Ativas
      const { data: suspensionsData, error: suspError } = await supabase
        .from("suspensions")
        .select(`
          *,
          players!player_id(name, common_name, position, rating),
          matches!match_id(round_number, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name), status)
        `)
        .eq("season_id", selectedSeason.id);

      if (!suspError && suspensionsData) {
        // Filtrar apenas suspensões que apontam para jogos pendentes (não cumpridas ainda)
        const activeSuspensions = suspensionsData.filter(s => !s.matches || s.matches.status === "pending");
        setSuspensions(activeSuspensions);
      }

    } catch (err) {
      console.error("Erro ao carregar dados de classificação:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Classificação & Estatísticas</h1>
          <p className="text-gray-400 text-sm mt-1">Acompanhe a tabela geral, líderes de gols, assistências e suspensões.</p>
        </div>

        {/* Seletores Rápidos de Temporada e Divisão */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <select
            value={selectedSeason?.id || ""}
            onChange={(e) => {
              const season = seasons.find(s => s.id === e.target.value);
              setSelectedSeason(season);
            }}
            className="bg-[#0d1527] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#10b981]"
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={selectedLeague?.id || ""}
            onChange={(e) => {
              const league = leagues.find(l => l.id === e.target.value);
              setSelectedLeague(league);
            }}
            className="bg-[#0d1527] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#10b981]"
            disabled={leagues.length === 0}
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
            {leagues.length === 0 && <option value="">Nenhuma liga</option>}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 gap-2">
        <button
          onClick={() => setActiveTab("table")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
            activeTab === "table"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          📈 Tabela
        </button>
        <button
          onClick={() => setActiveTab("scorers")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
            activeTab === "scorers"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          ⚽ Artilharia
        </button>
        <button
          onClick={() => setActiveTab("assists")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
            activeTab === "assists"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          跑 Assistências
        </button>
        <button
          onClick={() => setActiveTab("motm")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
            activeTab === "motm"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          ⭐ Melhor em Campo
        </button>
        <button
          onClick={() => setActiveTab("suspensions")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "suspensions"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          🟥 Suspensões
          {suspensions.length > 0 && (
            <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
              {suspensions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("cups")}
          className={`px-4 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "cups"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          🏆 Copas Mata-Mata
        </button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-[#090d16]/40 border border-white/5 backdrop-blur-md">
          {/* TAB 1: Tabela de Classificação */}
          {activeTab === "table" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-[10px] font-bold uppercase text-gray-400 border-b border-white/5">
                  <tr>
                    <th className="py-3 px-2 text-center w-12">Pos</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-3 text-center">P</th>
                    <th className="py-3 px-3 text-center">J</th>
                    <th className="py-3 px-3 text-center">V</th>
                    <th className="py-3 px-3 text-center">E</th>
                    <th className="py-3 px-3 text-center">D</th>
                    <th className="py-3 px-3 text-center">GP</th>
                    <th className="py-3 px-3 text-center">GC</th>
                    <th className="py-3 px-3 text-center">SG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs md:text-sm">
                  {standings.map((lt, index) => {
                    const isZoneA = index < 2; // Zonas de promoção simbólicas
                    const isZoneB = index >= standings.length - 2 && standings.length > 4; // Rebaixamento
                    return (
                      <tr key={lt.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-2 text-center font-bold">
                          <span
                            className={`inline-block h-6 w-6 rounded-full leading-6 text-center text-xs ${
                              index === 0
                                ? "bg-amber-400 text-black shadow-lg shadow-amber-400/10"
                                : index === 1
                                ? "bg-slate-300 text-black"
                                : index === 2
                                ? "bg-amber-700 text-white"
                                : "text-gray-400 bg-white/5"
                            }`}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span>🛡️</span>
                            <div>
                              <span>{lt.teams?.name}</span>
                              <span className="block text-[10px] text-gray-400 font-normal">{lt.teams?.real_club_name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-extrabold text-emerald-400">{lt.points}</td>
                        <td className="py-3 px-3 text-center font-medium">{lt.played}</td>
                        <td className="py-3 px-3 text-center text-gray-400">{lt.won}</td>
                        <td className="py-3 px-3 text-center text-gray-400">{lt.drawn}</td>
                        <td className="py-3 px-3 text-center text-gray-400">{lt.lost}</td>
                        <td className="py-3 px-3 text-center text-gray-400">{lt.goals_for}</td>
                        <td className="py-3 px-3 text-center text-gray-400">{lt.goals_against}</td>
                        <td className={`py-3 px-3 text-center font-bold ${lt.goals_difference > 0 ? "text-emerald-400" : lt.goals_difference < 0 ? "text-red-400" : "text-gray-400"}`}>
                          {lt.goals_difference > 0 ? `+${lt.goals_difference}` : lt.goals_difference}
                        </td>
                      </tr>
                    );
                  })}
                  {standings.length === 0 && (
                    <tr>
                      <td colSpan="10" className="py-12 text-center text-gray-500 text-xs">
                        Nenhum time cadastrado nesta liga ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: Artilharia */}
          {activeTab === "scorers" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-[10px] font-bold uppercase text-gray-400 border-b border-white/5">
                  <tr>
                    <th className="py-3 px-2 text-center w-12">Pos</th>
                    <th className="py-3 px-4">Jogador</th>
                    <th className="py-3 px-4">Clube</th>
                    <th className="py-3 px-4 text-center">Gols</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {topScorers.map((item, index) => (
                    <tr key={index} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-2 text-center font-bold text-gray-400">{index + 1}</td>
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-white/5 text-xs flex items-center justify-center font-bold border border-white/10 text-emerald-400">
                            🏃‍♂️
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{item.player?.name}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                              {item.player?.position} - Rating: {item.player?.rating}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        <p className="font-semibold text-gray-200">{item.team?.name}</p>
                        <p className="text-[10px] text-gray-500">{item.team?.real_club_name}</p>
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-emerald-400 text-lg">{item.goals}</td>
                    </tr>
                  ))}
                  {topScorers.length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-gray-500 text-xs">
                        Nenhum gol marcado nesta liga ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: Assistências */}
          {activeTab === "assists" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-[10px] font-bold uppercase text-gray-400 border-b border-white/5">
                  <tr>
                    <th className="py-3 px-2 text-center w-12">Pos</th>
                    <th className="py-3 px-4">Jogador</th>
                    <th className="py-3 px-4">Clube</th>
                    <th className="py-3 px-4 text-center">Assistências</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {topAssists.map((item, index) => (
                    <tr key={index} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-2 text-center font-bold text-gray-400">{index + 1}</td>
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-white/5 text-xs flex items-center justify-center font-bold border border-white/10 text-[#3b82f6]">
                            🏃‍♂️
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{item.player?.name}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                              {item.player?.position} - Rating: {item.player?.rating}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        <p className="font-semibold text-gray-200">{item.team?.name}</p>
                        <p className="text-[10px] text-gray-500">{item.team?.real_club_name}</p>
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-[#3b82f6] text-lg">{item.assists}</td>
                    </tr>
                  ))}
                  {topAssists.length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-gray-500 text-xs">
                        Nenhuma assistência registrada nesta liga ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
               </table>
             </div>
           )}

           {/* TAB: Melhor em Campo (MOTM) */}
           {activeTab === "motm" && (
             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm text-gray-300">
                 <thead className="text-[10px] font-bold uppercase text-gray-400 border-b border-white/5">
                   <tr>
                     <th className="py-3 px-2 text-center w-12">Pos</th>
                     <th className="py-3 px-4">Jogador</th>
                     <th className="py-3 px-4">Clube</th>
                     <th className="py-3 px-4 text-center">Melhor em Campo</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-white/5">
                   {topMotm.map((item, index) => (
                     <tr key={index} className="hover:bg-white/5 transition-colors">
                       <td className="py-3 px-2 text-center font-bold text-gray-400">{index + 1}</td>
                       <td className="py-3 px-4 font-semibold text-white">
                         <div className="flex items-center gap-3">
                           <div className="h-8 w-8 rounded-full bg-white/5 text-xs flex items-center justify-center font-bold border border-white/10 text-amber-400">
                             ⭐
                           </div>
                           <div>
                             <p className="text-sm font-bold text-white">{item.player?.name}</p>
                             <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                               {item.player?.position} - Rating: {item.player?.rating}
                             </p>
                           </div>
                         </div>
                       </td>
                       <td className="py-3 px-4 text-gray-400 text-sm">
                         <p className="font-semibold text-gray-200">{item.team?.name || "Sem Clube"}</p>
                         <p className="text-[10px] text-gray-500">{item.team?.real_club_name || "—"}</p>
                       </td>
                       <td className="py-3 px-4 text-center font-extrabold text-amber-400 text-lg">{item.motm}</td>
                     </tr>
                   ))}
                   {topMotm.length === 0 && (
                     <tr>
                       <td colSpan="4" className="py-12 text-center text-gray-500 text-xs">
                         Nenhum jogador eleito Melhor em Campo nesta liga ainda.
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
           )}

          {/* TAB 4: Suspensões */}
          {activeTab === "suspensions" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-[10px] font-bold uppercase text-gray-400 border-b border-white/5">
                  <tr>
                    <th className="py-3 px-4">Jogador Suspenso</th>
                    <th className="py-3 px-4">Motivo</th>
                    <th className="py-3 px-4">Cumprimento na Partida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {suspensions.map((susp) => (
                    <tr key={susp.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                           <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                          <div>
                            <p className="text-sm font-bold text-white">{susp.players?.name}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                              {susp.players?.position} - Rating: {susp.players?.rating}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {susp.reason === "red_card" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full border border-red-500/20 font-semibold">
                            🟥 Cartão Vermelho Direto
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 font-semibold">
                            🟨 Acúmulo de 3 Amarelos
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-gray-400">
                        {susp.matches ? (
                          <div>
                            <p className="font-bold text-gray-300">Rodada {susp.matches.round_number}</p>
                            <p className="text-[10px] text-gray-500">
                              {susp.matches.home_team?.name} x {susp.matches.away_team?.name}
                            </p>
                          </div>
                        ) : (
                          <span className="italic text-gray-500">Próximo compromisso oficial</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {suspensions.length === 0 && (
                    <tr>
                      <td colSpan="3" className="py-12 text-center text-gray-500 text-xs">
                        Nenhum jogador suspenso no momento. Fair play nota 10! 😇
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 5: Copas Mata-Mata (Bracket Visual) */}
          {activeTab === "cups" && (
            <div className="space-y-6">
              {/* Seleção de Copa */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0d1527]/30 p-4 rounded-xl border border-white/5">
                <div>
                  <h3 className="text-sm font-bold text-white">Chaveamento da Copa</h3>
                  <p className="text-xs text-gray-400">Selecione a copa ativa para visualizar a árvore do torneio.</p>
                </div>
                <select
                  value={selectedCup}
                  onChange={(e) => setSelectedCup(e.target.value)}
                  className="bg-[#0d1527] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#10b981] w-full sm:w-auto min-w-[200px]"
                  disabled={allCups.length === 0}
                >
                  {allCups.map((cup) => (
                    <option key={cup} value={cup}>
                      {cup}
                    </option>
                  ))}
                  {allCups.length === 0 && <option value="">Nenhuma copa criada</option>}
                </select>
              </div>

              {selectedCup ? (
                <div className="overflow-x-auto pb-4 pt-2">
                  <div className="flex flex-row justify-center items-center gap-12 min-w-[800px] py-4">
                    {/* Quartas de Final */}
                    {cupMatches.some(m => m.round_number === 1) && (
                      <div className="flex flex-col justify-between gap-6 h-[520px] w-[260px]">
                        <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2">
                          Quartas de Final
                        </div>
                        <div className="flex flex-col justify-between h-full py-4 gap-4">
                          {cupMatches.filter(m => m.round_number === 1).map((m) => {
                            const isHomeWinner = m.status === "confirmed" && m.home_score > m.away_score;
                            const isAwayWinner = m.status === "confirmed" && m.away_score > m.home_score;
                            return (
                              <div
                                key={m.id}
                                className="p-3 rounded-xl bg-[#0b0f19] border border-white/5 hover:border-emerald-500/30 transition-all flex flex-col gap-2 relative overflow-hidden shadow-lg shadow-black/20"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 truncate">
                                    {m.home_team?.badge_url ? (
                                      <img src={m.home_team.badge_url} alt="" className="w-5 h-5 object-contain" />
                                    ) : (
                                      <span className="text-xs">🛡️</span>
                                    )}
                                    <span className={`text-xs font-semibold truncate ${m.status === "confirmed" && !isHomeWinner ? "text-gray-500" : "text-gray-200"}`}>
                                      {m.home_team?.name || "A definir"}
                                    </span>
                                  </div>
                                  {m.status === "confirmed" ? (
                                    <span className={`text-xs font-extrabold ${isHomeWinner ? "text-emerald-400" : "text-gray-500"}`}>
                                      {m.home_score}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-600 font-bold">-</span>
                                  )}
                                </div>
                                <div className="border-t border-white/5 my-0.5"></div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 truncate">
                                    {m.away_team?.badge_url ? (
                                      <img src={m.away_team.badge_url} alt="" className="w-5 h-5 object-contain" />
                                    ) : (
                                      <span className="text-xs">🛡️</span>
                                    )}
                                    <span className={`text-xs font-semibold truncate ${m.status === "confirmed" && !isAwayWinner ? "text-gray-500" : "text-gray-200"}`}>
                                      {m.away_team?.name || "A definir"}
                                    </span>
                                  </div>
                                  {m.status === "confirmed" ? (
                                    <span className={`text-xs font-extrabold ${isAwayWinner ? "text-emerald-400" : "text-gray-500"}`}>
                                      {m.away_score}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-600 font-bold">-</span>
                                  )}
                                </div>
                                {m.status === "pending" && <div className="absolute top-0 right-0 h-1 w-full bg-blue-500/30"></div>}
                                {m.status === "dispute" && <div className="absolute top-0 right-0 h-1 w-full bg-red-500 animate-pulse"></div>}
                                {m.status === "confirmed" && <div className="absolute top-0 right-0 h-1 w-full bg-emerald-500/50"></div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Semifinais */}
                    {cupMatches.some(m => m.round_number === 2) && (
                      <div className="flex flex-col justify-between gap-6 h-[520px] w-[260px]">
                        <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2">
                          Semifinais
                        </div>
                        <div className="flex flex-col justify-around h-full py-8 gap-8">
                          {cupMatches.filter(m => m.round_number === 2).map((m) => {
                            const isHomeWinner = m.status === "confirmed" && m.home_score > m.away_score;
                            const isAwayWinner = m.status === "confirmed" && m.away_score > m.home_score;
                            return (
                              <div
                                key={m.id}
                                className="p-3 rounded-xl bg-[#0b0f19] border border-white/5 hover:border-emerald-500/30 transition-all flex flex-col gap-2 relative overflow-hidden shadow-lg shadow-black/20"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 truncate">
                                    {m.home_team?.badge_url ? (
                                      <img src={m.home_team.badge_url} alt="" className="w-5 h-5 object-contain" />
                                    ) : (
                                      <span className="text-xs">🛡️</span>
                                    )}
                                    <span className={`text-xs font-semibold truncate ${m.status === "confirmed" && !isHomeWinner ? "text-gray-500" : "text-gray-200"}`}>
                                      {m.home_team?.name || "A definir"}
                                    </span>
                                  </div>
                                  {m.status === "confirmed" ? (
                                    <span className={`text-xs font-extrabold ${isHomeWinner ? "text-emerald-400" : "text-gray-500"}`}>
                                      {m.home_score}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-600 font-bold">-</span>
                                  )}
                                </div>
                                <div className="border-t border-white/5 my-0.5"></div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 truncate">
                                    {m.away_team?.badge_url ? (
                                      <img src={m.away_team.badge_url} alt="" className="w-5 h-5 object-contain" />
                                    ) : (
                                      <span className="text-xs">🛡️</span>
                                    )}
                                    <span className={`text-xs font-semibold truncate ${m.status === "confirmed" && !isAwayWinner ? "text-gray-500" : "text-gray-200"}`}>
                                      {m.away_team?.name || "A definir"}
                                    </span>
                                  </div>
                                  {m.status === "confirmed" ? (
                                    <span className={`text-xs font-extrabold ${isAwayWinner ? "text-emerald-400" : "text-gray-500"}`}>
                                      {m.away_score}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-600 font-bold">-</span>
                                  )}
                                </div>
                                {m.status === "pending" && <div className="absolute top-0 right-0 h-1 w-full bg-blue-500/30"></div>}
                                {m.status === "dispute" && <div className="absolute top-0 right-0 h-1 w-full bg-red-500 animate-pulse"></div>}
                                {m.status === "confirmed" && <div className="absolute top-0 right-0 h-1 w-full bg-emerald-500/50"></div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Grande Final */}
                    {cupMatches.some(m => m.round_number === 3) && (
                      <div className="flex flex-col justify-between gap-6 h-[520px] w-[260px]">
                        <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/5 pb-2">
                          Grande Final
                        </div>
                        <div className="flex flex-col justify-center h-full">
                          {cupMatches.filter(m => m.round_number === 3).map((m) => {
                            const isHomeWinner = m.status === "confirmed" && m.home_score > m.away_score;
                            const isAwayWinner = m.status === "confirmed" && m.away_score > m.home_score;
                            return (
                              <div
                                key={m.id}
                                className="p-3 rounded-xl bg-gradient-to-br from-[#1b233a] to-[#0b0f19] border border-amber-500/30 hover:border-amber-500/50 transition-all flex flex-col gap-2 relative overflow-hidden shadow-xl shadow-amber-500/5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 truncate">
                                    {m.home_team?.badge_url ? (
                                      <img src={m.home_team.badge_url} alt="" className="w-5 h-5 object-contain" />
                                    ) : (
                                      <span className="text-xs">🛡️</span>
                                    )}
                                    <span className={`text-xs font-semibold truncate ${m.status === "confirmed" && !isHomeWinner ? "text-gray-500" : "text-gray-200"}`}>
                                      {m.home_team?.name || "A definir"}
                                    </span>
                                  </div>
                                  {m.status === "confirmed" ? (
                                    <span className={`text-xs font-extrabold ${isHomeWinner ? "text-amber-400" : "text-gray-500"}`}>
                                      {m.home_score}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-600 font-bold">-</span>
                                  )}
                                </div>
                                <div className="border-t border-white/5 my-0.5"></div>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 truncate">
                                    {m.away_team?.badge_url ? (
                                      <img src={m.away_team.badge_url} alt="" className="w-5 h-5 object-contain" />
                                    ) : (
                                      <span className="text-xs">🛡️</span>
                                    )}
                                    <span className={`text-xs font-semibold truncate ${m.status === "confirmed" && !isAwayWinner ? "text-gray-500" : "text-gray-200"}`}>
                                      {m.away_team?.name || "A definir"}
                                    </span>
                                  </div>
                                  {m.status === "confirmed" ? (
                                    <span className={`text-xs font-extrabold ${isAwayWinner ? "text-amber-400" : "text-gray-500"}`}>
                                      {m.away_score}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-gray-600 font-bold">-</span>
                                  )}
                                </div>
                                {m.status === "pending" && <div className="absolute top-0 right-0 h-1 w-full bg-amber-500/30"></div>}
                                {m.status === "dispute" && <div className="absolute top-0 right-0 h-1 w-full bg-red-500 animate-pulse"></div>}
                                {m.status === "confirmed" && <div className="absolute top-0 right-0 h-1 w-full bg-amber-500"></div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-500 text-xs border border-dashed border-white/5 rounded-2xl bg-[#090d16]/20">
                  <span className="text-3xl block mb-2">🏆</span>
                  Nenhuma copa mata-mata ativa nesta temporada.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
