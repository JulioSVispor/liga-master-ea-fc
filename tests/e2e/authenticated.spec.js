import { expect, test } from "@playwright/test";

test.skip(process.env.E2E_AUTH_FIXTURE !== "true", "Requer o simulador local de Auth.");

async function signIn(page, role) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(`${role}@e2e.example`);
  await page.getByLabel("Senha", { exact: true }).fill("Test-password-123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("treinador mantém a sessão após recarregar e recebe 403 no painel administrativo", async ({ page }) => {
  await signIn(page, "user");
  const dashboard = await page.reload();
  expect(dashboard.status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);

  const admin = await page.goto("/admin");
  expect(admin.status()).toBe(403);
  await expect(page.getByRole("heading", { name: "Painel de Controle" })).toHaveCount(0);
});

for (const role of ["admin", "master"]) {
  test(`${role} entra no painel administrativo com uma sessão do navegador`, async ({ page }) => {
    await signIn(page, role);
    const response = await page.goto("/admin");
    expect(response.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Painel de Controle" })).toBeVisible();
  });
}

test("código PKCE de recuperação habilita a troca de senha", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("E-mail").fill("user@e2e.example");
  const recovery = page.waitForResponse((response) => new URL(response.url()).pathname === "/auth/v1/recover");
  await page.getByRole("button", { name: /enviar/i }).click();
  expect((await recovery).ok()).toBe(true);
  await page.goto("/reset-password?code=recovery-code");
  await expect(page.getByRole("button", { name: "Alterar senha" })).toBeVisible();
  await expect(page).toHaveURL(/\/reset-password$/);
});

test("sessão comum não habilita a troca de senha sem o verificador de recuperação", async ({ page }) => {
  await signIn(page, "user");
  await page.goto("/reset-password?code=recovery-code");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Este link é inválido ou expirou");
  await expect(page.getByRole("button", { name: "Alterar senha" })).toHaveCount(0);
});
