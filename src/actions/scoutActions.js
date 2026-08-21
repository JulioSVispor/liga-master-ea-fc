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

export async function toggleShortlist(playerId) {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) throw new Error("Não autenticado");

  const userId = session.user.id;

  // Verifica se já está na shortlist
  const { data: existing } = await supabase
    .from("shortlists")
    .select("id")
    .eq("user_id", userId)
    .eq("player_id", playerId)
    .single();

  if (existing) {
    // Se existe, remove
    const { error } = await supabase
      .from("shortlists")
      .delete()
      .eq("id", existing.id);
      
    if (error) throw new Error("Erro ao remover da lista");
    return { added: false };
  } else {
    // Se não existe, adiciona
    const { error } = await supabase
      .from("shortlists")
      .insert([{ user_id: userId, player_id: playerId }]);
      
    if (error) throw new Error("Erro ao adicionar à lista");
    return { added: true };
  }
}

export async function getShortlistedPlayerIds() {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from("shortlists")
    .select("player_id")
    .eq("user_id", session.user.id);

  if (error || !data) return [];
  return data.map(s => s.player_id);
}
