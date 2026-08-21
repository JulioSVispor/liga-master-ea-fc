import { describe, expect, it } from "vitest";
import { isStrongPassword } from "./password-policy";

describe("isStrongPassword", () => {
  it("aceita oito ou mais caracteres com letras e números", () => {
    expect(isStrongPassword("Liga2026")).toBe(true);
  });

  it.each(["curta1", "apenasletras", "12345678", ""])("rejeita %s", (password) => {
    expect(isStrongPassword(password)).toBe(false);
  });
});
