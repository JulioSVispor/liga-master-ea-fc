function normalizeTeam(team) {
  const id = typeof team === "string" ? team : team?.id;
  if (typeof id !== "string" || id.trim() === "") {
    throw new TypeError("Cada clube precisa ter um identificador válido.");
  }
  return id;
}

export function generateRoundRobinFixtures(teams, { doubleRound = false } = {}) {
  if (!Array.isArray(teams)) {
    throw new TypeError("A lista de clubes precisa ser um array.");
  }

  const teamIds = teams.map(normalizeTeam);
  if (teamIds.length < 2) {
    throw new RangeError("São necessários pelo menos dois clubes.");
  }
  if (new Set(teamIds).size !== teamIds.length) {
    throw new RangeError("A liga não pode conter o mesmo clube mais de uma vez.");
  }

  const rotation = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, null];
  const roundsPerLeg = rotation.length - 1;
  const matchesPerRound = rotation.length / 2;
  const firstLeg = [];

  for (let roundIndex = 0; roundIndex < roundsPerLeg; roundIndex += 1) {
    for (let pairIndex = 0; pairIndex < matchesPerRound; pairIndex += 1) {
      const left = rotation[pairIndex];
      const right = rotation[rotation.length - 1 - pairIndex];
      if (left === null || right === null) continue;

      const swapHome = (roundIndex + pairIndex) % 2 === 1;
      firstLeg.push({
        homeTeamId: swapHome ? right : left,
        awayTeamId: swapHome ? left : right,
        roundNumber: roundIndex + 1,
      });
    }

    rotation.splice(1, 0, rotation.pop());
  }

  if (!doubleRound) return firstLeg;

  return [
    ...firstLeg,
    ...firstLeg.map((fixture) => ({
      homeTeamId: fixture.awayTeamId,
      awayTeamId: fixture.homeTeamId,
      roundNumber: fixture.roundNumber + roundsPerLeg,
    })),
  ];
}
