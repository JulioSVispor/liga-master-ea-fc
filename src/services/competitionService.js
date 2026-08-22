import { assertMutationsAllowed } from "@/lib/maintenance";

export const competitionService = {
  async replaceLeagueSchedule(supabase, leagueId, fixtures) {
    assertMutationsAllowed();
    if (!leagueId || !Array.isArray(fixtures) || fixtures.length === 0) {
      throw new Error("Calendário inválido.");
    }

    const { data, error } = await supabase.rpc("replace_league_schedule", {
      p_league_id: leagueId,
      p_fixtures: fixtures.map((fixture) => ({
        home_team_id: fixture.homeTeamId,
        away_team_id: fixture.awayTeamId,
        round_number: fixture.roundNumber,
      })),
    });

    if (error) throw error;
    if (data?.success === false) throw new Error(data.message || "Não foi possível gerar o calendário.");
    return data;
  },
};
