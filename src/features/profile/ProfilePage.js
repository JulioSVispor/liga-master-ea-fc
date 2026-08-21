"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { isStrongPassword } from "@/lib/auth/password-policy";

// ─── Tooltip ℹ️ ─────────────────────────────────
function Tooltip({ content }) {
  const [visible, setVisible] = useState(false);
  return (
    <span 
      className="relative inline-block ml-1 cursor-pointer group text-gray-500 hover:text-white select-none z-10"
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

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("profile"); // 'profile' | 'security' | 'team'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" }); // type: 'success' | 'error'

  // Form states
  const [displayName, setDisplayName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [team, setTeam] = useState(null);
  const [teamName, setTeamName] = useState("");
  const [realClubName, setRealClubName] = useState("");
  const [formation, setFormation] = useState("4-3-3");
  const [badgeUrl, setBadgeUrl] = useState("");
  const [uniformUrl, setUniformUrl] = useState("");
  const [achievements, setAchievements] = useState([]);

  useEffect(() => {
    async function loadUserData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        setEmail(session.user.email);

        // Load profile
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (profile) {
          setDisplayName(profile.display_name || "");
          setWhatsapp(profile.whatsapp || "");
        }

        // Load team
        const { data: teamData } = await supabase
          .from("teams")
          .select("*")
          .eq("user_id", session.user.id)
          .single();

        if (teamData) {
          setTeam(teamData);
          setTeamName(teamData.name || "");
          setRealClubName(teamData.real_club_name || "");
          setFormation(teamData.formation || "4-3-3");
          setBadgeUrl(teamData.badge_url || "");
          setUniformUrl(teamData.uniform_url || "");

          // Load achievements
          const { data: achievementsData } = await supabase
            .from("achievements")
            .select("*")
            .eq("team_id", teamData.id)
            .order("created_at", { ascending: false });

          if (achievementsData) {
            setAchievements(achievementsData);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados do usuário:", err);
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, []);

  const showMessage = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 5000);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.rpc("update_own_profile", {
        p_display_name: displayName,
        p_avatar_url: null,
        p_whatsapp: whatsapp,
      });

      if (error) throw error;
      showMessage("Perfil atualizado com sucesso!");
    } catch (err) {
      showMessage(err.message || "Erro ao atualizar perfil.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showMessage("As senhas não coincidem!", "error");
      return;
    }
    if (!isStrongPassword(newPassword)) {
      showMessage("A senha deve ter 8 ou mais caracteres, com letras e números.", "error");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
      showMessage("Senha atualizada com sucesso!");
    } catch (err) {
      showMessage(err.message || "Erro ao atualizar senha.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTeam = async (e) => {
    e.preventDefault();
    if (!team) return;

    setSaving(true);
    try {
      const { error: profileError } = await supabase.rpc("update_team_profile", {
        p_name: teamName,
        p_real_club_name: realClubName,
        p_badge_url: badgeUrl || null,
        p_uniform_url: uniformUrl || null,
      });
      if (profileError) throw profileError;
      const { error } = await supabase.rpc("update_team_tactics", {
        p_formation: formation,
        p_lineup: Array.isArray(team.lineup) ? team.lineup : [],
      });

      if (error) throw error;
      
      // Update local team state to reflect changes
      setTeam({ ...team, name: teamName, real_club_name: realClubName, formation: formation, badge_url: badgeUrl, uniform_url: uniformUrl });
      showMessage("Informações do time atualizadas com sucesso!");
    } catch (err) {
      showMessage(err.message || "Erro ao atualizar time.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#10b981] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Configurações da Conta
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Gerencie suas informações de perfil, segurança da conta e detalhes do seu clube.
        </p>
      </div>

      {/* Alerta de Feedback */}
      {message.text && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-2 animate-fadeIn transition-all ${
            message.type === "error"
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          <span>{message.type === "error" ? "⚠️" : "✅"}</span>
          {message.text}
        </div>
      )}

      {/* Menu das Abas */}
      <div className="flex border-b border-white/5 gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("profile")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "profile"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white hover:border-white/10"
          }`}
        >
          <span>👤</span> Meu Perfil
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "security"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white hover:border-white/10"
          }`}
        >
          <span>🔒</span> Segurança
        </button>
        <button
          onClick={() => setActiveTab("team")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "team"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white hover:border-white/10"
          }`}
        >
          <span>🛡️</span> Meu Time
        </button>
        <button
          onClick={() => setActiveTab("achievements")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "achievements"
              ? "border-[#10b981] text-[#10b981]"
              : "border-transparent text-gray-400 hover:text-white hover:border-white/10"
          }`}
        >
          <span>🏆</span> Conquistas & Títulos
        </button>
      </div>

      {/* Conteúdo das Abas */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#090d16]/75">
        {activeTab === "profile" && (
          <form noValidate onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <h2 className="text-lg font-bold text-white">Informações Pessoais</h2>
              <p className="text-xs text-gray-400">Esses dados serão exibidos para os outros membros da liga.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-300">E-mail (Login)</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-gray-400 cursor-not-allowed focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-300">
                  Nome de Exibição / Treinador
                  <Tooltip content="O nome visível para outros participantes da liga na tabela e histórico de transferências." />
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  placeholder="Seu nome"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-300">
                  WhatsApp (Opcional)
                  <Tooltip content="Seu telefone de contato. Facilita que outros participantes da liga negociem diretamente com você via WhatsApp." />
                </label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ex: (11) 99999-9999"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-6 py-2.5 text-xs font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </form>
        )}

        {activeTab === "security" && (
          <form noValidate onSubmit={handleUpdatePassword} className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <h2 className="text-lg font-bold text-white">Alterar Senha</h2>
              <p className="text-xs text-gray-400">Garanta a segurança da sua conta definindo uma senha forte.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-300">Nova Senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-300">Confirmar Nova Senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repita a senha"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-6 py-2.5 text-xs font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? "Atualizando..." : "Atualizar Senha"}
              </button>
            </div>
          </form>
        )}

        {activeTab === "team" && (
          <form noValidate onSubmit={handleUpdateTeam} className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <h2 className="text-lg font-bold text-white">Configurações do Clube</h2>
              <p className="text-xs text-gray-400">Ajuste a identidade visual e tática do seu time na liga.</p>
            </div>

            {!team ? (
              <div className="text-center py-10">
                <span className="text-3xl block mb-2">⚠️</span>
                <p className="text-sm text-gray-400">Você ainda não tem um time associado à sua conta.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 lg:col-span-2">
                    <label className="text-xs font-semibold text-gray-300">
                      Nome do Clube
                      <Tooltip content="O nome do seu time na liga (ex: Real Madrid)." />
                    </label>
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      required
                      placeholder="Ex: Real Madrid"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-300">
                      URL do Escudo (Badge)
                      <Tooltip content="Link direto da imagem para o brasão/escudo do seu clube." />
                    </label>
                    <input
                      type="url"
                      value={badgeUrl}
                      onChange={(e) => setBadgeUrl(e.target.value)}
                      placeholder="https://exemplo.com/escudo.png"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                    />
                  </div>
                </div>

                {/* Preview de Escudo */}
                {badgeUrl && (
                  <div className="mt-6 p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-3">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pré-visualização do Escudo</h3>
                    <div className="flex gap-6 items-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-16 h-16 rounded-xl bg-black/20 flex items-center justify-center border border-white/5 overflow-hidden p-2">
                          <img src={badgeUrl} alt="Escudo Time" className="max-w-full max-h-full object-contain" onError={(e) => e.target.style.display = 'none'} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-[#10b981] hover:bg-[#059669] px-6 py-2.5 text-xs font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {saving ? "Salvando..." : "Salvar Time"}
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {activeTab === "achievements" && (
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <h2 className="text-lg font-bold text-white">Galeria de Conquistas & Títulos</h2>
              <p className="text-xs text-gray-400">Os momentos gloriosos e taças levantadas pelo seu clube na história da liga.</p>
            </div>

            {!team ? (
              <div className="text-center py-10">
                <span className="text-3xl block mb-2">⚠️</span>
                <p className="text-sm text-gray-400">Você ainda não tem um time associado à sua conta.</p>
              </div>
            ) : achievements.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
                <span className="text-4xl block mb-3">🏆</span>
                <h3 className="text-sm font-bold text-white mb-1">Nenhum título conquistado ainda</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Sua sala de troféus está vazia. Entre em campo, lidere seu time e conquiste a glória eterna na Liga Master!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className="p-4 rounded-xl border border-white/5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] hover:border-emerald-500/20 transition-all group flex items-start gap-4"
                  >
                    <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                      {achievement.icon || "🏆"}
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                        {achievement.title}
                      </h4>
                      <p className="text-xs text-gray-400">{achievement.season_name}</p>
                      <p className="text-[10px] text-gray-500">
                        {new Date(achievement.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
