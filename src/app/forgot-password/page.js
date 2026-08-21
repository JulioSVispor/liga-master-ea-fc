"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { supabase } from "@/lib/supabase";

const GENERIC_SUCCESS = "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Informe o e-mail da sua conta.");
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError("Não foi possível enviar o link agora. Aguarde alguns minutos e tente novamente.");
        return;
      }

      setMessage(GENERIC_SUCCESS);
    } catch {
      setError("Não foi possível enviar o link agora. Aguarde alguns minutos e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#060913] px-6 py-12">
      <section className="w-full max-w-md" aria-labelledby="forgot-password-title">
        <div className="text-center">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-white">
            LIGA <span className="text-[#10b981]">MASTER</span>
          </Link>
          <h1 id="forgot-password-title" className="mt-6 text-2xl font-bold tracking-tight text-white">
            Recupere sua senha
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            Informe seu e-mail para receber as instruções de recuperação.
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-[#090d16] px-6 py-8">
          {error && (
            <p className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm leading-6 text-emerald-300" role="status">
              {message}
            </p>
          )}

          <form noValidate className="space-y-6" onSubmit={handleResetPassword}>
            <FormField label="E-mail da conta" required htmlFor="email">
              {(accessibilityProps) => (
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="block min-h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25"
                  placeholder="voce@email.com"
                  {...accessibilityProps}
                />
              )}
            </FormField>

            <Button type="submit" busy={loading} busyLabel="Enviando link…" className="w-full">
              Enviar link de recuperação
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <Link href="/login" className="font-semibold text-[#3b82f6] transition-colors hover:text-blue-300">
              Voltar para o login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
