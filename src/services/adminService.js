function unwrap(result, fallbackMessage) {
  if (result.error) {
    throw new Error(result.error.message || fallbackMessage);
  }
  return result.data;
}

export const adminService = {
  async updateSettings(client, settings) {
    return unwrap(
      await client.rpc("admin_update_settings", { p_settings: settings }),
      "Não foi possível salvar as configurações."
    );
  },

  async createSeason(client, name, activate = true) {
    return unwrap(
      await client.rpc("admin_create_season", { p_name: name, p_activate: activate }),
      "Não foi possível criar a temporada."
    );
  },

  async setSeasonStatus(client, seasonId, status) {
    return unwrap(
      await client.rpc("admin_set_season_status", { p_season_id: seasonId, p_status: status }),
      "Não foi possível alterar a temporada."
    );
  },

  async setMarketWindow(client, seasonId, open) {
    return unwrap(
      await client.rpc("admin_set_market_window", { p_season_id: seasonId, p_open: open }),
      "Não foi possível alterar a janela de mercado."
    );
  },

  async finishSeason(client, seasonId, force = false) {
    return unwrap(
      await client.rpc("admin_finish_season", { p_season_id: seasonId, p_force: force }),
      "Não foi possível finalizar a temporada."
    );
  },

  async createLeague(client, seasonId, name, division) {
    return unwrap(
      await client.rpc("admin_create_league", {
        p_season_id: seasonId,
        p_name: name,
        p_division: division,
      }),
      "Não foi possível criar a liga."
    );
  },

  async addTeamToLeague(client, leagueId, teamId) {
    return unwrap(
      await client.rpc("admin_add_team_to_league", { p_league_id: leagueId, p_team_id: teamId }),
      "Não foi possível adicionar o clube."
    );
  },

  async removeTeamFromLeague(client, leagueTeamId) {
    return unwrap(
      await client.rpc("admin_remove_team_from_league", { p_league_team_id: leagueTeamId }),
      "Não foi possível remover o clube."
    );
  },

  async moveTeamBetweenLeagues(client, teamId, sourceLeagueId, targetLeagueId) {
    return unwrap(
      await client.rpc("admin_move_team_between_leagues", {
        p_team_id: teamId,
        p_source_league_id: sourceLeagueId,
        p_target_league_id: targetLeagueId,
      }),
      "Não foi possível mover o clube."
    );
  },

  async setRoundRelease(client, scope) {
    return unwrap(
      await client.rpc("admin_set_round_release", {
        p_season_id: scope.seasonId,
        p_round_number: scope.roundNumber,
        p_released: scope.released,
        p_league_id: scope.leagueId ?? null,
        p_cup_name: scope.cupName ?? null,
      }),
      "Não foi possível alterar a rodada."
    );
  },

  async setUserRole(client, userId, role) {
    return unwrap(
      await client.rpc("admin_set_user_role", { p_user_id: userId, p_role: role }),
      "Não foi possível alterar o papel."
    );
  },

  async updateTeamFinancials(client, payload) {
    return unwrap(
      await client.rpc("admin_update_team_financials", {
        p_team_id: payload.teamId,
        p_budget: payload.budget,
        p_max_wage_cap: payload.maxWageCap,
        p_reason: payload.reason,
      }),
      "Não foi possível alterar os dados financeiros."
    );
  },

  async movePlayer(client, payload) {
    return unwrap(
      await client.rpc("admin_move_player", {
        p_player_id: payload.playerId,
        p_target_team_id: payload.targetTeamId ?? null,
        p_reason: payload.reason,
      }),
      "Não foi possível mover o jogador."
    );
  },

  async updatePlayerFinancials(client, payload) {
    return unwrap(
      await client.rpc("admin_update_player_financials", {
        p_player_id: payload.playerId,
        p_wage: payload.wage,
        p_value: payload.value,
        p_reason: payload.reason,
      }),
      "Não foi possível atualizar o jogador."
    );
  },

  async createCup(client, payload) {
    return unwrap(
      await client.rpc("admin_create_cup", {
        p_season_id: payload.seasonId,
        p_cup_name: payload.cupName,
        p_start_round: payload.startRound,
        p_team_ids: payload.teamIds,
      }),
      "Não foi possível criar a copa."
    );
  },

  async advanceCup(client, payload) {
    return unwrap(
      await client.rpc("admin_advance_cup", {
        p_season_id: payload.seasonId,
        p_cup_name: payload.cupName,
        p_current_round: payload.currentRound,
      }),
      "Não foi possível gerar a próxima fase."
    );
  },
};
