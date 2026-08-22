"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { READ_ONLY_MODE } from "@/lib/maintenance";
import { isStrongPassword } from "@/lib/auth/password-policy";

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

    if (READ_ONLY_MODE) {
      setError("O cadastro está pausado durante a manutenção programada.");
      return;
    }
    if (password !== confirmPassword) { setError("As senhas não coincidem."); return; }
    if (!isStrongPassword(password)) {
      setError("A senha deve ter pelo menos 8 caracteres, incluindo letras e números.");
      return;
    }

    setLoading(true);

    try {
      // O hook Before User Created é a autoridade da whitelist. Um pré-check
      // separado criava enumeração de convites e uma janela de corrida.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            team_name: teamName.trim(),
            real_club_name: realClubName.trim(),
          },
        },
      });

      if (authError) {
        setError("Não foi possível concluir o cadastro. Confira os dados ou fale com a administração da liga.");
        setLoading(false);
        return;
      }
      if (!authData?.user) { setError("Ocorreu um erro ao registrar o usuário."); setLoading(false); return; }

      // Perfil, clube e consumo do convite são criados atomicamente pelo trigger.
      router.push("/login?cadastro=confirmar-email");
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

          <form noValidate className="space-y-6" onSubmit={handleRegister}>
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
                { id: "password", label: "Senha", value: password, setter: setPassword, placeholder: "8+ caracteres, letras e números" },
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
                      <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-gray-400 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                        aria-label={showPassword ? "Ocultar senhas" : "Mostrar senhas"}
                      >
                        {showPassword ? "Ocultar" : "Mostrar"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || READ_ONLY_MODE}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10b981] hover:bg-[#059669] py-3 px-4 text-sm font-semibold text-white shadow-lg transition-all duration-250 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Registrando...</>
                ) : READ_ONLY_MODE ? "Cadastro temporariamente pausado" : "Finalizar Cadastro"}
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
