import { describe, expect, it } from "vitest";
import { rebuildStandings } from "./standings";

const confirmed = (homeTeamId, awayTeamId, homeScore, awayScore) => ({
  status: "confirmed",
  homeTeamId,
  awayTeamId,
  homeScore,
  awayScore,
});

describe("rebuildStandings", () => {
  it("calcula vitória, empate, derrota e gols sem acumular estado anterior", () => {
    const result = rebuildStandings(
      ["a", "b", "c"],
      [confirmed("a", "b", 2, 0), confirmed("b", "c", 1, 1)]
    );

    expect(result).toEqual([
      { teamId: "a", points: 3, played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 0, goalsDifference: 2 },
      { teamId: "b", points: 1, played: 2, won: 0, drawn: 1, lost: 1, goalsFor: 1, goalsAgainst: 3, goalsDifference: -2 },
      { teamId: "c", points: 1, played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 1, goalsAgainst: 1, goalsDifference: 0 },
    ].sort((left, right) => right.points - left.points || right.goalsDifference - left.goalsDifference));
  });

  it("ignora partidas pendentes e resultados inválidos", () => {
    const result = rebuildStandings(
      ["a", "b"],
      [
        { ...confirmed("a", "b", 3, 0), status: "pending" },
        confirmed("a", "b", -1, 0),
      ]
    );
    expect(result.every((row) => row.played === 0 && row.points === 0)).toBe(true);
  });

  it("usa saldo, gols pró e id como desempates determinísticos", () => {
    const result = rebuildStandings(
      ["c", "b", "a"],
      [confirmed("a", "b", 1, 0), confirmed("c", "a", 1, 0), confirmed("b", "c", 1, 0)]
    );
    expect(result.map((row) => row.teamId)).toEqual(["a", "b", "c"]);
  });

  it("reconstrói corretamente após alteração ou remoção de resultado", () => {
    const original = rebuildStandings(["a", "b"], [confirmed("a", "b", 3, 0)]);
    const changed = rebuildStandings(["a", "b"], [confirmed("a", "b", 0, 1)]);
    const removed = rebuildStandings(["a", "b"], []);

    expect(original[0]).toMatchObject({ teamId: "a", points: 3, goalsDifference: 3 });
    expect(changed[0]).toMatchObject({ teamId: "b", points: 3, goalsDifference: 1 });
    expect(removed.every((row) => row.played === 0)).toBe(true);
  });
});
