import { expect, test } from "@playwright/test";

test("exibe contenção e bloqueia cadastro", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("status")).toContainText("Manutenção programada");
  await expect(page.getByRole("button", { name: "Cadastro temporariamente pausado" })).toBeDisabled();
});

test("rota do treinador redireciona antes de renderizar sem sessão", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("rota administrativa não é renderizada sem sessão", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});
