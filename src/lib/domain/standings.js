export function createEmptyStanding(teamId) {
  return {
    teamId,
    points: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalsDifference: 0,
  };
}

export function rebuildStandings(teamIds, matches) {
  const table = new Map(teamIds.map((teamId) => [teamId, createEmptyStanding(teamId)]));

  for (const match of matches) {
    if (match.status !== "confirmed") continue;
    if (!Number.isInteger(match.homeScore) || !Number.isInteger(match.awayScore)) continue;
    if (match.homeScore < 0 || match.awayScore < 0) continue;

    const home = table.get(match.homeTeamId);
    const away = table.get(match.awayTeamId);
    if (!home || !away || home.teamId === away.teamId) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
    } else if (match.homeScore < match.awayScore) {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  for (const standing of table.values()) {
    standing.goalsDifference = standing.goalsFor - standing.goalsAgainst;
  }

  return [...table.values()].sort(compareStandings);
}

export function compareStandings(left, right) {
  return (
    right.points - left.points ||
    right.goalsDifference - left.goalsDifference ||
    right.goalsFor - left.goalsFor ||
    String(left.teamId).localeCompare(String(right.teamId), "pt-BR")
  );
}
