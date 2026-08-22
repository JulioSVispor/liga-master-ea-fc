"use server";

import { assertMutationsAllowed } from "@/lib/maintenance";
import { requireAdmin } from "@/lib/supabase/server-auth";

export async function applyWalkover(matchId, winnerType) {
  assertMutationsAllowed();
  if (typeof matchId !== "string" || !["home", "away"].includes(winnerType)) {
    throw new Error("Dados de W.O. inválidos.");
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("apply_walkover", {
    p_match_id: matchId,
    p_winner_type: winnerType,
    p_reason: "W.O. aplicado pela arbitragem",
  });

  if (error) throw new Error(error.message || "Não foi possível aplicar o W.O.");
  if (data?.success === false) throw new Error(data.message || "Não foi possível aplicar o W.O.");
  return data;
}
