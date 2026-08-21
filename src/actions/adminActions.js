"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {}
        }
      }
    }
  );
}

export async function applyWalkover(matchId, winnerType) {
  // winnerType: "home", "away", "double"
  const supabase = await getSupabase();
  
  // 1. Validar Sessão Admin
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (!profile || profile.role !== "admin") throw new Error("Acesso negado.");

  // 2. Buscar dados da partida e liga
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (matchError || !match) throw new Error("Partida não encontrada.");

  // 3. Preparar a atualização
  let updates = {
    status: "confirmed",
  };

  if (winnerType === "home") {
    updates.home_score = 3;
    updates.away_score = 0;
  } else if (winnerType === "away") {
    updates.home_score = 0;
    updates.away_score = 3;
  } else if (winnerType === "double") {
    updates.home_score = 0;
    updates.away_score = 0;
  }

  const { error: updateError } = await supabase
    .from("matches")
    .update(updates)
    .eq("id", matchId);

  if (updateError) throw new Error("Erro ao atualizar o placar.");

  // 4. Registrar na Auditoria (Nova Tabela do Master Plan)
  await supabase.from("audit_logs").insert([{
    admin_id: session.user.id,
    action_type: "APPLY_WO",
    entity_name: "matches",
    entity_id: matchId,
    details: { winner: winnerType, updates }
  }]);

  // OBS: Aqui a trigger "trg_update_league_standings" do PostgreSQL (que já existe no projeto) 
  // vai ser disparada automaticamente pois o status mudou para 'confirmed'.

  return { success: true, message: "W.O. aplicado com sucesso pelo Assistente." };
}
