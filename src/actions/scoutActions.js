"use server";

import { assertMutationsAllowed } from "@/lib/maintenance";
import { requireAuthenticatedUser } from "@/lib/supabase/server-auth";

export async function toggleShortlist(playerId) {
  assertMutationsAllowed();
  const normalizedPlayerId = Number(playerId);
  if (!Number.isSafeInteger(normalizedPlayerId) || normalizedPlayerId <= 0 || normalizedPlayerId > 2_147_483_647) {
    throw new Error("Jogador inválido.");
  }

  const { supabase } = await requireAuthenticatedUser();
  const { data, error } = await supabase.rpc("toggle_shortlist", {
    p_player_id: normalizedPlayerId,
  });
  if (error) throw new Error(error.message || "Não foi possível atualizar a lista.");
  return data;
}

export async function getShortlistedPlayerIds() {
  const { supabase, user } = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from("shortlists")
    .select("player_id")
    .eq("user_id", user.id);

  if (error || !data) return [];
  return data.map(s => s.player_id);
}
