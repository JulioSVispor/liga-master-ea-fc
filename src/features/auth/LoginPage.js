"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const AUTH_ERRORS = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "Email not confirmed": "Confirme seu e-mail antes de entrar.",
  "Too many requests": "Muitas tentativas. Aguarde alguns minutos.",
  "User not found": "Nenhuma conta encontrada com este e-mail.",
};

function translateError(msg) {
  for (const [key, translation] of Object.entries(AUTH_ERRORS)) {
    if (msg?.includes(key)) return translation;
  }
  return msg || "Ocorreu um erro ao tentar entrar. Tente novamente.";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (cooldown) return;
    setError("");
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(translateError(authError.message));
        setCooldown(true);
        setTimeout(() => setCooldown(false), 3000);
        setLoading(false);
        return;
      }

      // Verificar se o usuário tem time cadastrado
      const { data: teamData } = await supabase
        .from("teams")
        .select("id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      router.push(teamData ? "/dashboard" : "/dashboard");
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
        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-white">Acesse sua conta</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="glass-panel py-8 px-6 shadow-2xl rounded-2xl border border-white/5 bg-[#090d16]/75">
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form noValidate className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">E-mail</label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder-gray-500 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-all text-sm outline-none"
                  placeholder="exemplo@email.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">Senha</label>
                <Link href="/forgot-password" className="text-sm font-semibold text-[#10b981] hover:text-[#059669] transition-colors">
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 pr-11 text-white placeholder-gray-500 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-all text-sm outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || cooldown}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10b981] hover:bg-[#059669] py-3 px-4 text-sm font-semibold text-white shadow-lg transition-all duration-250 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Entrando...
                  </>
                ) : cooldown ? (
                  "Aguarde..."
                ) : (
                  "Entrar"
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-400">Novo na Liga Master? </span>
            <Link href="/register" className="font-semibold text-[#3b82f6] hover:text-blue-400 transition-colors">
              Registre seu time
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
