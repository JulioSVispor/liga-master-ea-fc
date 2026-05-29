"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada.");

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          whatsapp: whatsapp,
        })
        .eq("id", session.user.id);

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
    if (newPassword.length < 6) {
      showMessage("A senha deve ter pelo menos 6 caracteres.", "error");
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
      const { error } = await supabase
        .from("teams")
        .update({
          name: teamName,
          real_club_name: realClubName,
          formation: formation,
        })
        .eq("id", team.id);

      if (error) throw error;
      
      // Update local team state to reflect changes
      setTeam({ ...team, name: teamName, real_club_name: realClubName, formation: formation });
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
      </div>

      {/* Conteúdo das Abas */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#090d16]/75">
        {activeTab === "profile" && (
          <form onSubmit={handleUpdateProfile} className="space-y-6">
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
                <label className="text-xs font-semibold text-gray-300">Nome de Exibição / Treinador</label>
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
                <label className="text-xs font-semibold text-gray-300">WhatsApp (Opcional)</label>
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
          <form onSubmit={handleUpdatePassword} className="space-y-6">
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
          <form onSubmit={handleUpdateTeam} className="space-y-6">
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
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-300">Nome do Time (Personalizado)</label>
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      required
                      placeholder="Ex: Real Vispor FC"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-300">Time do EA FC 26 Correspondente</label>
                    <input
                      type="text"
                      value={realClubName}
                      onChange={(e) => setRealClubName(e.target.value)}
                      required
                      placeholder="Ex: Real Madrid, Arsenal..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-300">Formação Tática Padrão</label>
                    <select
                      value={formation}
                      onChange={(e) => setFormation(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#10b981] transition-colors"
                    >
                      <option value="4-3-3" className="bg-[#090d16] text-white">4-3-3 (Padrão)</option>
                      <option value="4-4-2" className="bg-[#090d16] text-white">4-4-2</option>
                      <option value="4-2-3-1" className="bg-[#090d16] text-white">4-2-3-1</option>
                      <option value="3-5-2" className="bg-[#090d16] text-white">3-5-2</option>
                      <option value="3-4-3" className="bg-[#090d16] text-white">3-4-3</option>
                      <option value="5-3-2" className="bg-[#090d16] text-white">5-3-2</option>
                      <option value="5-2-1-2" className="bg-[#090d16] text-white">5-2-1-2</option>
                    </select>
                  </div>
                </div>

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
      </div>
    </div>
  );
}
