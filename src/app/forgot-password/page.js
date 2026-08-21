"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setMessage("E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada.");
      setLoading(false);
    } catch (err) {
      setError("Ocorreu um erro ao tentar recuperar a senha. Tente novamente.");
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
          Recupere sua senha
        </h2>
        <p className="mt-2 text-center text-sm text-gray-400">
          Insira seu e-mail abaixo e enviaremos um link de recuperação.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="glass-panel py-8 px-6 shadow-2xl rounded-2xl border border-white/5 bg-[#090d16]/75">
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-sm text-emerald-400">
              {message}
            </div>
          )}

          <form noValidate className="space-y-6" onSubmit={handleResetPassword}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                E-mail da sua conta
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
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-xl bg-[#10b981] hover:bg-[#059669] py-3 px-4 text-sm font-semibold text-white shadow-lg transition-all duration-250 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? "Enviando..." : "Enviar Link de Recuperação"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm">
            <Link href="/login" className="font-semibold text-[#3b82f6] hover:text-blue-400 transition-colors">
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
