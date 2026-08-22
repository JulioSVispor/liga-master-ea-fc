"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AppImage } from "@/components/ui/AppImage";
import { useDeferredEffect } from "@/hooks/useDeferredEffect";
import LineupEditor from "./components/LineupEditor";
import StatsCards from "./components/StatsCards";
import NextMatchBanner from "./components/NextMatchBanner";
import InboxTasks from "./components/InboxTasks";
import SalaryModal from "./components/SalaryModal";
import AuctionModal from "./components/AuctionModal";
import PlayerProfileModal from "./components/PlayerProfileModal";
// ─── Tooltip ℹ️ ─────────────────────────────────
function Tooltip({ content }) {
  const [visible, setVisible] = useState(false);
  return (
    <span 
      className="relative inline-block ml-1 cursor-pointer group text-gray-500 hover:text-white select-none"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      ℹ️
      {visible && (
        <span className="absolute z-[100] w-56 p-3 text-[10px] font-normal text-gray-200 bg-[#0c101d] border border-white/10 rounded-xl shadow-2xl top-6 left-1/2 -translate-x-1/2 leading-relaxed transition-opacity animate-fadeIn normal-case whitespace-normal">
          {content}
        </span>
      )}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [settings, setSettings] = useState({});

  // Cockpit (Next Match / Inbox)
  const [nextMatch, setNextMatch] = useState(null);
  const [inboxTasks, setInboxTasks] = useState([]);

  // Modais
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [selectedPlayerForSalary, setSelectedPlayerForSalary] = useState(null);
  const [newSalary, setNewSalary] = useState("");
  const [salaryError, setSalaryError] = useState("");
  const [salarySuccess, setSalarySuccess] = useState("");
  const [savingSalary, setSavingSalary] = useState(false);

  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [selectedPlayerForAuction, setSelectedPlayerForAuction] = useState(null);
  const [auctionError, setAuctionError] = useState("");
  const [auctionSuccess, setAuctionSuccess] = useState("");
  const [savingAuction, setSavingAuction] = useState(false);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedPlayerForProfile, setSelectedPlayerForProfile] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);

  const [uploadingShield, setUploadingShield] = useState(false);
  const [shieldAlert, setShieldAlert] = useState(null);

  const triggerShieldAlert = (type, message) => {
    setShieldAlert({ type, message });
    setTimeout(() => setShieldAlert(null), 5000);
  };

  const loadSettings = async () => {
    const { data } = await supabase.from("settings").select("key, value");
    if (data) {
      const map = {};
      data.forEach((s) => (map[s.key] = s.value));
      setSettings(map);
    }
  };

  const loadClubData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: teamData } = await supabase
        .from("teams")
        .select("id, name, real_club_name, badge_url, budget, max_wage_cap, formation, lineup")
        .eq("user_id", session.user.id)
        .single();

      if (teamData) {
        setTeam(teamData);
        const { data: squad } = await supabase
          .from("players")
          .select("id, name, common_name, rating, potential, position, face_url, wage, value, nation, age, playstyles, playstyles_plus")
          .eq("team_id", teamData.id)
          .order("rating", { ascending: false });
        setPlayers(squad || []);

        // Buscar partidas para extrair o Cockpit
        const { data: matchesData } = await supabase
          .from("matches")
          .select(`
            *,
            home_team:teams!home_team_id(*),
            away_team:teams!away_team_id(*),
            seasons!season_id(name)
          `)
          .or(`home_team_id.eq.${teamData.id},away_team_id.eq.${teamData.id}`)
          .order("round_number", { ascending: true });

        if (matchesData) {
          const pendingUnreported = matchesData.filter(m => m.status === "pending" && !m.reported_by);
          setNextMatch(pendingUnreported.length > 0 ? pendingUnreported[0] : null);

          const tasks = [];
          const pendingHandshakes = matchesData.filter(m => m.status === "pending" && m.reported_by && m.reported_by !== session.user.id);
          pendingHandshakes.forEach(m => {
            const isHome = m.home_team_id === teamData.id;
            const opp = isHome ? m.away_team : m.home_team;
            tasks.push({
              id: `handshake-${m.id}`,
              type: "urgent",
              title: "Validação de Placar",
              description: `Adversário (${opp.name}) reportou o placar da Rodada ${m.round_number}. Aguardando sua confirmação.`,
              icon: "🤝",
              href: "/dashboard/matches",
              actionText: "Validar"
            });
          });

          // Se estiver acima do teto salarial, gerar uma task urgente
          const wageSum = (squad || []).reduce((sum, p) => sum + parseFloat(p.wage || 0), 0);
          if (wageSum > parseFloat(teamData.max_wage_cap)) {
            tasks.push({
              id: "wage-cap",
              type: "urgent",
              title: "Teto Salarial Excedido",
              description: "Sua folha salarial estourou o limite! Você não pontuará na liga até regularizar.",
              icon: "⚠️",
              href: "/dashboard",
              actionText: "Ver Finanças"
            });
          }

          setInboxTasks(tasks);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados do clube:", err);
    } finally {
      setLoading(false);
    }
  };

  useDeferredEffect(() => {
    loadClubData();
    loadSettings();
  });

  const squadWages = players.reduce((sum, p) => sum + parseFloat(p.wage || 0), 0);
  const avgRating =
    players.length > 0
      ? Math.round(players.reduce((sum, p) => sum + p.rating, 0) / players.length)
      : 0;

  const handleShieldUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !team) return;
    setUploadingShield(true);
    triggerShieldAlert("info", "Fazendo upload do escudo...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada.");
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/storage/shield", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha no upload.");
      setTeam((prev) => ({ ...prev, badge_url: result.url }));
      triggerShieldAlert("success", "Escudo do time atualizado com sucesso!");
    } catch (err) {
      triggerShieldAlert("error", "Erro ao fazer upload do escudo: " + err.message);
    } finally {
      setUploadingShield(false);
    }
  };

  const handleReleasePlayer = async (player) => {
    if (!team) return;
    setActionLoading(player.id);
    try {
      const { data, error } = await supabase.rpc("release_player", { p_player_id: player.id });
      if (!error && data?.success) await loadClubData();
    } catch (err) {
      console.error("Erro ao dispensar:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenPlayerProfile = async (player) => {
    setSelectedPlayerForProfile(player);
    setShowProfileModal(true);
    setLoadingStats(true);
    try {
      const { data, error } = await supabase
        .from("view_players_career_stats")
        .select("*")
        .eq("player_id", player.id)
        .order("season_name", { ascending: true });
      setPlayerStats(!error && data ? data : []);
    } catch {
      setPlayerStats([]);
    } finally {
      setLoadingStats(false);
    }
  };



  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="glass-card p-8 text-center rounded-2xl max-w-xl mx-auto mt-10">
        <span className="text-4xl block mb-2">⚠️</span>
        <h2 className="text-xl font-bold text-white mb-2">Nenhum Clube Encontrado</h2>
        <p className="text-sm text-gray-400 mb-6">Sua conta não possui uma equipe associada nesta liga.</p>
        <button
          onClick={async () => { await supabase.auth.signOut(); router.push("/register"); }}
          className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all"
        >
          Registrar Novo Time
        </button>
      </div>
    );
  }

  const salaryWindowOpen = settings.salary_window_open === "true";
  const allowAuction = settings.allow_player_auction === "true";
  const salaryRatio = parseFloat(settings.salary_to_value_ratio || 1);
  const calculatedValue = newSalary
    ? (parseFloat(newSalary) * salaryRatio).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
    : "—";

  const attackPositions = ["ST", "CF", "LF", "RF", "LW", "RW"];
  const midfieldPositions = ["CM", "CDM", "CAM", "LM", "RM", "LCM", "RCM", "LDM", "RDM", "LAM", "RAM"];
  const defensePositions = ["CB", "RCB", "LCB", "LB", "RB", "LWB", "RWB", "SW"];

  const goalkeepers = players.filter((p) => p.position === "GK");
  const defenders = players.filter((p) => defensePositions.includes(p.position));
  const midfielders = players.filter((p) => midfieldPositions.includes(p.position));
  const attackers = players.filter((p) => attackPositions.includes(p.position));
  const others = players.filter((p) =>
    p.position !== "GK" && !attackPositions.includes(p.position) &&
    !midfieldPositions.includes(p.position) && !defensePositions.includes(p.position)
  );

  const renderPlayerCategory = (title, categoryPlayers) => {
    if (categoryPlayers.length === 0) return null;
    return (
      <div className="space-y-3 pt-6 first:pt-0">
        <h3 className="text-xs font-bold text-[#3b82f6] uppercase tracking-wider border-l-2 border-[#3b82f6] pl-2">
          {title} ({categoryPlayers.length})
        </h3>
        <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#090d16]/20">
          <table className="w-full text-left text-sm text-gray-300 border-collapse">
            <thead>
              <tr className="text-[10px] font-bold uppercase text-gray-500 border-b border-white/5 bg-white/[0.01]">
                <th className="py-3 px-4 text-center w-16">Foto</th>
                <th className="py-3 px-4">Jogador</th>
                <th className="py-3 px-4 text-center w-20">Posição</th>
                <th className="py-3 px-4 text-center w-20">
                  Rating
                  <Tooltip content="Classificação geral do jogador no EA FC (Overall)." />
                </th>
                <th className="py-3 px-4 text-right w-32">
                  Passe (Valor)
                  <Tooltip content="O valor estimado de mercado do passe, calculado automaticamente baseado no salário do jogador multiplicado pelo multiplicador da liga." />
                </th>
                <th className="py-3 px-4 text-right w-32">
                  Salário
                  <Tooltip content="Custo semanal do salário do jogador. A soma dos salários de todos os atletas não deve estourar o teto salarial do seu clube." />
                </th>
                <th className="py-3 px-4 text-center w-36">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {categoryPlayers.map((player) => (
                <tr key={player.id} className="hover:bg-white/[0.03] transition-colors">
                  <td className="py-2.5 px-4">
                    <div
                      onClick={() => handleOpenPlayerProfile(player)}
                      className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden mx-auto flex-shrink-0 cursor-pointer hover:border-[#10b981] transition-all"
                    >
                      {player.face_url ? (
                        <AppImage src={player.face_url} alt="" className="h-full w-full object-cover scale-110" draggable={false} />
                      ) : (
                        <span className="text-base text-gray-500">👤</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-white">
                    <p onClick={() => handleOpenPlayerProfile(player)} className="text-sm font-bold text-white hover:text-[#10b981] hover:underline cursor-pointer transition-colors">
                      {player.name}
                    </p>
                    <p className="text-[10px] text-gray-400 font-normal">{player.nation || "Desconhecida"} • {player.age || "--"} anos</p>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#0d1527] border border-white/10 text-gray-300">{player.position}</span>
                  </td>
                  <td className="py-2.5 px-4 text-center font-extrabold text-white text-base">{player.rating}</td>
                  <td className="py-2.5 px-4 text-right font-semibold text-blue-400 text-xs">R$ {(player.value / 1000).toFixed(0)}k</td>
                  <td className="py-2.5 px-4 text-right font-bold text-emerald-400 text-xs">R$ {player.wage.toLocaleString("pt-BR")}</td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        title={salaryWindowOpen ? "Ajustar Salário" : "Ajustar Salário (Janela Fechada)"}
                        onClick={() => { setSelectedPlayerForSalary(player); setNewSalary(""); setSalaryError(""); setSalarySuccess(""); setShowSalaryModal(true); }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border ${salaryWindowOpen ? "bg-emerald-500/10 hover:bg-emerald-500/25 border-emerald-500/20 text-emerald-400" : "bg-gray-500/10 border-gray-500/20 text-gray-500 opacity-60"}`}
                      >
                        <span className="text-xs">💰</span>
                      </button>
                      {allowAuction && (
                        <button
                          title="Enviar para Leilão"
                          onClick={() => { setSelectedPlayerForAuction(player); setAuctionError(""); setAuctionSuccess(""); setShowAuctionModal(true); }}
                          className="w-8 h-8 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/20 text-amber-400 flex items-center justify-center transition-all"
                        >
                          <span className="text-xs">🔨</span>
                        </button>
                      )}
                      <button
                        title="Dispensar Jogador"
                        onClick={() => handleReleasePlayer(player)}
                        disabled={actionLoading !== null}
                        className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-400 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="text-xs">{actionLoading === player.id ? "⏳" : "❌"}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Alerta de Escudo */}
      {shieldAlert && (
        <div className={`p-4 rounded-xl text-sm border flex items-center gap-3 animate-fadeIn ${
          shieldAlert.type === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : shieldAlert.type === "info" ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
          : "bg-red-500/10 text-red-400 border-red-500/20"
        }`}>
          <span>{shieldAlert.type === "success" ? "✅" : shieldAlert.type === "info" ? "ℹ️" : "⚠️"}</span>
          <span>{shieldAlert.message}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          {team && (
            <div className="relative group select-none">
              {team.badge_url ? (
                <AppImage src={team.badge_url} alt={team.name} className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-contain bg-white/5 border border-white/10 p-1.5 transition-all group-hover:scale-105 duration-200" />
              ) : (
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-[#3b82f6]/10 text-[#3b82f6] flex items-center justify-center font-bold border border-[#3b82f6]/20 text-3xl transition-all group-hover:scale-105 duration-200">🛡️</div>
              )}
              {settings.allow_shield_change === "true" && (
                <label className="absolute inset-0 flex items-center justify-center bg-black/75 rounded-2xl opacity-0 group-hover:opacity-100 cursor-pointer transition-all duration-200 border border-[#10b981]/50">
                  <span className="text-[10px] font-bold text-[#10b981] text-center px-1">Alterar Escudo</span>
                  <input type="file" accept="image/*" onChange={handleShieldUpload} disabled={uploadingShield} className="hidden" />
                </label>
              )}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{team.name}</h1>
            <p className="mt-1 text-sm text-gray-400">Gerenciamento de Clube & Elenco</p>
          </div>
        </div>
        <Link href="/dashboard/scouting" className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-4 py-2.5 text-xs font-bold text-white shadow transition-all hover:scale-[1.02] active:scale-[0.98]">
          Contratar Jogadores
        </Link>
      </div>

      {/* RESUMO FINANCEIRO E DE ELENCO */}
      <StatsCards team={team} players={players} settings={settings} />

      {/* COCKPIT DO TREINADOR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
        <div className="lg:col-span-2 space-y-6">
          <NextMatchBanner nextMatch={nextMatch} myTeamId={team?.id} />

          {/* Editor de Escalação (Direto na tela) */}
          <LineupEditor team={team} players={players} onTeamUpdate={setTeam} />
        </div>
        <div className="lg:col-span-1 space-y-6">
          <InboxTasks tasks={inboxTasks} />
        </div>
      </div>

      {/* Lista do Elenco */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-6 mt-8">
        <div className="border-b border-white/5 pb-4">
          <h2 className="text-lg font-bold text-white">Elenco do Clube</h2>
          <p className="text-xs text-gray-400">Jogadores organizados por setor tático. Arraste para o campo para escalar.</p>
        </div>
        {players.length === 0 ? (
          <div className="py-16 text-center">
            <span className="text-4xl block mb-2">🏃‍♂️</span>
            <p className="text-sm text-gray-400 mb-4">Seu elenco está vazio. Comece a contratar atletas livres!</p>
            <Link href="/dashboard/scouting" className="rounded-lg bg-[#10b981] hover:bg-[#059669] px-4 py-2 text-xs font-semibold text-white transition-all">
              Ir para o Olheiro
            </Link>
          </div>
        ) : (
          <div className="space-y-8 divide-y divide-white/5">
            {renderPlayerCategory("Goleiros", goalkeepers)}
            {renderPlayerCategory("Defensores", defenders)}
            {renderPlayerCategory("Meias", midfielders)}
            {renderPlayerCategory("Atacantes", attackers)}
            {renderPlayerCategory("Outros", others)}
          </div>
        )}
      </div>

      {/* Modal de Ajuste Salarial */}
      <SalaryModal
        isOpen={showSalaryModal}
        onClose={() => setShowSalaryModal(false)}
        player={selectedPlayerForSalary}
        team={team}
        salaryWindowOpen={salaryWindowOpen}
        salaryRatio={salaryRatio}
        onSuccess={loadClubData}
      />

      {/* Modal de Leilão */}
      <AuctionModal
        isOpen={showAuctionModal}
        onClose={() => setShowAuctionModal(false)}
        player={selectedPlayerForAuction}
        team={team}
        onSuccess={loadClubData}
      />

      {/* Modal de Perfil do Jogador */}
      <PlayerProfileModal
        isOpen={showProfileModal}
        onClose={() => { setShowProfileModal(false); setSelectedPlayerForProfile(null); }}
        player={selectedPlayerForProfile}
        stats={playerStats}
        loading={loadingStats}
      />
    </div>
  );
}
