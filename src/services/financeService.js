import { supabase } from "@/lib/supabase";
import { assertMutationsAllowed } from "@/lib/maintenance";

export const financeService = {
  /**
   * Busca as transações financeiras de um time
   */
  async getTransactionsByTeamId(teamId, limit = 50) {
    const { data, error } = await supabase
      .from("financial_transactions")
      .select("id, team_id, counterparty_team_id, amount, balance_before, balance_after, transaction_type, reference_type, reference_id, description, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  /**
   * Deposita saldo manualmente (admin)
   */
  async depositFunds(teamId, amount, description) {
    assertMutationsAllowed();
    const { data, error } = await supabase.rpc("admin_adjust_team_budget", {
      p_team_id: teamId,
      p_amount: Number(amount),
      p_description: description || "Ajuste manual de saldo",
    });
    if (error) throw error;
    return data;
  }
};
