import { supabase } from "@/lib/supabase";
import { assertMutationsAllowed } from "@/lib/maintenance";

export const playerService = {
  /**
   * Busca os jogadores de um time
   */
  async getPlayersByTeamId(teamId) {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("team_id", teamId)
      .order("rating", { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Contrata jogador livre (via RPC)
   */
  async buyFreeAgent(playerId) {
    assertMutationsAllowed();
    const { data, error } = await supabase.rpc("buy_free_agent", {
      p_player_id: playerId,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Paga a multa rescisória (via RPC)
   */
  async buyPlayerViaBuyout(playerId) {
    assertMutationsAllowed();
    const { data, error } = await supabase.rpc("buy_player_via_buyout", {
      p_player_id: playerId,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Busca jogadores no banco de dados aplicando filtros e paginação (usado no Scouting)
   */
  async searchPlayers({ search, position, minRating, maxRating, availability, page, itemsPerPage }) {
    let query = supabase
      .from("players")
      .select("*, teams!team_id(name)", { count: "exact" });

    // Aplicar Filtro de Busca por Nome
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    // Aplicar Filtro de Posição
    if (position !== "ALL") {
      query = query.eq("position", position);
    }

    // Aplicar Filtro de Over/Rating
    query = query.gte("rating", minRating).lte("rating", maxRating);

    // Aplicar Filtro de Disponibilidade
    if (availability === "FREE") {
      query = query.is("team_id", null);
    } else if (availability === "OWNED") {
      query = query.not("team_id", "is", null);
    }

    // Ordenar por Rating decrescente por padrão
    query = query.order("rating", { ascending: false });

    // Paginação
    const from = (page - 1) * itemsPerPage;
    const to = from + itemsPerPage - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;

    return { players: data || [], totalCount: count || 0 };
  }
};
