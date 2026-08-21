import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useDashboardData() {
  // 1. Buscar configurações
  const { data: settings = {}, isLoading: settingsLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("key, value");
      if (error) throw error;
      const map = {};
      data.forEach((s) => (map[s.key] = s.value));
      return map;
    },
  });

  // 2. Buscar notícias
  const { data: news = [], isLoading: newsLoading } = useQuery({
    queryKey: ["market_news"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_news")
        .select("*, teams!team_id(name)")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  // 3. Buscar Dados do Clube (Equipe e Jogadores)
  const { data: clubData = null, isLoading: clubLoading, refetch: refetchClub } = useQuery({
    queryKey: ["club_data"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("id, name, real_club_name, badge_url, budget, max_wage_cap, formation, lineup")
        .eq("user_id", session.user.id)
        .single();
      
      if (teamError) throw teamError;
      if (!teamData) return null;

      const { data: players, error: playersError } = await supabase
        .from("players")
        .select("id, name, common_name, rating, potential, position, face_url, wage, value, nation, age, playstyles, playstyles_plus")
        .eq("team_id", teamData.id)
        .order("rating", { ascending: false });

      if (playersError) throw playersError;

      // Histórico financeiro básico do clube
      const { data: financialHistory, error: finError } = await supabase
        .from("transfer_history")
        .select("*")
        .or(`from_team_id.eq.${teamData.id},to_team_id.eq.${teamData.id}`)
        .order("created_at", { ascending: false });

      return {
        team: teamData,
        players: players || [],
        financialHistory: financialHistory || [],
      };
    },
  });

  const isLoading = settingsLoading || newsLoading || clubLoading;

  return {
    settings,
    news,
    team: clubData?.team || null,
    players: clubData?.players || [],
    financialHistory: clubData?.financialHistory || [],
    isLoading,
    refetchClub,
  };
}
