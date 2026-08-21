import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function useTeamFinancials(teamId) {
  const [wageSum, setWageSum] = useState(0);
  const [wageCapPercent, setWageCapPercent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFinancials() {
      if (!teamId) return;
      
      setLoading(true);
      try {
        const { data: teamData, error: teamError } = await supabase
          .from("teams")
          .select("max_wage_cap")
          .eq("id", teamId)
          .single();
          
        if (teamError) throw teamError;

        const { data: players, error: playersError } = await supabase
          .from("players")
          .select("wage")
          .eq("team_id", teamId);
          
        if (playersError) throw playersError;

        const totalWages = players ? players.reduce((sum, p) => sum + parseFloat(p.wage || 0), 0) : 0;
        setWageSum(totalWages);
        
        const cap = parseFloat(teamData?.max_wage_cap || 0);
        const pct = cap > 0 ? Math.min(Math.round((totalWages / cap) * 100), 100) : 0;
        setWageCapPercent(pct);
      } catch (err) {
        console.error("Erro ao carregar finanças do time:", err);
      } finally {
        setLoading(false);
      }
    }
    
    loadFinancials();
  }, [teamId]);

  return { wageSum, wageCapPercent, loading };
}
