"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function UserDashboard() {
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [savingFormation, setSavingFormation] = useState(false);
  const [savingEscalation, setSavingEscalation] = useState(false);
  const [settings, setSettings] = useState({});

  // Drag and Drop
  const [draggingPlayer, setDraggingPlayer] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);

  // Modal de Ajuste Salarial
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [selectedPlayerForSalary, setSelectedPlayerForSalary] = useState(null);
  const [newSalary, setNewSalary] = useState("");
  const [salaryError, setSalaryError] = useState("");
  const [salarySuccess, setSalarySuccess] = useState("");
  const [savingSalary, setSavingSalary] = useState(false);

  // Modal de Leilão
  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [selectedPlayerForAuction, setSelectedPlayerForAuction] = useState(null);
  const [auctionError, setAuctionError] = useState("");
  const [auctionSuccess, setAuctionSuccess] = useState("");
  const [savingAuction, setSavingAuction] = useState(false);

  // Perfil do Jogador & Estatísticas de Carreira
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedPlayerForProfile, setSelectedPlayerForProfile] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);

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

      if (!error && data) {
        setPlayerStats(data);
      } else {
        setPlayerStats([]);
      }
    } catch (err) {
      console.error("Erro ao carregar estatísticas do jogador:", err);
      setPlayerStats([]);
    } finally {
      setLoadingStats(false);
    }
  };

  // Abas e Dados Financeiros
  const [activeTab, setActiveTab] = useState("squad"); // "squad", "finances"
  const [financialHistory, setFinancialHistory] = useState([]);
  const [financialLoading, setFinancialLoading] = useState(false);

  const loadFinancialData = async (teamId) => {
    setFinancialLoading(true);
    try {
      const { data, error } = await supabase
        .from("transfer_history")
        .select("*")
        .or(`from_team_id.eq.${teamId},to_team_id.eq.${teamId}`)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setFinancialHistory(data);
      }
    } catch (err) {
      console.error("Erro ao carregar historico financeiro:", err);
    } finally {
      setFinancialLoading(false);
    }
  };

  const calculateFinancialTotals = () => {
    let income = 0;
    let expense = 0;
    
    // Categorias detalhadas
    let salaries = 0;
    let signings = 0;
    let fines = 0;
    let sales = 0;
    let rewards = 0;
    let sponsors = 0;

    if (team) {
      financialHistory.forEach((tx) => {
        const amount = parseFloat(tx.amount || 0);
        if (tx.from_team_id === team.id) {
          // Despesa
          expense += amount;
          if (tx.transfer_type === "salary_charge") salaries += amount;
          else if (tx.transfer_type === "fine") fines += amount;
          else if (["buyout", "immediate_buy", "auction", "trade"].includes(tx.transfer_type)) signings += amount;
        }
        if (tx.to_team_id === team.id) {
          // Receita
          income += amount;
          if (tx.transfer_type === "sponsorship") sponsors += amount;
          else if (tx.transfer_type === "reward") rewards += amount;
          else if (["buyout", "immediate_buy", "auction", "trade"].includes(tx.transfer_type)) sales += amount;
        }
      });
    }

    return { income, expense, salaries, signings, fines, sales, rewards, sponsors };
  };

  // Carregar Settings
  const loadSettings = async () => {
    const { data } = await supabase.from("settings").select("key, value");
    if (data) {
      const map = {};
      data.forEach((s) => (map[s.key] = s.value));
      setSettings(map);
    }
  };

  // Carregar dados do clube e do elenco
  const loadClubData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data: teamData } = await supabase
        .from("teams")
        .select("*")
        .eq("user_id", session.user.id)
        .single();

      if (teamData) {
        setTeam(teamData);
        loadFinancialData(teamData.id);

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
  };

  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);

  const loadNews = async () => {
    try {
      const { data, error } = await supabase
        .from("market_news")
        .select(`
          *,
          teams!team_id(name)
        `)
        .order("created_at", { ascending: false })
        .limit(6);
      if (!error && data) {
        setNews(data);
      }
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

  const [uploadingShield, setUploadingShield] = useState(false);
  const [shieldAlert, setShieldAlert] = useState(null);

  const triggerShieldAlert = (type, message) => {
    setShieldAlert({ type, message });
    setTimeout(() => setShieldAlert(null), 5000);
  };

  const handleShieldUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !team) return;

    setUploadingShield(true);
    triggerShieldAlert("info", "Fazendo upload do escudo...");
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${team.id}-${Math.round(Date.now() / 1000)}.${fileExt}`;
      const filePath = `user-shields/${fileName}`;

      // Upload para o storage do supabase
      const { error: uploadError } = await supabase.storage
        .from("shields")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Pegar URL pública
      const { data: { publicUrl } } = supabase.storage
        .from("shields")
        .getPublicUrl(filePath);

      // Atualizar no banco
      const { error: updateError } = await supabase
        .from("teams")
        .update({ badge_url: publicUrl })
        .eq("id", team.id);

      if (updateError) throw updateError;

      setTeam((prev) => ({ ...prev, badge_url: publicUrl }));
      triggerShieldAlert("success", "Escudo do time atualizado com sucesso!");

      // Enviar notificação
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase.from("notifications").insert({
          user_id: session.user.id,
          title: "Escudo Atualizado",
          content: "Você alterou o escudo do seu clube com sucesso!"
        });
      }
    } catch (err) {
      console.error(err);
      triggerShieldAlert("error", "Erro ao fazer upload do escudo: " + err.message);
    } finally {
      setUploadingShield(false);
    }
  };

  // Dispensa de jogador
  const handleReleasePlayer = async (player) => {
    if (!team) return;
    setActionLoading(player.id);
    try {
      const { data, error } = await supabase.rpc("release_player", {
        p_player_id: player.id,
        p_team_id: team.id,
      });
      if (error) throw error;
      if (data && data.success) {
        await loadClubData();
      }
    } catch (err) {
      console.error("Erro ao dispensar:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Mudar formação tática
  const handleFormationChange = async (newFormation) => {
    if (!team) return;
    setSavingFormation(true);
    try {
      const { error } = await supabase
        .from("teams")
        .update({ formation: newFormation })
        .eq("id", team.id);
      if (error) throw error;
      setTeam((prev) => ({ ...prev, formation: newFormation }));
    } catch (err) {
      console.error("Erro ao salvar formação:", err);
    } finally {
      setSavingFormation(false);
    }
  };

  // Escalar jogador em um slot via Drag & Drop
  const handleDropPlayerOnSlot = async (player, slotIndex) => {
    if (!team) return;
    setSavingEscalation(true);
    try {
      const currentLineup = Array.isArray(team.lineup)
        ? [...team.lineup]
        : Array(11).fill(null);

      const isLineupEmpty = !currentLineup.some(
        (id) => id !== null && id !== undefined
      );
      let targetLineup = currentLineup;

      if (isLineupEmpty) {
        targetLineup = fieldPlayers.map((s) => s.player?.id || null);
      }

      // Se jogador já está em outro slot, trocar
      const existingIndex = targetLineup.findIndex(
        (id) => id && id.toString() === player.id.toString()
      );
      if (existingIndex !== -1) {
        const playerInTargetSlot = targetLineup[slotIndex];
        targetLineup[existingIndex] = playerInTargetSlot || null;
      }

      targetLineup[slotIndex] = player.id;

      const { error } = await supabase
        .from("teams")
        .update({ lineup: targetLineup })
        .eq("id", team.id);

      if (error) throw error;

      setTeam((prev) => ({ ...prev, lineup: targetLineup }));
    } catch (err) {
      console.error("Erro ao salvar escalação:", err);
    } finally {
      setSavingEscalation(false);
    }
  };

  // Remover jogador de um slot
  const handleRemovePlayerFromSlot = async (slotIndex) => {
    if (!team) return;
    setSavingEscalation(true);
    try {
      const currentLineup = Array.isArray(team.lineup)
        ? [...team.lineup]
        : fieldPlayers.map((s) => s.player?.id || null);
      currentLineup[slotIndex] = null;

      const { error } = await supabase
        .from("teams")
        .update({ lineup: currentLineup })
        .eq("id", team.id);

      if (error) throw error;
      setTeam((prev) => ({ ...prev, lineup: currentLineup }));
    } catch (err) {
      console.error("Erro ao remover jogador:", err);
    } finally {
      setSavingEscalation(false);
    }
  };

  // Ajuste Salarial
  const handleSalaryAdjust = async () => {
    if (!selectedPlayerForSalary || !team) return;
    const salNum = parseFloat(newSalary);
    if (!salNum || salNum <= 0) {
      setSalaryError("Digite um salário válido.");
      return;
    }
    setSalaryError("");
    setSavingSalary(true);
    try {
      const { data, error } = await supabase.rpc("adjust_player_salary", {
        p_player_id: selectedPlayerForSalary.id,
        p_team_id: team.id,
        p_new_wage: salNum,
      });
      if (error) throw error;
      if (data && data.success === false) {
        setSalaryError(data.message || "Erro ao ajustar salário.");
      } else {
        setSalarySuccess("Salário ajustado com sucesso!");
        await loadClubData();
        setTimeout(() => {
          setShowSalaryModal(false);
          setSalarySuccess("");
          setNewSalary("");
          setSelectedPlayerForSalary(null);
        }, 1500);
      }
    } catch (err) {
      setSalaryError("Erro ao ajustar salário: " + err.message);
    } finally {
      setSavingSalary(false);
    }
  };

  // Enviar para Leilão
  const handleSubmitAuction = async () => {
    if (!selectedPlayerForAuction || !team) return;
    setSavingAuction(true);
    setAuctionError("");
    try {
      const { data, error } = await supabase.rpc("player_submit_to_auction", {
        p_player_id: selectedPlayerForAuction.id,
        p_team_id: team.id,
      });
      if (error) throw error;
      if (data && data.success === false) {
        setAuctionError(data.message || "Erro ao enviar para leilão.");
      } else {
        setAuctionSuccess("Jogador enviado para leilão com sucesso!");
        await loadClubData();
        setTimeout(() => {
          setShowAuctionModal(false);
          setAuctionSuccess("");
          setSelectedPlayerForAuction(null);
        }, 1500);
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

  // Agrupamentos táticos
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

  const avgRating =
    players.length > 0
      ? Math.round(players.reduce((sum, p) => sum + p.rating, 0) / players.length)
      : 0;
  const squadWages = players.reduce((sum, p) => sum + parseFloat(p.wage || 0), 0);

  // Configurações de Settings
  const salaryWindowOpen = settings.salary_window_open === "true";
  const allowAuction = settings.allow_player_auction === "true";
  const salaryRatio = parseFloat(settings.salary_to_value_ratio || 1);

  // Algoritmo de mapeamento de jogadores para slots do campo
  const getFormationSlots = () => {
    const sortedPlayers = [...players].sort((a, b) => b.rating - a.rating);

    const gksPool = sortedPlayers.filter((p) => p.position === "GK");
    const defsPool = sortedPlayers.filter((p) => defensePositions.includes(p.position));
    const midsPool = sortedPlayers.filter((p) => midfieldPositions.includes(p.position));
    const attsPool = sortedPlayers.filter((p) => attackPositions.includes(p.position));

    const assignedIds = new Set();

    const assignFromPool = (pool, count) => {
      const selected = [];
      for (const p of pool) {
        if (!assignedIds.has(p.id)) {
          selected.push(p);
          assignedIds.add(p.id);
          if (selected.length === count) break;
        }
      }
      return selected;
    };

    let slots = [];
    const formation = team.formation || "4-3-3";

    if (formation === "4-4-2") {
      slots = [
        { role: "GK", title: "GK", x: 50, y: 88 },
        { role: "DEF", title: "LE", x: 15, y: 70 },
        { role: "DEF", title: "ZAG", x: 38, y: 72 },
        { role: "DEF", title: "ZAG", x: 62, y: 72 },
        { role: "DEF", title: "LD", x: 85, y: 70 },
        { role: "MID", title: "ME", x: 15, y: 46 },
        { role: "MID", title: "MC", x: 38, y: 48 },
        { role: "MID", title: "MC", x: 62, y: 48 },
        { role: "MID", title: "MD", x: 85, y: 46 },
        { role: "ATT", title: "ATA", x: 35, y: 15 },
        { role: "ATT", title: "ATA", x: 65, y: 15 },
      ];
    } else if (formation === "3-5-2") {
      slots = [
        { role: "GK", title: "GK", x: 50, y: 88 },
        { role: "DEF", title: "ZAE", x: 25, y: 72 },
        { role: "DEF", title: "ZAG", x: 50, y: 74 },
        { role: "DEF", title: "ZAD", x: 75, y: 72 },
        { role: "MID", title: "VOL", x: 35, y: 54 },
        { role: "MID", title: "VOL", x: 65, y: 54 },
        { role: "MID", title: "ME", x: 12, y: 40 },
        { role: "MID", title: "MEI", x: 50, y: 34 },
        { role: "MID", title: "MD", x: 88, y: 40 },
        { role: "ATT", title: "ATA", x: 35, y: 14 },
        { role: "ATT", title: "ATA", x: 65, y: 14 },
      ];
    } else if (formation === "4-2-3-1") {
      slots = [
        { role: "GK", title: "GK", x: 50, y: 88 },
        { role: "DEF", title: "LE", x: 15, y: 70 },
        { role: "DEF", title: "ZAG", x: 38, y: 72 },
        { role: "DEF", title: "ZAG", x: 62, y: 72 },
        { role: "DEF", title: "LD", x: 85, y: 70 },
        { role: "MID", title: "VOL", x: 35, y: 52 },
        { role: "MID", title: "VOL", x: 65, y: 52 },
        { role: "MID", title: "ME", x: 18, y: 32 },
        { role: "MID", title: "MEI", x: 50, y: 28 },
        { role: "MID", title: "MD", x: 82, y: 32 },
        { role: "ATT", title: "ATA", x: 50, y: 10 },
      ];
    } else if (formation === "3-4-3") {
      slots = [
        { role: "GK", title: "GK", x: 50, y: 88 },
        { role: "DEF", title: "ZAE", x: 25, y: 72 },
        { role: "DEF", title: "ZAG", x: 50, y: 74 },
        { role: "DEF", title: "ZAD", x: 75, y: 72 },
        { role: "MID", title: "ME", x: 12, y: 48 },
        { role: "MID", title: "MC", x: 38, y: 50 },
        { role: "MID", title: "MC", x: 62, y: 50 },
        { role: "MID", title: "MD", x: 88, y: 48 },
        { role: "ATT", title: "PE", x: 20, y: 18 },
        { role: "ATT", title: "ATA", x: 50, y: 12 },
        { role: "ATT", title: "PD", x: 80, y: 18 },
      ];
    } else if (formation === "5-3-2") {
      slots = [
        { role: "GK", title: "GK", x: 50, y: 88 },
        { role: "DEF", title: "LWE", x: 12, y: 68 },
        { role: "DEF", title: "ZAE", x: 30, y: 72 },
        { role: "DEF", title: "ZAG", x: 50, y: 74 },
        { role: "DEF", title: "ZAD", x: 70, y: 72 },
        { role: "DEF", title: "LWD", x: 88, y: 68 },
        { role: "MID", title: "MC", x: 28, y: 46 },
        { role: "MID", title: "MC", x: 50, y: 48 },
        { role: "MID", title: "MC", x: 72, y: 46 },
        { role: "ATT", title: "ATA", x: 35, y: 15 },
        { role: "ATT", title: "ATA", x: 65, y: 15 },
      ];
    } else {
      // 4-3-3 (Padrão)
      slots = [
        { role: "GK", title: "GK", x: 50, y: 88 },
        { role: "DEF", title: "LE", x: 15, y: 70 },
        { role: "DEF", title: "ZAG", x: 38, y: 72 },
        { role: "DEF", title: "ZAG", x: 62, y: 72 },
        { role: "DEF", title: "LD", x: 85, y: 70 },
        { role: "MID", title: "MC", x: 25, y: 46 },
        { role: "MID", title: "MC", x: 50, y: 50 },
        { role: "MID", title: "MC", x: 75, y: 46 },
        { role: "ATT", title: "PE", x: 20, y: 18 },
        { role: "ATT", title: "ATA", x: 50, y: 12 },
        { role: "ATT", title: "PD", x: 80, y: 18 },
      ];
    }

    const gkCount = slots.filter((s) => s.role === "GK").length;
    const defCount = slots.filter((s) => s.role === "DEF").length;
    const midCount = slots.filter((s) => s.role === "MID").length;
    const attCount = slots.filter((s) => s.role === "ATT").length;

    const selectedGks = assignFromPool(gksPool, gkCount);
    const selectedDefs = assignFromPool(defsPool, defCount);
    const selectedMids = assignFromPool(midsPool, midCount);
    const selectedAtts = assignFromPool(attsPool, attCount);

    const fillRemaining = (assignedList, count) => {
      let list = [...assignedList];
      if (list.length < count) {
        const remainingNeeded = count - list.length;
        const unassigned = sortedPlayers.filter((p) => !assignedIds.has(p.id));
        const extra = assignFromPool(unassigned, remainingNeeded);
        list = [...list, ...extra];
      }
      return list;
    };

    const finalGks = fillRemaining(selectedGks, gkCount);
    const finalDefs = fillRemaining(selectedDefs, defCount);
    const finalMids = fillRemaining(selectedMids, midCount);
    const finalAtts = fillRemaining(selectedAtts, attCount);

    let gkIdx = 0,
      defIdx = 0,
      midIdx = 0,
      attIdx = 0;

    const autoSlots = slots.map((slot) => {
      let p = null;
      if (slot.role === "GK" && gkIdx < finalGks.length) p = finalGks[gkIdx++];
      else if (slot.role === "DEF" && defIdx < finalDefs.length) p = finalDefs[defIdx++];
      else if (slot.role === "MID" && midIdx < finalMids.length) p = finalMids[midIdx++];
      else if (slot.role === "ATT" && attIdx < finalAtts.length) p = finalAtts[attIdx++];
      return { ...slot, player: p };
    });

    const savedLineup = Array.isArray(team.lineup) ? team.lineup : [];
    const hasAnyStarters = savedLineup.some((id) => id !== null && id !== undefined);

    if (!hasAnyStarters) {
      return autoSlots;
    }

    return slots.map((slot, index) => {
      const playerId = savedLineup[index];
      let p = null;
      if (playerId) {
        p = players.find((player) => player.id.toString() === playerId.toString());
      }
      return { ...slot, player: p };
    });
  };

  const fieldPlayers = getFormationSlots();
  const fieldPlayerIds = fieldPlayers
    .map((s) => s.player?.id)
    .filter((id) => id !== undefined && id !== null);
  const benchPlayers = players.filter((p) => !fieldPlayerIds.includes(p.id));

  // Renderizar Lista/Tabela do Elenco
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
                <th className="py-3 px-4 text-center w-20">Rating</th>
                <th className="py-3 px-4 text-right w-32">Passe (Valor)</th>
                <th className="py-3 px-4 text-right w-32">Salário</th>
                <th className="py-3 px-4 text-center w-36">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {categoryPlayers.map((player) => (
                <tr
                  key={player.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggingPlayer(player);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setDraggingPlayer(null)}
                  className={`hover:bg-white/[0.03] transition-colors cursor-grab active:cursor-grabbing ${
                    draggingPlayer?.id === player.id ? "opacity-35" : "opacity-100"
                  }`}
                >
                  {/* Foto do Jogador */}
                  <td className="py-2.5 px-4">
                    <div 
                      onClick={(e) => { e.stopPropagation(); handleOpenPlayerProfile(player); }}
                      className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden mx-auto flex-shrink-0 cursor-pointer hover:border-[#10b981] transition-all"
                    >
                      {player.face_url ? (
                        <img
                          src={player.face_url}
                          alt=""
                          className="h-full w-full object-cover scale-110"
                          draggable={false}
                        />
                      ) : (
                        <span className="text-base text-gray-500">👤</span>
                      )}
                    </div>
                  </td>

                  {/* Nome e Informações Básicas */}
                  <td className="py-2.5 px-4 font-semibold text-white">
                    <div>
                      <p 
                        onClick={(e) => { e.stopPropagation(); handleOpenPlayerProfile(player); }}
                        className="text-sm font-bold text-white hover:text-[#10b981] hover:underline cursor-pointer transition-colors"
                      >
                        {player.name}
                      </p>
                      <p className="text-[10px] text-gray-400 font-normal">
                        {player.nation || "Desconhecida"} • {player.age || "--"} anos
                      </p>
                    </div>
                  </td>

                  {/* Posição */}
                  <td className="py-2.5 px-4 text-center">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#0d1527] border border-white/10 text-gray-300">
                      {player.position}
                    </span>
                  </td>

                  {/* Rating */}
                  <td className="py-2.5 px-4 text-center font-extrabold text-white text-base">
                    {player.rating}
                  </td>

                  {/* Passe (Valor de Mercado) */}
                  <td className="py-2.5 px-4 text-right font-semibold text-blue-400 text-xs">
                    R$ {(player.value / 1000).toFixed(0)}k
                  </td>

                  {/* Salário */}
                  <td className="py-2.5 px-4 text-right font-bold text-emerald-400 text-xs">
                    R$ {player.wage.toLocaleString("pt-BR")}
                  </td>

                  {/* Botões de Ação */}
                  <td className="py-2.5 px-4">
                    <div className="flex items-center justify-center gap-2">
                      {/* Ajuste Salarial */}
                      <button
                        title={salaryWindowOpen ? "Ajustar Salário" : "Ajustar Salário (Janela Fechada)"}
                        onClick={async (e) => {
                          e.stopPropagation();
                          setSelectedPlayerForSalary(player);
                          setNewSalary("");
                          setSalaryError("");
                          setSalarySuccess("");
                          setShowSalaryModal(true);
                          await loadSettings();
                        }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border ${
                          salaryWindowOpen
                            ? "bg-emerald-500/10 hover:bg-emerald-500/25 border-emerald-500/20 text-emerald-400"
                            : "bg-gray-500/10 hover:bg-gray-500/25 border-gray-500/20 text-gray-500 opacity-60"
                        }`}
                      >
                        <span className="text-xs">💰</span>
                      </button>

                      {/* Enviar para Leilão */}
                      {allowAuction && (
                        <button
                          title="Enviar para Leilão"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPlayerForAuction(player);
                            setAuctionError("");
                            setAuctionSuccess("");
                            setShowAuctionModal(true);
                          }}
                          className="w-8 h-8 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/20 text-amber-400 flex items-center justify-center transition-all"
                        >
                          <span className="text-xs">🔨</span>
                        </button>
                      )}

                      {/* Dispensar Jogador */}
                      <button
                        title="Dispensar Jogador"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReleasePlayer(player);
                        }}
                        disabled={actionLoading !== null}
                        className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-400 flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <span className="text-xs">
                          {actionLoading === player.id ? "⏳" : "❌"}
                        </span>
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

  // Calcular novo passe em tempo real
  const calculatedValue = newSalary
    ? (parseFloat(newSalary) * salaryRatio).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
      })
    : "—";

  return (
    <div className="space-y-8">
      {/* Alerta de Escudo */}
      {shieldAlert && (
        <div
          className={`p-4 rounded-xl text-sm border flex items-center gap-3 animate-fadeIn ${
            shieldAlert.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : shieldAlert.type === "info"
              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20"
          }`}
        >
          <span>{shieldAlert.type === "success" ? "✅" : shieldAlert.type === "info" ? "ℹ️" : "⚠️"}</span>
          <span>{shieldAlert.message}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Logo do Clube */}
          {team && (
            <div className="relative group select-none">
              {team.badge_url ? (
                <img
                  src={team.badge_url}
                  alt={team.name}
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-contain bg-white/5 border border-white/10 p-1.5 transition-all group-hover:scale-105 duration-200"
                />
              ) : (
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-[#3b82f6]/10 text-[#3b82f6] flex items-center justify-center font-bold border border-[#3b82f6]/20 text-3xl transition-all group-hover:scale-105 duration-200">
                  🛡️
                </div>
              )}
              
              {/* Botão de Alteração */}
              {settings.allow_shield_change === "true" && (
                <label className="absolute inset-0 flex items-center justify-center bg-black/75 rounded-2xl opacity-0 group-hover:opacity-100 cursor-pointer transition-all duration-200 border border-[#10b981]/50">
                  <span className="text-[10px] font-bold text-[#10b981] text-center px-1">Alterar Escudo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleShieldUpload}
                    disabled={uploadingShield}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {team ? team.name : "Painel do Clube"}
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              {team ? `${team.real_club_name} | Gerenciamento de Clube & Elenco` : "Gerencie seu clube e folha de pagamentos."}
            </p>
          </div>
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

      {/* Finanças */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-gray-400 block mb-1">
            Orçamento Disponível
          </span>
          <p className="text-2xl font-black text-emerald-400">
            R${" "}
            {parseFloat(team.budget).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}
          </p>
          <span className="text-[10px] text-gray-500 mt-1 block">
            Para contratações e lances de leilão
          </span>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-gray-400 block mb-1">
            Folha Salarial
          </span>
          <p className="text-2xl font-black text-gray-200">
            R$ {squadWages.toLocaleString("pt-BR")}
          </p>
          <span className="text-[10px] text-gray-500 mt-1 block">
            Teto máximo: R$ {parseFloat(team.max_wage_cap).toLocaleString("pt-BR")}
          </span>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-gray-400 block mb-1">Tamanho do Elenco</span>
          <p className="text-2xl font-black text-white">{players.length} / 24</p>
          <span className="text-[10px] text-gray-500 mt-1 block">
            Jogadores contratados no time
          </span>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <span className="text-xs font-semibold text-gray-400 block mb-1">
            Rating Médio do Time
          </span>
          <p className="text-2xl font-black text-[#f59e0b]">⭐ {avgRating}</p>
          <span className="text-[10px] text-gray-500 mt-1 block">
            Força média do time principal
          </span>
        </div>
      </div>

      {/* Mural de Notícias do Mercado */}
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
            {/* Manchete Principal (Destaque) */}
            <div className="lg:col-span-3 p-5 rounded-2xl bg-gradient-to-br from-white/[0.02] to-white/[0.05] border border-white/5 hover:border-white/10 transition-all duration-300 flex flex-col justify-between min-h-[260px]">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                    news[0].category === 'transfer' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    news[0].category === 'stage' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    news[0].category === 'finance' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                    news[0].category === 'auction' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                    'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  }`}>
                    {news[0].category === 'transfer' ? 'Transferência' :
                     news[0].category === 'stage' ? 'Fase da Liga' :
                     news[0].category === 'finance' ? 'Financeiro' :
                     news[0].category === 'auction' ? 'Leilão' : 'Comunicado'}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {new Date(news[0].created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  {news[0].badge_url && (
                    <img src={news[0].badge_url} alt="" className="w-16 h-16 object-contain bg-white/5 rounded-xl p-2 border border-white/10 flex-shrink-0 animate-pulse" />
                  )}
                  {news[0].player_face_url && !news[0].badge_url && (
                    <img src={news[0].player_face_url} alt="" className="w-16 h-16 object-cover bg-white/5 rounded-full border border-white/10 flex-shrink-0" />
                  )}
                  <div className="space-y-1">
                    <h3 className="text-base sm:text-lg font-extrabold text-white leading-tight">
                      {news[0].title}
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed pt-1">
                      {news[0].content}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/5 pt-4 mt-4 flex justify-between items-center text-[10px] text-gray-500">
                <span>Fontes oficiais do campeonato</span>
                <span className="font-semibold text-gray-400 flex items-center gap-1">
                  🟢 Notícias em Tempo Real
                </span>
              </div>
            </div>

            {/* Outras Notícias (Lista Rápida) */}
            <div className="lg:col-span-2 space-y-3 max-h-[260px] overflow-y-auto pr-1">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Últimas Manchetes</h3>
              {news.slice(1).length === 0 ? (
                <p className="text-gray-500 text-xs italic">Aguardando mais movimentações no mercado...</p>
              ) : (
                news.slice(1).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all flex items-start gap-3 duration-200"
                  >
                    {item.badge_url ? (
                      <img src={item.badge_url} alt="" className="w-8 h-8 object-contain bg-white/5 rounded p-1 border border-white/5 flex-shrink-0" />
                    ) : item.player_face_url ? (
                      <img src={item.player_face_url} alt="" className="w-8 h-8 object-cover bg-white/5 rounded-full border border-white/5 flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-sm flex-shrink-0">📰</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-white leading-snug truncate">{item.title}</p>
                      <p className="text-[10px] text-gray-400 leading-snug line-clamp-1 mt-0.5">{item.content}</p>
                      <span className="text-[9px] text-gray-500 block mt-1">
                        {new Date(item.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controle de Abas */}
      <div className="flex border-b border-white/5 gap-2 mt-4">
        <button
          onClick={() => setActiveTab("squad")}
          className={`px-6 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "squad"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          📋 Elenco & Tática
        </button>
        <button
          onClick={() => setActiveTab("finances")}
          className={`px-6 py-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "finances"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          💵 Finanças & Fluxo de Caixa
        </button>
      </div>

      {activeTab === "squad" && (
        <>
          {/* Campo Visual Tático */}
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Esquema Tático</h2>
            <p className="text-xs text-gray-400">
              Arraste jogadores do banco ou da lista para escalar.{" "}
              {savingEscalation && (
                <span className="text-[#10b981] animate-pulse">Salvando...</span>
              )}
            </p>
          </div>
          <div>
            <select
              value={team.formation || "4-3-3"}
              onChange={(e) => handleFormationChange(e.target.value)}
              disabled={savingFormation}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#10b981]"
            >
              <option value="4-3-3" className="bg-[#090d16] text-white">
                4-3-3
              </option>
              <option value="4-4-2" className="bg-[#090d16] text-white">
                4-4-2
              </option>
              <option value="4-2-3-1" className="bg-[#090d16] text-white">
                4-2-3-1
              </option>
              <option value="3-5-2" className="bg-[#090d16] text-white">
                3-5-2
              </option>
              <option value="3-4-3" className="bg-[#090d16] text-white">
                3-4-3
              </option>
              <option value="5-3-2" className="bg-[#090d16] text-white">
                5-3-2
              </option>
            </select>
          </div>
        </div>

        {players.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            Adicione jogadores para visualizar a escalação tática do seu clube.
          </div>
        ) : (
          /* Campo de Futebol */
          <div
            className="relative w-full max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-emerald-900/60"
            style={{
              aspectRatio: "3/4",
              background:
                "repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 40px), linear-gradient(180deg, #0a3d1a 0%, #0d4d22 25%, #0a3d1a 50%, #0d4d22 75%, #0a3d1a 100%)",
            }}
          >
            {/* Linhas do Campo */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Borda do campo */}
              <div className="absolute inset-[5%] border border-white/20 rounded-sm" />
              {/* Linha do Meio de Campo */}
              <div className="absolute top-1/2 left-[5%] right-[5%] h-px bg-white/20" />
              {/* Círculo Central */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-white/20 rounded-full" />
              {/* Ponto Central */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/40 rounded-full" />
              {/* Grande Área Superior (Ataque) */}
              <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[48%] h-[16%] border-b border-x border-white/15" />
              {/* Pequena Área Superior */}
              <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[24%] h-[7%] border-b border-x border-white/10" />
              {/* Grande Área Inferior (Goleiro) */}
              <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2 w-[48%] h-[16%] border-t border-x border-white/15" />
              {/* Pequena Área Inferior */}
              <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2 w-[24%] h-[7%] border-t border-x border-white/10" />
              {/* Arco do Goleiro */}
              <div
                className="absolute bottom-[21%] left-1/2 -translate-x-1/2 w-20 h-10 border-t border-x border-white/10 rounded-t-full"
                style={{ borderRadius: "50% 50% 0 0" }}
              />
            </div>

            {/* Mapeamento de Jogadores */}
            {fieldPlayers.map((slot, index) => {
              const isHovered = dragOverSlot === index;
              const isDraggingActive = draggingPlayer !== null;

              return (
                <div
                  key={index}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverSlot(index);
                  }}
                  onDragLeave={() => setDragOverSlot(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingPlayer) handleDropPlayerOnSlot(draggingPlayer, index);
                    setDraggingPlayer(null);
                    setDragOverSlot(null);
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center select-none group"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                >
                  {slot.player ? (
                    /* Card do Jogador (Mini FUT) */
                    <div
                      draggable
                      onDragStart={(e) => {
                        setDraggingPlayer(slot.player);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDraggingPlayer(null);
                        setDragOverSlot(null);
                      }}
                      onDoubleClick={() => handleRemovePlayerFromSlot(index)}
                      className={`flex flex-col items-center animate-fadeIn relative cursor-grab active:cursor-grabbing transition-all duration-200 ${
                        draggingPlayer?.id === slot.player?.id ? "opacity-40" : "opacity-100"
                      }`}
                    >
                      <div
                        className={`relative h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-[#090d16]/90 flex items-center justify-center overflow-hidden shadow-lg transition-all duration-200 ${
                          isHovered
                            ? "border-2 border-[#10b981] scale-110 shadow-[0_0_12px_#10b981aa]"
                            : "border border-white/20 group-hover:scale-105 group-hover:border-[#10b981]/50"
                        }`}
                      >
                        {/* Rating Badge */}
                        <span className="absolute top-1 left-1.5 text-[10px] font-black bg-[#060913]/85 rounded px-1 leading-none shadow-sm z-10 text-[#10b981]">
                          {slot.player.rating}
                        </span>
                        {/* Position Badge */}
                        <span className="absolute bottom-1 right-1 text-[8px] font-bold text-gray-300 bg-[#060913]/85 rounded px-1 leading-none uppercase z-10">
                          {slot.title}
                        </span>
                        {slot.player.face_url ? (
                          <img
                            src={slot.player.face_url}
                            alt={slot.player.name}
                            className="h-full w-full object-cover scale-110"
                            draggable={false}
                          />
                        ) : (
                          <span className="text-xl">👤</span>
                        )}
                      </div>

                      {/* Nome do Jogador */}
                      <span className="mt-1 text-[10px] font-bold text-white bg-[#060913]/95 border border-white/10 rounded px-1.5 py-0.5 truncate max-w-[80px] shadow text-center leading-none">
                        {slot.player.name.split(" ").slice(-1)[0]}
                      </span>
                    </div>
                  ) : (
                    /* Slot Vazio */
                    <div
                      className={`flex flex-col items-center transition-all duration-200 ${
                        isDraggingActive
                          ? isHovered
                            ? "opacity-100 scale-110"
                            : "opacity-70"
                          : "opacity-45 hover:opacity-75"
                      }`}
                    >
                      <div
                        className={`h-14 w-14 sm:h-16 sm:w-16 rounded-xl flex flex-col items-center justify-center transition-all duration-200 ${
                          isHovered
                            ? "bg-[#10b981]/20 border-2 border-[#10b981] shadow-[0_0_12px_#10b981aa] animate-pulse"
                            : "bg-white/5 border border-dashed border-white/25"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-gray-300">{slot.title}</span>
                        {isDraggingActive && !isHovered && (
                          <span className="text-[7px] text-gray-500 mt-0.5">SOLTAR</span>
                        )}
                        {isHovered && (
                          <span className="text-[7px] text-[#10b981] font-bold mt-0.5">
                            AQUI ✓
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Banco de Reservas */}
        {players.length > 0 && (
          <div className="border-t border-white/5 pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                Banco de Reservas ({benchPlayers.length})
              </h3>
              {draggingPlayer && (
                <span className="text-[10px] text-[#10b981] animate-pulse">
                  ← Arraste para um slot do campo
                </span>
              )}
            </div>
            {benchPlayers.length === 0 ? (
              <p className="text-xs text-gray-500">
                Todos os jogadores estão escalados no time titular.
              </p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {benchPlayers.map((player) => (
                  <div
                    key={player.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggingPlayer(player);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggingPlayer(null);
                      setDragOverSlot(null);
                    }}
                    title={`${player.name} — Arraste para escalar`}
                    className={`glass-card flex-shrink-0 w-20 p-2.5 rounded-xl border border-white/5 flex flex-col items-center justify-between text-center bg-[#090d16]/30 relative cursor-grab active:cursor-grabbing transition-all hover:border-[#10b981]/30 hover:bg-white/5 ${
                      draggingPlayer?.id === player.id ? "opacity-40" : "opacity-100"
                    }`}
                  >
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-extrabold text-[#10b981] bg-[#060913]/80 px-1 rounded leading-none">
                      {player.rating}
                    </span>
                    <span className="absolute top-1.5 right-1.5 text-[7px] font-bold text-gray-400 uppercase bg-[#060913]/80 px-1 rounded leading-none">
                      {player.position}
                    </span>

                    <div className="h-11 w-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden mt-3 mb-1">
                      {player.face_url ? (
                        <img
                          src={player.face_url}
                          alt=""
                          className="h-full w-full object-cover scale-110"
                          draggable={false}
                        />
                      ) : (
                        <span className="text-lg">👤</span>
                      )}
                    </div>

                    <p className="text-[9px] font-bold text-white truncate w-full text-center leading-tight">
                      {player.name.split(" ").slice(-1)[0]}
                    </p>
                    <p className="text-[7px] text-gray-500 mt-0.5">arrastar ↑</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista do Elenco Agrupado */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-6">
        <div className="border-b border-white/5 pb-4">
          <h2 className="text-lg font-bold text-white">Elenco do Clube</h2>
          <p className="text-xs text-gray-400">
            Jogadores organizados por setor tático. Arraste para o campo para escalar.
          </p>
        </div>

        {players.length === 0 ? (
          <div className="py-16 text-center">
            <span className="text-4xl block mb-2">🏃‍♂️</span>
            <p className="text-sm text-gray-400 mb-4">
              Seu elenco está vazio. Comece a contratar atletas livres!
            </p>
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
      </>
      )}

      {/* Aba de Finanças e Fluxo de Caixa */}
      {activeTab === "finances" && (
        <div className="space-y-6">
          {/* Resumo Financeiro da Temporada */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Receitas Totais */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#090d16]/75">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Receitas Acumuladas</span>
              <p className="text-xl font-black text-emerald-400">
                R$ {calculateFinancialTotals().income.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <div className="text-[10px] text-gray-400 mt-2 space-y-1">
                <div className="flex justify-between"><span>Patrocínios:</span><span className="font-semibold text-white">R$ {calculateFinancialTotals().sponsors.toLocaleString("pt-BR")}</span></div>
                <div className="flex justify-between"><span>Bônus/Prêmios:</span><span className="font-semibold text-white">R$ {calculateFinancialTotals().rewards.toLocaleString("pt-BR")}</span></div>
                <div className="flex justify-between"><span>Vendas de Jogadores:</span><span className="font-semibold text-white">R$ {calculateFinancialTotals().sales.toLocaleString("pt-BR")}</span></div>
              </div>
            </div>

            {/* Despesas Totais */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#090d16]/75">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Despesas Acumuladas</span>
              <p className="text-xl font-black text-red-400">
                R$ {calculateFinancialTotals().expense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <div className="text-[10px] text-gray-400 mt-2 space-y-1">
                <div className="flex justify-between"><span>Folhas Salariais:</span><span className="font-semibold text-white">R$ {calculateFinancialTotals().salaries.toLocaleString("pt-BR")}</span></div>
                <div className="flex justify-between"><span>Compras/Multas Pagas:</span><span className="font-semibold text-white">R$ {calculateFinancialTotals().signings.toLocaleString("pt-BR")}</span></div>
                <div className="flex justify-between"><span>Multas de Indisciplina:</span><span className="font-semibold text-white">R$ {calculateFinancialTotals().fines.toLocaleString("pt-BR")}</span></div>
              </div>
            </div>

            {/* Saldo Líquido da Temporada */}
            <div className="glass-panel p-5 rounded-2xl border border-white/5 bg-[#090d16]/75 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Balanço Líquido (Fluxo)</span>
                <p className={`text-2xl font-black ${calculateFinancialTotals().income - calculateFinancialTotals().expense >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  R$ {(calculateFinancialTotals().income - calculateFinancialTotals().expense).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <span className="text-[9px] text-gray-500 mt-2">
                Saldo do fluxo líquido financeiro da temporada atual.
              </span>
            </div>
          </div>

          {/* Gráficos de Fluxo Dinâmicos SVG */}
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#090d16]/75 grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            {/* Gráfico Comparativo SVG */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Comparativo Receitas vs Despesas</h4>
              <div className="h-44 w-full flex items-end gap-12 justify-center pb-4 border-b border-white/5 relative">
                {/* Linhas de Grade de fundo */}
                <div className="absolute inset-x-0 bottom-4 border-b border-white/5"></div>
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-b border-white/5"></div>
                <div className="absolute inset-x-0 top-4 border-b border-white/5"></div>

                {/* Coluna Receitas */}
                <div className="flex flex-col items-center gap-2 z-10 w-20">
                  <div
                    className="w-full bg-[#10b981]/80 hover:bg-[#10b981] rounded-t-lg transition-all duration-700 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    style={{
                      height: `${Math.max(10, Math.min(100, (calculateFinancialTotals().income / Math.max(1, calculateFinancialTotals().income + calculateFinancialTotals().expense)) * 140))}px`
                    }}
                  ></div>
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Receitas</span>
                </div>

                {/* Coluna Despesas */}
                <div className="flex flex-col items-center gap-2 z-10 w-20">
                  <div
                    className="w-full bg-red-500/80 hover:bg-red-500 rounded-t-lg transition-all duration-700 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                    style={{
                      height: `${Math.max(10, Math.min(100, (calculateFinancialTotals().expense / Math.max(1, calculateFinancialTotals().income + calculateFinancialTotals().expense)) * 140))}px`
                    }}
                  ></div>
                  <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Despesas</span>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 text-center">Visão comparativa simplificada de fluxo</p>
            </div>

            {/* Detalhamento do Caixa em SVG */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Detalhamento dos Recursos</h4>
              <div className="space-y-3 pt-2">
                {/* Salários */}
                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Folhas de Elenco (Despesa)</span>
                    <span>R$ {calculateFinancialTotals().salaries.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2">
                    <div className="bg-red-400 h-full rounded-full" style={{ width: `${Math.min(100, (calculateFinancialTotals().salaries / Math.max(1, calculateFinancialTotals().expense)) * 100)}%` }}></div>
                  </div>
                </div>

                {/* Contratações */}
                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Contratações de Jogadores (Despesa)</span>
                    <span>R$ {calculateFinancialTotals().signings.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2">
                    <div className="bg-orange-400 h-full rounded-full" style={{ width: `${Math.min(100, (calculateFinancialTotals().signings / Math.max(1, calculateFinancialTotals().expense)) * 100)}%` }}></div>
                  </div>
                </div>

                {/* Patrocínios */}
                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Rendas de Patrocinadores (Receita)</span>
                    <span>R$ {calculateFinancialTotals().sponsors.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2">
                    <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${Math.min(100, (calculateFinancialTotals().sponsors / Math.max(1, calculateFinancialTotals().income)) * 100)}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Extrato Financeiro */}
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#090d16]/75 space-y-4 text-left">
            <h3 className="text-base font-bold text-white">🧾 Extrato Financeiro do Clube</h3>
            {financialHistory.length === 0 ? (
              <p className="text-gray-500 text-xs py-4 text-center">Nenhuma transação financeira registrada para este clube.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#090d16]/20">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/5 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Data</th>
                      <th className="py-2.5 px-4">Tipo</th>
                      <th className="py-2.5 px-4">Transação / Histórico</th>
                      <th className="py-2.5 px-4 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {financialHistory.map((tx) => {
                      const isIncome = tx.to_team_id === team.id;
                      return (
                        <tr key={tx.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-2.5 px-4 text-gray-500">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                              tx.transfer_type === 'salary_charge' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                              tx.transfer_type === 'sponsorship' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              tx.transfer_type === 'reward' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              isIncome ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {tx.transfer_type === 'salary_charge' ? 'Folha Salarial' :
                               tx.transfer_type === 'sponsorship' ? 'Patrocínio' :
                               tx.transfer_type === 'reward' ? 'Premiação' :
                               tx.transfer_type === 'fine' ? 'Multa' :
                               isIncome ? 'Venda de Jogador' : 'Compra de Jogador'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4">
                            <p className="font-semibold text-white">{tx.player_name || 'Transação do Clube'}</p>
                            <p className="text-[10px] text-gray-500">
                              {isIncome ? `Recebido de: ${tx.from_team_name || 'Liga'}` : `Pago para: ${tx.to_team_name || 'Liga'}`}
                            </p>
                          </td>
                          <td className={`py-2.5 px-4 text-right font-extrabold ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isIncome ? '+' : '-'} R$ {parseFloat(tx.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Ajuste Salarial */}
      {showSalaryModal && selectedPlayerForSalary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-sm p-6 rounded-2xl border border-white/10 bg-[#090d16]/95 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  💰 Ajustar Salário
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Digite o salário que o jogador terá.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowSalaryModal(false);
                  setSalaryError("");
                  setSalarySuccess("");
                }}
                className="text-gray-400 hover:text-white text-xs bg-white/5 px-2.5 py-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {!salaryWindowOpen && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 mb-4 flex items-start gap-2">
                <span className="text-sm">🔒</span>
                <div>
                  <strong className="block font-bold">Janela de Ajuste Fechada</strong>
                  O período para os times ajustarem salários de forma livre está encerrado. Consulte o administrador.
                </div>
              </div>
            )}

            {/* Info do Jogador */}
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedPlayerForSalary.face_url ? (
                  <img
                    src={selectedPlayerForSalary.face_url}
                    alt=""
                    className="h-full w-full object-cover scale-110"
                  />
                ) : (
                  <span className="text-xl">👤</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-[#10b981]">
                    {selectedPlayerForSalary.rating}
                  </span>
                  <span className="text-xs font-bold text-white">
                    {selectedPlayerForSalary.name}
                  </span>
                </div>
                <span className="text-[9px] text-gray-400 uppercase">
                  {selectedPlayerForSalary.position}
                </span>
              </div>
            </div>

            {/* Tabela de Dados */}
            <div className="divide-y divide-white/5 rounded-xl overflow-hidden border border-white/5 mb-4">
              <div className="flex justify-between items-center px-4 py-2.5 bg-white/[0.02]">
                <span className="text-[10px] text-gray-400">Dono</span>
                <span className="text-[10px] font-semibold text-white">{team.name}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5">
                <span className="text-[10px] text-gray-400">Salário Atual</span>
                <span className="text-[10px] font-semibold text-emerald-400">
                  R$ {selectedPlayerForSalary.wage.toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5 bg-white/[0.02]">
                <span className="text-[10px] text-gray-400">Passe Atual</span>
                <span className="text-[10px] font-semibold text-blue-400">
                  R${" "}
                  {parseFloat(selectedPlayerForSalary.value).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[10px] font-semibold text-gray-400 block mb-1">
                  Novo Salário (R$)
                </label>
                <input
                  type="number"
                  value={newSalary}
                  onChange={(e) => setNewSalary(e.target.value)}
                  placeholder={salaryWindowOpen ? "Ex: 50000" : "Ajuste desativado"}
                  disabled={!salaryWindowOpen || savingSalary}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#10b981] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="flex justify-between items-center px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[10px] text-gray-400">
                  Novo Passe{" "}
                  <span className="text-gray-600">(× {salaryRatio})</span>
                </span>
                <span className="text-[10px] font-semibold text-blue-400">
                  R$ {calculatedValue}
                </span>
              </div>
              <p className="text-[9px] text-gray-500">
                O passe é calculado automaticamente pelo ratio definido pelo ADM.
              </p>
            </div>

            {salaryError && (
              <p className="text-[10px] text-red-400 mb-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                ⚠️ {salaryError}
              </p>
            )}
            {salarySuccess && (
              <p className="text-[10px] text-emerald-400 mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                ✅ {salarySuccess}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSalaryModal(false);
                  setSalaryError("");
                  setSalarySuccess("");
                }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 py-2.5 text-xs font-bold text-gray-300 transition-all"
              >
                Fechar
              </button>
              <button
                onClick={handleSalaryAdjust}
                disabled={savingSalary || !newSalary || !salaryWindowOpen}
                className="flex-1 rounded-xl bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 disabled:cursor-not-allowed py-2.5 text-xs font-bold text-white transition-all"
              >
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
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                🔨 Enviar para Leilão
              </h3>
              <button
                onClick={() => {
                  setShowAuctionModal(false);
                  setAuctionError("");
                  setAuctionSuccess("");
                }}
                className="text-gray-400 hover:text-white text-xs bg-white/5 px-2.5 py-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Info do Jogador */}
            <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedPlayerForAuction.face_url ? (
                  <img
                    src={selectedPlayerForAuction.face_url}
                    alt=""
                    className="h-full w-full object-cover scale-110"
                  />
                ) : (
                  <span className="text-xl">👤</span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-amber-400">
                    {selectedPlayerForAuction.rating}
                  </span>
                  <span className="text-xs font-bold text-white">
                    {selectedPlayerForAuction.name}
                  </span>
                </div>
                <span className="text-[9px] text-gray-400 uppercase">
                  {selectedPlayerForAuction.position}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-300 mb-3">
              Tem certeza que deseja colocar{" "}
              <strong className="text-white">{selectedPlayerForAuction.name}</strong> em leilão?
            </p>
            <p className="text-[10px] text-gray-500 mb-5 p-3 bg-white/[0.02] rounded-xl border border-white/5">
              ℹ️ O jogador só estará pronto para receber lances quando o administrador liberar a
              temporada de leilão.
            </p>

            {auctionError && (
              <p className="text-[10px] text-red-400 mb-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                ⚠️ {auctionError}
              </p>
            )}
            {auctionSuccess && (
              <p className="text-[10px] text-emerald-400 mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                ✅ {auctionSuccess}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAuctionModal(false);
                  setAuctionError("");
                  setAuctionSuccess("");
                }}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 py-2.5 text-xs font-bold text-gray-300 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitAuction}
                disabled={savingAuction}
                className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 text-xs font-bold text-white transition-all"
              >
                {savingAuction ? "Enviando..." : "SIM, enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Perfil de Jogador */}
      {showProfileModal && selectedPlayerForProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-white/10 bg-[#090d16]/95 shadow-2xl overflow-hidden animate-scaleIn flex flex-col max-h-[90vh]">
            {/* Header com Foto de Destaque */}
            <div className="relative p-6 bg-gradient-to-b from-[#10b981]/15 to-transparent border-b border-white/5 flex gap-4 items-center">
              <div className="h-16 w-16 rounded-full bg-white/5 border border-[#10b981]/30 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-lg">
                {selectedPlayerForProfile.face_url ? (
                  <img src={selectedPlayerForProfile.face_url} alt="" className="h-full w-full object-cover scale-110" />
                ) : (
                  <span className="text-3xl">👤</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-white">{selectedPlayerForProfile.name}</span>
                  <span className="px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] font-bold text-xs">
                    {selectedPlayerForProfile.rating}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-wider">
                  {selectedPlayerForProfile.position} • {selectedPlayerForProfile.age || '--'} anos • {selectedPlayerForProfile.nation || 'Nacionalidade N/A'}
                </p>
              </div>
              <button
                onClick={() => { setShowProfileModal(false); setSelectedPlayerForProfile(null); }}
                className="text-gray-400 hover:text-white text-xs bg-white/5 hover:bg-white/10 rounded-lg px-2.5 py-1"
              >
                ✕
              </button>
            </div>

            {/* Abas / Conteúdo */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* Informações Básicas do Jogador */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-white/5 bg-white/[0.01]">
                  <span className="text-[10px] text-gray-500 block">Salário</span>
                  <p className="text-sm font-bold text-emerald-400 mt-0.5">
                    R$ {parseFloat(selectedPlayerForProfile.wage || 0).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-white/5 bg-white/[0.01]">
                  <span className="text-[10px] text-gray-500 block">Passe de Mercado</span>
                  <p className="text-sm font-bold text-blue-400 mt-0.5">
                    R$ {parseFloat(selectedPlayerForProfile.value || 0).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              {/* Histórico de Estatísticas na Liga */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">📊 Histórico na Liga Master</h4>
                {loadingStats ? (
                  <div className="py-8 text-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#10b981] border-t-transparent mx-auto"></div>
                  </div>
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
