"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import { isStrongPassword } from "@/lib/auth/password-policy";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const recoveryType = new URLSearchParams(window.location.hash.slice(1)).get("type");

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && event === "PASSWORD_RECOVERY" && session) setStatus("ready");
    });

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (active) {
        setStatus(!sessionError && data.session && recoveryType === "recovery" ? "ready" : "invalid");
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!isStrongPassword(password)) {
      setError("Use pelo menos 8 caracteres, com letras e números.");
      return;
    }

    if (password !== confirmation) {
      setError("As senhas informadas não são iguais.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("Não foi possível alterar a senha. Solicite um novo link e tente novamente.");
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setStatus("success");
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#060913] px-6 py-12">
      <section className="w-full max-w-md" aria-labelledby="reset-password-title">
        <div className="text-center">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-white">
            LIGA <span className="text-[#10b981]">MASTER</span>
          </Link>
          <h1 id="reset-password-title" className="mt-6 text-2xl font-bold tracking-tight text-white">
            Criar nova senha
          </h1>
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-[#090d16] px-6 py-8">
          {status === "checking" && (
            <div className="flex items-center justify-center gap-3 py-8 text-sm text-gray-400" role="status">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              Validando o link de recuperação…
            </div>
          )}

          {status === "invalid" && (
            <div className="space-y-5 text-center">
              <p className="text-sm leading-6 text-gray-300" role="alert">
                Este link é inválido ou expirou. Solicite uma nova recuperação de senha.
              </p>
              <Button className="w-full" onClick={() => window.location.assign("/forgot-password")}>
                Solicitar novo link
              </Button>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-5 text-center">
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300" role="status">
                Senha alterada com segurança. Entre novamente para continuar.
              </p>
              <Button className="w-full" onClick={() => window.location.assign("/login")}>
                Ir para o login
              </Button>
            </div>
          )}

          {status === "ready" && (
            <form noValidate className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300" role="alert">
                  {error}
                </p>
              )}

              <PasswordField
                id="new-password"
                name="password"
                label="Nova senha"
                hint="8+ caracteres"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <PasswordField
                id="confirm-password"
                name="password-confirmation"
                label="Confirmar nova senha"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />

              <Button type="submit" busy={loading} busyLabel="Alterando senha…" className="w-full">
                Alterar senha
              </Button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
