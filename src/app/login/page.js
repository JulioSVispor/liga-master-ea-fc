"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // Login bem-sucedido, redirecionar para o painel principal
      router.push("/dashboard");
    } catch (err) {
      setError("Ocorreu um erro ao tentar entrar. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#060913] py-12 px-6 lg:px-8 relative overflow-hidden">
      {/* Luzes de fundo decorativas */}
      <div className="absolute top-1/4 left-1/4 -z-10 h-72 w-72 rounded-full bg-[#10b981]/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 -z-10 h-72 w-72 rounded-full bg-[#3b82f6]/10 blur-3xl" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-[#10b981] to-[#3b82f6] bg-clip-text text-transparent">
          LIGA MASTER
        </Link>
        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-white">
          Acesse sua conta
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="glass-panel py-8 px-6 shadow-2xl rounded-2xl border border-white/5 bg-[#090d16]/75">
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
              {error === "Invalid login credentials" ? "E-mail ou senha incorretos." : error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                E-mail
              </label>
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
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Senha
                </label>
                <div className="text-sm">
                  <Link href="/forgot-password" className="font-semibold text-[#10b981] hover:text-[#059669] transition-colors">
                    Esqueceu a senha?
                  </Link>
                </div>
              </div>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder-gray-500 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-all text-sm outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-xl bg-[#10b981] hover:bg-[#059669] py-3 px-4 text-sm font-semibold text-white shadow-lg transition-all duration-250 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? "Entrando..." : "Entrar"}
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
