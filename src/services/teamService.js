import { supabase } from "@/lib/supabase";

export const teamService = {
  /**
   * Busca o time de um usuário pelo seu ID
   */
  async getTeamByUserId(userId) {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("user_id", userId)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return data;
  },

  /**
   * Busca um time pelo ID
   */
  async getTeamById(teamId) {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("id", teamId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Lista todos os times
   */
  async getAllTeams() {
    const { data, error } = await supabase
      .from("team_directory")
      .select("id, name, real_club_name, badge_url, uniform_url, coach_name")
      .order("name", { ascending: true });

    if (error) throw error;
    return data;
  }
};
