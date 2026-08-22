import { describe, expect, it } from "vitest";
import { generateRoundRobinFixtures } from "./round-robin";

function assertValidSchedule(teamIds, fixtures, expectedLegs = 1) {
  const expectedMatches = (teamIds.length * (teamIds.length - 1) * expectedLegs) / 2;
  expect(fixtures).toHaveLength(expectedMatches);

  const directionalPairs = new Set();
  const appearancesByRound = new Map();
  for (const fixture of fixtures) {
    expect(teamIds).toContain(fixture.homeTeamId);
    expect(teamIds).toContain(fixture.awayTeamId);
    expect(fixture.homeTeamId).not.toBe(fixture.awayTeamId);

    const directionalKey = `${fixture.homeTeamId}:${fixture.awayTeamId}`;
    expect(directionalPairs.has(directionalKey)).toBe(false);
    directionalPairs.add(directionalKey);

    const roundTeams = appearancesByRound.get(fixture.roundNumber) || new Set();
    expect(roundTeams.has(fixture.homeTeamId)).toBe(false);
    expect(roundTeams.has(fixture.awayTeamId)).toBe(false);
    roundTeams.add(fixture.homeTeamId);
    roundTeams.add(fixture.awayTeamId);
    appearancesByRound.set(fixture.roundNumber, roundTeams);
  }
}

describe("generateRoundRobinFixtures", () => {
  it.each([2, 3, 4, 5, 10])("gera turno único matematicamente válido para %i clubes", (count) => {
    const teamIds = Array.from({ length: count }, (_, index) => `team-${index + 1}`);
    assertValidSchedule(teamIds, generateRoundRobinFixtures(teamIds));
  });

  it("gera returno com mandos invertidos", () => {
    const teamIds = ["a", "b", "c", "d"];
    const fixtures = generateRoundRobinFixtures(teamIds, { doubleRound: true });
    assertValidSchedule(teamIds, fixtures, 2);

    for (const fixture of fixtures.slice(0, fixtures.length / 2)) {
      expect(fixtures).toContainEqual({
        homeTeamId: fixture.awayTeamId,
        awayTeamId: fixture.homeTeamId,
        roundNumber: fixture.roundNumber + 3,
      });
    }
  });

  it("não altera o array recebido e rejeita clubes duplicados", () => {
    const teams = [{ id: "a" }, { id: "b" }, { id: "c" }];
    generateRoundRobinFixtures(teams);
    expect(teams).toHaveLength(3);
    expect(() => generateRoundRobinFixtures(["a", "a"])).toThrow(/mesmo clube/i);
  });
});
