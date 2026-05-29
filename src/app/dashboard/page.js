"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function UserDashboard() {
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  // Carregar dados do clube e do elenco
  useEffect(() => {
    async function loadClubData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Carregar Time
        const { data: teamData } = await supabase
          .from("teams")
          .select("*")
          .eq("user_id", session.user.id)
          .single();

        if (teamData) {
          setTeam(teamData);

          // Carregar elenco completo
          const { data: squad } = await supabase
            .from("players")
            .select("*")
            .eq("team_id", teamData.id)
            .order("rating", { ascending: false });

          setPlayers(squad || []);
        }
      } catch (err) {
        console.error("Erro ao carregar dados do clube:", err);
      } finally {
        setLoading(false);
      }
    }

    loadClubData();
  }, []);

  // Dispensa de jogador (reembolso e liberação de folha salarial)
  const handleReleasePlayer = async (player) => {
    if (!team) return;

    const confirmRelease = window.confirm(
      `Tem certeza que deseja dispensar ${player.name}? \nIsso liberará R$ ${player.wage.toLocaleString("pt-BR")} de folha salarial e reembolsará R$ ${parseFloat(player.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} no seu orçamento.`
    );

    if (!confirmRelease) return;

    setActionLoading(player.id);

    try {
      const { data, error } = await supabase.rpc("release_player", {
        p_player_id: player.id,
        p_team_id: team.id,
      });

      if (error) throw error;

      if (data && data.success) {
        alert(data.message);
        
        // Atualizar orçamento local do time
        setTeam((prev) => ({
          ...prev,
          budget: prev.budget + player.value,
        }));

        // Remover da lista de jogadores local
        setPlayers((prev) => prev.filter((p) => p.id !== player.id));
      } else {
        alert(data.message || "Houve uma falha ao tentar dispensar o jogador.");
      }
    } catch (err) {
      alert("Erro ao dispensar: " + err.message);
    } finally {
      setActionLoading(null);
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
        <p className="text-sm text-gray-400 mb-6">
          Sua conta de usuário não possui uma equipe associada nesta liga.
        </p>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/register";
          }}
          className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all"
        >
          Registrar Novo Time
        </button>
      </div>
    );
  }

  // Agrupar elenco por posições
  const attackPositions = ["ST", "CF", "LF", "RF", "LW", "RW"];
  const midfieldPositions = ["CM", "CDM", "CAM", "LM", "RM", "LCM", "RCM", "LDM", "RDM", "LAM", "RAM"];
  const defensePositions = ["CB", "RCB", "LCB", "LB", "RB", "LWB", "RWB", "SW"];

  const goalkeepers = players.filter((p) => p.position === "GK");
  const defenders = players.filter((p) => defensePositions.includes(p.position));
  const midfielders = players.filter((p) => midfieldPositions.includes(p.position));
  const attackers = players.filter((p) => attackPositions.includes(p.position));
  const others = players.filter(
    (p) =>
      p.position !== "GK" &&
      !attackPositions.includes(p.position) &&
      !midfieldPositions.includes(p.position) &&
      !defensePositions.includes(p.position)
  );

  // Calcular estatísticas básicas
  const avgRating = players.length > 0 ? Math.round(players.reduce((sum, p) => sum + p.rating, 0) / players.length) : 0;
  const squadValue = players.reduce((sum, p) => sum + parseFloat(p.value), 0);
  const squadWages = players.reduce((sum, p) => sum + parseFloat(p.wage), 0);

  const renderPlayerCategory = (title, categoryPlayers) => {
    if (categoryPlayers.length === 0) return null;

    return (
      <div className="space-y-4 pt-4">
        <h3 className="text-sm font-bold text-[#3b82f6] uppercase tracking-wider border-l-2 border-[#3b82f6] pl-2">
          {title} ({categoryPlayers.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {categoryPlayers.map((player) => (
            <div
              key={player.id}
              className="glass-card rounded-xl overflow-hidden flex flex-col justify-between border border-white/5 bg-[#090d16]/30 relative"
            >
              {/* Overall & Posição no Topo */}
              <div className="absolute top-3 left-3 flex flex-col items-center">
                <span className="text-xl font-black text-white leading-none">{player.rating}</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{player.position}</span>
              </div>

              {/* Avatar e Nome */}
              <div className="pt-6 pb-2 px-4 flex flex-col items-center">
                <div className="h-16 w-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden mb-2">
                  {player.face_url ? (
                    <img src={player.face_url} alt={player.name} className="h-full w-full object-cover scale-110" />
                  ) : (
                    <span className="text-2xl text-gray-600">👤</span>
                  )}
                </div>
                <p className="text-xs font-bold text-white text-center truncate w-full">{player.name}</p>
                <p className="text-[9px] text-gray-500">{player.nation || "Desconhecida"} • {player.age || "--"} anos</p>
              </div>

              {/* Detalhes Financeiros */}
              <div className="p-3 bg-white/[0.01] border-t border-white/5 space-y-3">
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Valor: <strong className="text-emerald-400">R$ {(player.value / 1000).toFixed(0)}k</strong></span>
                  <span>Salário: <strong className="text-gray-300">R$ {player.wage.toLocaleString("pt-BR")}</strong></span>
                </div>
                <button
                  onClick={() => handleReleasePlayer(player)}
                  disabled={actionLoading !== null}
                  className="w-full rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 py-1.5 text-[10px] font-bold text-red-400 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading === player.id ? "Dispensando..." : "Dispensar Jogador"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Painel do Clube
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Gerencie o elenco do seu time, acompanhe as finanças e verifique o teto salarial.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/scouting"
            className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-4 py-2.5 text-xs font-bold text-white shadow transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Contratar Jogadores
          </Link>
        </div>
      </div>

      {/* Visão de Finanças do Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Orçamento Disponível</span>
          <p className="text-2xl font-black text-emerald-400">
            R$ {parseFloat(team.budget).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-gray-500 mt-1 block">Para contratações e lances de leilão</span>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Folha Salarial Semanal</span>
          <p className="text-2xl font-black text-gray-200">
            R$ {squadWages.toLocaleString("pt-BR")}
          </p>
          <span className="text-[10px] text-gray-500 mt-1 block">Teto máximo definido: R$ {parseFloat(team.max_wage_cap).toLocaleString("pt-BR")}</span>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Tamanho do Elenco</span>
          <p className="text-2xl font-black text-white">{players.length} / 24</p>
          <span className="text-[10px] text-gray-500 mt-1 block">Jogadores contratados no time</span>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Rating Médio do Time</span>
          <p className="text-2xl font-black text-[#f59e0b]">⭐ {avgRating}</p>
          <span className="text-[10px] text-gray-500 mt-1 block">Força média do time principal</span>
        </div>
      </div>

      {/* Lista do Elenco Agrupado */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-6">
        <div className="border-b border-white/5 pb-4">
          <h2 className="text-lg font-bold text-white">Elenco do Clube</h2>
          <p className="text-xs text-gray-400">Jogadores organizados por setor tático.</p>
        </div>

        {players.length === 0 ? (
          <div className="py-16 text-center">
            <span className="text-4xl block mb-2">🏃‍♂️</span>
            <p className="text-sm text-gray-400 mb-4">Seu elenco está vazio. Comece a contratar atletas livres!</p>
            <Link
              href="/dashboard/scouting"
              className="rounded-lg bg-[#10b981] hover:bg-[#059669] px-4 py-2 text-xs font-semibold text-white transition-all"
            >
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
    </div>
  );
}
