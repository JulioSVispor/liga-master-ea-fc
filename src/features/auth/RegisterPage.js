"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [realClubName, setRealClubName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) { setError("As senhas não coincidem."); return; }
    if (password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres."); return; }

    setLoading(true);

    try {
      // 1. Validar whitelist via Server Action (nunca expõe a tabela ao browser)
      const validateRes = await fetch("/api/auth/validate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const validateData = await validateRes.json();

      if (!validateData.allowed) {
        const messages = {
          not_found: "Este e-mail não está autorizado a participar da liga. Entre em contato com o administrador.",
          already_used: "Este e-mail já possui uma conta cadastrada na liga.",
          server_error: "Erro ao verificar autorização. Tente novamente.",
        };
        setError(messages[validateData.reason] || "E-mail não autorizado.");
        setLoading(false);
        return;
      }

      // 2. Cadastrar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });

      if (authError) { setError(authError.message); setLoading(false); return; }
      if (!authData?.user) { setError("Ocorreu um erro ao registrar o usuário."); setLoading(false); return; }

      const userId = authData.user.id;

      // 3. Garantir que o perfil existe
      const { data: existingProfile } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (!existingProfile) {
        const { error: profileError } = await supabase.from("profiles").insert([{ id: userId, email, display_name: displayName, role: "user" }]);
        if (profileError) { setError("Erro ao sincronizar perfil: " + profileError.message); setLoading(false); return; }
      }

      // 4. Criar o time
      const { error: teamError } = await supabase.from("teams").insert([{
        user_id: userId,
        name: teamName,
        real_club_name: realClubName,
        budget: 50000000.00,
        max_wage_cap: 15000.00,
      }]);

      if (teamError) { setError("Usuário criado, mas houve erro ao registrar o time: " + teamError.message); setLoading(false); return; }

      // 5. Marcar e-mail como usado na whitelist
      await fetch("/api/auth/mark-email-used", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      alert("Cadastro realizado com sucesso! Faça login para gerenciar seu time.");
      router.push("/login");
    } catch (err) {
      setError("Ocorreu um erro inesperado. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#060913] py-12 px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 -z-10 h-72 w-72 rounded-full bg-[#10b981]/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-72 w-72 rounded-full bg-[#3b82f6]/10 blur-3xl" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#10b981] to-[#3b82f6] bg-clip-text text-transparent">
          LIGA MASTER
        </Link>
        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-white">Registre seu Time na Liga</h2>
        <p className="mt-2 text-sm text-gray-400">Acesso disponível apenas para participantes convidados.</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="glass-panel py-8 px-6 shadow-2xl rounded-2xl border border-white/5 bg-[#090d16]/75">
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleRegister}>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {[
                { id: "displayName", label: "Nome do Participante", value: displayName, setter: setDisplayName, placeholder: "Ex: João Silva" },
                { id: "email", label: "E-mail", value: email, setter: setEmail, placeholder: "joao@email.com", type: "email" },
                { id: "teamName", label: "Nome do Clube na Liga", value: teamName, setter: setTeamName, placeholder: "Ex: Real da Massa" },
                { id: "realClubName", label: "Clube EA FC", value: realClubName, setter: setRealClubName, placeholder: "Ex: Real Madrid" },
              ].map(({ id, label, value, setter, placeholder, type }) => (
                <div key={id}>
                  <label htmlFor={id} className="block text-sm font-medium text-gray-300">{label}</label>
                  <div className="mt-1">
                    <input
                      id={id}
                      name={id}
                      type={type || "text"}
                      required
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder-gray-500 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-all text-sm outline-none"
                      placeholder={placeholder}
                    />
                  </div>
                </div>
              ))}

              {[
                { id: "password", label: "Senha", value: password, setter: setPassword, placeholder: "Mínimo 6 caracteres" },
                { id: "confirmPassword", label: "Confirmar Senha", value: confirmPassword, setter: setConfirmPassword, placeholder: "••••••••" },
              ].map(({ id, label, value, setter, placeholder }) => (
                <div key={id}>
                  <label htmlFor={id} className="block text-sm font-medium text-gray-300">{label}</label>
                  <div className="mt-1 relative">
                    <input
                      id={id}
                      name={id}
                      type={showPassword ? "text" : "password"}
                      required
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 pr-11 text-white placeholder-gray-500 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-all text-sm outline-none"
                      placeholder={placeholder}
                    />
                    {id === "password" && (
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1" tabIndex={-1}>
                        {showPassword ? "🙈" : "👁️"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10b981] hover:bg-[#059669] py-3 px-4 text-sm font-semibold text-white shadow-lg transition-all duration-250 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Registrando...</>
                ) : "Finalizar Cadastro"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-400">Já tem uma conta? </span>
            <Link href="/login" className="font-semibold text-[#3b82f6] hover:text-blue-400 transition-colors">Fazer login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
