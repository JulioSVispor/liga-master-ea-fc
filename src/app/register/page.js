"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Register() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [realClubName, setRealClubName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);

    try {
      // 1. Cadastrar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData?.user) {
        setError("Ocorreu um erro ao registrar o usuário.");
        setLoading(false);
        return;
      }

      // 2. Garantir que a linha de perfis (profiles) exista antes de criar o time
      const userId = authData.user.id;

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (!existingProfile) {
        // Criar perfil manualmente como fallback caso o trigger do banco não tenha rodado ainda
        const { error: profileError } = await supabase.from("profiles").insert([
          {
            id: userId,
            email: email,
            display_name: displayName,
            role: "user",
          },
        ]);

        if (profileError) {
          setError("Erro ao sincronizar perfil do participante: " + profileError.message);
          setLoading(false);
          return;
        }
      }

      // 3. Criar o time associado ao usuário
      const { error: teamError } = await supabase.from("teams").insert([
        {
          user_id: userId,
          name: teamName,
          real_club_name: realClubName,
          budget: 50000000.00, // Orçamento inicial padrão: R$ 50M
          max_wage_cap: 15000.00, // Teto salarial de R$ 15k
        },
      ]);

      if (teamError) {
        // Se falhar ao criar o time, exibimos o erro, mas o login ainda pode ser efetuado
        setError("Usuário criado, mas houve um erro ao registrar seu time: " + teamError.message);
        setLoading(false);
        return;
      }

      // Registro completo! Redirecionar para o login ou direto para o painel
      // O Supabase às vezes exige confirmação de e-mail (se configurado).
      // Se não exigir, o login automático é feito. Vamos para a página de login com sucesso.
      alert("Cadastro realizado com sucesso! Faça login para gerenciar seu time.");
      router.push("/login");
    } catch (err) {
      setError("Ocorreu um erro inesperado. Tente novamente.");
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
          Registre seu Time na Liga
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="glass-panel py-8 px-6 shadow-2xl rounded-2xl border border-white/5 bg-[#090d16]/75">
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleRegister}>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-300">
                  Nome do Participante (Seu Nome)
                </label>
                <div className="mt-1">
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder-gray-500 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-all text-sm outline-none"
                    placeholder="Ex: João Silva"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                  E-mail
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder-gray-500 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-all text-sm outline-none"
                    placeholder="joao@email.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="teamName" className="block text-sm font-medium text-gray-300">
                  Nome do seu Clube na Liga
                </label>
                <div className="mt-1">
                  <input
                    id="teamName"
                    name="teamName"
                    type="text"
                    required
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder-gray-500 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-all text-sm outline-none"
                    placeholder="Ex: Real da Massa"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="realClubName" className="block text-sm font-medium text-gray-300">
                  Clube Real (Correspondente EA FC 26)
                </label>
                <div className="mt-1">
                  <input
                    id="realClubName"
                    name="realClubName"
                    type="text"
                    required
                    value={realClubName}
                    onChange={(e) => setRealClubName(e.target.value)}
                    className="block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder-gray-500 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-all text-sm outline-none"
                    placeholder="Ex: Real Madrid"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Senha
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder-gray-500 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-all text-sm outline-none"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
                  Confirmar Senha
                </label>
                <div className="mt-1">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full rounded-xl border border-white/10 bg-white/5 py-3 px-4 text-white placeholder-gray-500 focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-all text-sm outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-xl bg-[#10b981] hover:bg-[#059669] py-3 px-4 text-sm font-semibold text-white shadow-lg transition-all duration-250 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? "Registrando..." : "Finalizar Cadastro"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-400">Já tem uma conta cadastrada? </span>
            <Link href="/login" className="font-semibold text-[#3b82f6] hover:text-blue-400 transition-colors">
              Fazer login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
