"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LineupEditor from "./components/LineupEditor";
import FinancialSummary from "./components/FinancialSummary";

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
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [settings, setSettings] = useState({});
  const [activeTab, setActiveTab] = useState("squad");
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [financialHistory, setFinancialHistory] = useState([]);
  const [financialLoading, setFinancialLoading] = useState(false);

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

  const loadFinancialData = async (teamId) => {
    setFinancialLoading(true);
    try {
      const { data, error } = await supabase
        .from("transfer_history")
        .select("*")
        .or(`from_team_id.eq.${teamId},to_team_id.eq.${teamId}`)
        .order("created_at", { ascending: false });
      if (!error && data) setFinancialHistory(data);
    } catch (err) {
      console.error("Erro ao carregar histórico financeiro:", err);
    } finally {
      setFinancialLoading(false);
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
        loadFinancialData(teamData.id);
        const { data: squad } = await supabase
          .from("players")
          .select("id, name, common_name, rating, potential, position, face_url, wage, value, nation, age, playstyles, playstyles_plus")
          .eq("team_id", teamData.id)
          .order("rating", { ascending: false });
        setPlayers(squad || []);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do clube:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadNews = async () => {
    try {
      const { data, error } = await supabase
        .from("market_news")
        .select("*, teams!team_id(name)")
        .order("created_at", { ascending: false })
        .limit(6);
      if (!error && data) setNews(data);
    } catch (err) {
      console.error(err);
    } finally {
      setNewsLoading(false);
    }
  };

  useEffect(() => {
    loadClubData();
    loadSettings();
    loadNews();
  }, []);

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
      const fileExt = file.name.split(".").pop();
      const fileName = `${team.id}-${Math.round(Date.now() / 1000)}.${fileExt}`;
      const filePath = `user-shields/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("shields").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("shields").getPublicUrl(filePath);
      const { error: updateError } = await supabase.from("teams").update({ badge_url: publicUrl }).eq("id", team.id);
      if (updateError) throw updateError;
      setTeam((prev) => ({ ...prev, badge_url: publicUrl }));
      triggerShieldAlert("success", "Escudo do time atualizado com sucesso!");
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase.from("notifications").insert({ user_id: session.user.id, title: "Escudo Atualizado", content: "Você alterou o escudo do seu clube com sucesso!" });
      }
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
      const { data, error } = await supabase.rpc("release_player", { p_player_id: player.id, p_team_id: team.id });
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

  const handleSalaryAdjust = async () => {
    if (!selectedPlayerForSalary || !team) return;
    const salNum = parseFloat(newSalary);
    if (!salNum || salNum <= 0) { setSalaryError("Digite um salário válido."); return; }
    setSalaryError("");
    setSavingSalary(true);
    try {
      const { data, error } = await supabase.rpc("adjust_player_salary", { p_player_id: selectedPlayerForSalary.id, p_team_id: team.id, p_new_wage: salNum });
      if (error) throw error;
      if (data?.success === false) {
        setSalaryError(data.message || "Erro ao ajustar salário.");
      } else {
        setSalarySuccess("Salário ajustado com sucesso!");
        await loadClubData();
        setTimeout(() => { setShowSalaryModal(false); setSalarySuccess(""); setNewSalary(""); setSelectedPlayerForSalary(null); }, 1500);
      }
    } catch (err) {
      setSalaryError("Erro ao ajustar salário: " + err.message);
    } finally {
      setSavingSalary(false);
    }
  };

  const handleSubmitAuction = async () => {
    if (!selectedPlayerForAuction || !team) return;
    setSavingAuction(true);
    setAuctionError("");
    try {
      const { data, error } = await supabase.rpc("player_submit_to_auction", { p_player_id: selectedPlayerForAuction.id, p_team_id: team.id });
      if (error) throw error;
      if (data?.success === false) {
        setAuctionError(data.message || "Erro ao enviar para leilão.");
      } else {
        setAuctionSuccess("Jogador enviado para leilão com sucesso!");
        await loadClubData();
        setTimeout(() => { setShowAuctionModal(false); setAuctionSuccess(""); setSelectedPlayerForAuction(null); }, 1500);
      }
    } catch (err) {
      setAuctionError("Erro: " + err.message);
    } finally {
      setSavingAuction(false);
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
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/register"; }}
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
                        <img src={player.face_url} alt="" className="h-full w-full object-cover scale-110" draggable={false} />
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
                <img src={team.badge_url} alt={team.name} className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-contain bg-white/5 border border-white/10 p-1.5 transition-all group-hover:scale-105 duration-200" />
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
            <p className="mt-1 text-sm text-gray-400">{team.real_club_name} | Gerenciamento de Clube & Elenco</p>
          </div>
        </div>
        <Link href="/dashboard/scouting" className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-4 py-2.5 text-xs font-bold text-white shadow transition-all hover:scale-[1.02] active:scale-[0.98]">
          Contratar Jogadores
        </Link>
      </div>

      {/* Persistent Stats Cards */}
      {team && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
          <div className="glass-card p-4 rounded-2xl border border-white/5 bg-[#090d16]/40 hover:border-emerald-500/20 transition-all flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Orçamento Disponível
                <Tooltip content="Saldo líquido em caixa do seu clube para contratação de jogadores na Central de Contratações ou lances em leilões." />
              </span>
              <p className="text-lg sm:text-xl font-black text-emerald-400 mt-1">
                R$ {parseFloat(team.budget).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <span className="text-[9px] text-gray-500 mt-1 block">Saldo para investimentos</span>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-white/5 bg-[#090d16]/40 hover:border-blue-500/20 transition-all flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Folha Salarial semanal
                <Tooltip content="Soma dos salários de todos os atletas contratados. Não pode exceder o teto do seu clube." />
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <p className="text-lg sm:text-xl font-black text-white">
                  R$ {squadWages.toLocaleString("pt-BR")}
                </p>
                <span className="text-[9px] text-gray-500">/ R$ {parseFloat(team.max_wage_cap).toLocaleString("pt-BR")}</span>
              </div>
            </div>
            <span className={`text-[9px] mt-1 block font-bold ${squadWages > team.max_wage_cap ? "text-red-400 animate-pulse" : "text-gray-500"}`}>
              {squadWages > team.max_wage_cap ? "⚠️ Limite Excedido!" : "Dentro do limite teto"}
            </span>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-white/5 bg-[#090d16]/40 hover:border-amber-500/20 transition-all flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Atletas no Elenco
                <Tooltip content="Quantidade total de jogadores contratados. O limite máximo padrão por time é de 24 atletas." />
              </span>
              <p className="text-lg sm:text-xl font-black text-white mt-1">
                {players.length} <span className="text-xs font-bold text-gray-500">/ {settings.max_players_per_team || 24}</span>
              </p>
            </div>
            <span className="text-[9px] text-gray-500 mt-1 block">Tamanho do elenco</span>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-white/5 bg-[#090d16]/40 hover:border-yellow-500/20 transition-all flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Rating Médio
                <Tooltip content="Nível médio geral (Over) de todos os atletas do seu clube." />
              </span>
              <p className="text-lg sm:text-xl font-black text-[#f59e0b] mt-1">
                ⭐ {avgRating}
              </p>
            </div>
            <span className="text-[9px] text-gray-500 mt-1 block">Força média do elenco</span>
          </div>
        </div>
      )}

      {/* Mural de Notícias */}
      {news.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-6">
          <div className="flex items-center gap-2 border-b border-white/5 pb-4">
            <span className="text-xl">📰</span>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Mural de Notícias da Liga</h2>
              <p className="text-xs text-gray-400">Últimos comunicados, transferências e movimentações do mercado.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Manchete principal */}
            <div className="lg:col-span-3 p-5 rounded-2xl bg-gradient-to-br from-white/[0.02] to-white/[0.05] border border-white/5 hover:border-white/10 transition-all duration-300 flex flex-col justify-between min-h-[260px]">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                    news[0].category === "transfer" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : news[0].category === "stage" ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : news[0].category === "finance" ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                    : news[0].category === "auction" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  }`}>
                    {news[0].category === "transfer" ? "Transferência" : news[0].category === "stage" ? "Fase da Liga" : news[0].category === "finance" ? "Financeiro" : news[0].category === "auction" ? "Leilão" : "Comunicado"}
                  </span>
                  <span className="text-[10px] text-gray-500">{new Date(news[0].created_at).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="flex items-start gap-4">
                  {news[0].badge_url && <img src={news[0].badge_url} alt="" className="w-16 h-16 object-contain bg-white/5 rounded-xl p-2 border border-white/10 flex-shrink-0 animate-pulse" />}
                  {news[0].player_face_url && !news[0].badge_url && <img src={news[0].player_face_url} alt="" className="w-16 h-16 object-cover bg-white/5 rounded-full border border-white/10 flex-shrink-0" />}
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-extrabold text-white leading-tight">{news[0].title}</h3>
                    <p className="text-xs text-gray-400 leading-relaxed pt-1">{news[0].content}</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-white/5 pt-4 mt-4 flex justify-between items-center text-[10px] text-gray-500">
                <span>Fontes oficiais do campeonato</span>
                <span className="font-semibold text-gray-400 flex items-center gap-1">🟢 Notícias em Tempo Real</span>
              </div>
            </div>
            {/* Últimas manchetes */}
            <div className="lg:col-span-2 space-y-3 max-h-[260px] overflow-y-auto pr-1">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Últimas Manchetes</h3>
              {news.slice(1).map((item) => (
                <div key={item.id} className="p-3 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all flex items-start gap-3 duration-200">
                  {item.badge_url ? <img src={item.badge_url} alt="" className="w-8 h-8 object-contain bg-white/5 rounded p-1 border border-white/5 flex-shrink-0" />
                  : item.player_face_url ? <img src={item.player_face_url} alt="" className="w-8 h-8 object-cover bg-white/5 rounded-full border border-white/5 flex-shrink-0" />
                  : <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-sm flex-shrink-0">📰</div>}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-white leading-snug truncate">{item.title}</p>
                    <p className="text-[10px] text-gray-400 leading-snug line-clamp-1 mt-0.5">{item.content}</p>
                    <span className="text-[9px] text-gray-500 block mt-1">{new Date(item.created_at).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Abas */}
      <div className="flex border-b border-white/5 gap-2 mt-4">
        {[
          { key: "squad", label: "📋 Elenco & Tática" },
          { key: "finances", label: "💵 Finanças & Fluxo de Caixa" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-6 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === key ? "border-[#10b981] text-[#10b981]" : "border-transparent text-gray-400 hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Aba Elenco & Tática */}
      {activeTab === "squad" && (
        <>
          {/* Editor de Escalação */}
          <LineupEditor team={team} players={players} onTeamUpdate={setTeam} />

          {/* Lista do Elenco */}
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-6">
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
        </>
      )}

      {/* Aba Finanças */}
      {activeTab === "finances" && (
        <FinancialSummary
          team={team}
          players={players}
          financialHistory={financialHistory}
          financialLoading={financialLoading}
        />
      )}

      {/* Modal de Ajuste Salarial */}
      {showSalaryModal && selectedPlayerForSalary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-sm p-6 rounded-2xl border border-white/10 bg-[#090d16]/95 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">💰 Ajustar Salário</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Digite o salário que o jogador terá.</p>
              </div>
              <button onClick={() => { setShowSalaryModal(false); setSalaryError(""); setSalarySuccess(""); }} className="text-gray-400 hover:text-white text-xs bg-white/5 px-2.5 py-1 rounded-lg">✕</button>
            </div>
            {!salaryWindowOpen && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 mb-4 flex items-start gap-2">
                <span className="text-sm">🔒</span>
                <div><strong className="block font-bold">Janela de Ajuste Fechada</strong>O período para ajustar salários de forma livre está encerrado.</div>
              </div>
            )}
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedPlayerForSalary.face_url ? <img src={selectedPlayerForSalary.face_url} alt="" className="h-full w-full object-cover scale-110" /> : <span className="text-xl">👤</span>}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-[#10b981]">{selectedPlayerForSalary.rating}</span>
                  <span className="text-xs font-bold text-white">{selectedPlayerForSalary.name}</span>
                </div>
                <span className="text-[9px] text-gray-400 uppercase">{selectedPlayerForSalary.position}</span>
              </div>
            </div>
            <div className="space-y-3 mb-4">
              <input
                type="number"
                value={newSalary}
                onChange={(e) => setNewSalary(e.target.value)}
                placeholder={salaryWindowOpen ? "Ex: 50000" : "Ajuste desativado"}
                disabled={!salaryWindowOpen || savingSalary}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#10b981] transition-colors disabled:opacity-50"
              />
              <div className="flex justify-between items-center px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[10px] text-gray-400">Novo Passe <span className="text-gray-600">(× {salaryRatio})</span></span>
                <span className="text-[10px] font-semibold text-blue-400">R$ {calculatedValue}</span>
              </div>
            </div>
            {salaryError && <p className="text-[10px] text-red-400 mb-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">⚠️ {salaryError}</p>}
            {salarySuccess && <p className="text-[10px] text-emerald-400 mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">✅ {salarySuccess}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowSalaryModal(false); setSalaryError(""); setSalarySuccess(""); }} className="flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 py-2.5 text-xs font-bold text-gray-300 transition-all">Fechar</button>
              <button onClick={handleSalaryAdjust} disabled={savingSalary || !newSalary || !salaryWindowOpen} className="flex-1 rounded-xl bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 py-2.5 text-xs font-bold text-white transition-all">
                {savingSalary ? "Ajustando..." : "Ajustar Salário"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Leilão */}
      {showAuctionModal && selectedPlayerForAuction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-sm p-6 rounded-2xl border border-white/10 bg-[#090d16]/95 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-white">🔨 Enviar para Leilão</h3>
              <button onClick={() => { setShowAuctionModal(false); setAuctionError(""); setAuctionSuccess(""); }} className="text-gray-400 hover:text-white text-xs bg-white/5 px-2.5 py-1 rounded-lg">✕</button>
            </div>
            <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedPlayerForAuction.face_url ? <img src={selectedPlayerForAuction.face_url} alt="" className="h-full w-full object-cover scale-110" /> : <span className="text-xl">👤</span>}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-amber-400">{selectedPlayerForAuction.rating}</span>
                  <span className="text-xs font-bold text-white">{selectedPlayerForAuction.name}</span>
                </div>
                <span className="text-[9px] text-gray-400 uppercase">{selectedPlayerForAuction.position}</span>
              </div>
            </div>
            <p className="text-xs text-gray-300 mb-3">Tem certeza que deseja colocar <strong className="text-white">{selectedPlayerForAuction.name}</strong> em leilão?</p>
            <p className="text-[10px] text-gray-500 mb-5 p-3 bg-white/[0.02] rounded-xl border border-white/5">ℹ️ O jogador estará pronto para receber lances quando o administrador liberar a temporada de leilão.</p>
            {auctionError && <p className="text-[10px] text-red-400 mb-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">⚠️ {auctionError}</p>}
            {auctionSuccess && <p className="text-[10px] text-emerald-400 mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">✅ {auctionSuccess}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowAuctionModal(false); setAuctionError(""); setAuctionSuccess(""); }} className="flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 py-2.5 text-xs font-bold text-gray-300 transition-all">Cancelar</button>
              <button onClick={handleSubmitAuction} disabled={savingAuction} className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 py-2.5 text-xs font-bold text-white transition-all">
                {savingAuction ? "Enviando..." : "SIM, enviar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Perfil do Jogador */}
      {showProfileModal && selectedPlayerForProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-white/10 bg-[#090d16]/95 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="relative p-6 bg-gradient-to-b from-[#10b981]/15 to-transparent border-b border-white/5 flex gap-4 items-center">
              <div className="h-16 w-16 rounded-full bg-white/5 border border-[#10b981]/30 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-lg">
                {selectedPlayerForProfile.face_url ? <img src={selectedPlayerForProfile.face_url} alt="" className="h-full w-full object-cover scale-110" /> : <span className="text-3xl">👤</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-white">{selectedPlayerForProfile.name}</span>
                  <span className="px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] font-bold text-xs">{selectedPlayerForProfile.rating}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-wider">
                  {selectedPlayerForProfile.position} • {selectedPlayerForProfile.age || "--"} anos • {selectedPlayerForProfile.nation || "N/A"}
                </p>
              </div>
              <button onClick={() => { setShowProfileModal(false); setSelectedPlayerForProfile(null); }} className="text-gray-400 hover:text-white text-xs bg-white/5 hover:bg-white/10 rounded-lg px-2.5 py-1">✕</button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-white/5 bg-white/[0.01]">
                  <span className="text-[10px] text-gray-500 block">Salário</span>
                  <p className="text-sm font-bold text-emerald-400 mt-0.5">R$ {parseFloat(selectedPlayerForProfile.wage || 0).toLocaleString("pt-BR")}</p>
                </div>
                <div className="p-3.5 rounded-xl border border-white/5 bg-white/[0.01]">
                  <span className="text-[10px] text-gray-500 block">Passe de Mercado</span>
                  <p className="text-sm font-bold text-blue-400 mt-0.5">R$ {parseFloat(selectedPlayerForProfile.value || 0).toLocaleString("pt-BR")}</p>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">📊 Histórico na Liga Master</h4>
                {loadingStats ? (
                  <div className="py-8 text-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[#10b981] border-t-transparent mx-auto"></div></div>
                ) : playerStats.length === 0 ? (
                  <div className="text-center py-8 rounded-xl border border-white/5 bg-white/[0.01]">
                    <span className="text-lg block mb-1">⚽</span>
                    <p className="text-xs text-gray-500">Sem estatísticas registradas em campeonatos oficiais.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#090d16]/30">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-white/[0.02] border-b border-white/5 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Temporada</th>
                          <th className="py-2.5 px-3 text-center">⚽ Gols</th>
                          <th className="py-2.5 px-3 text-center">🎯 Assist</th>
                          <th className="py-2.5 px-3 text-center">⭐ MOTM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-gray-300">
                        {playerStats.map((stat, idx) => (
                          <tr key={idx} className="hover:bg-white/[0.01]">
                            <td className="py-2.5 px-3 font-semibold text-white">{stat.season_name}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-emerald-400">{stat.goals}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-blue-400">{stat.assists}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-amber-400">{stat.motm_count}</td>
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
      )}
    </div>
  );
}
