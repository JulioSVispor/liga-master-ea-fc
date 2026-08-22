import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const projectRoot = new URL("../", import.meta.url);
const baseUrl = "http://127.0.0.1:3000";
const shutdownToken = randomUUID();

function waitForExit(child) {
  return new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

async function waitForServer(child) {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`O servidor E2E encerrou antes de ficar pronto (${child.exitCode}).`);
    }

    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // O servidor ainda está iniciando.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Tempo esgotado ao iniciar o servidor E2E.");
}

const server = spawn(process.execPath, ["./scripts/start-e2e-server.mjs"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    E2E_SHUTDOWN_TOKEN: shutdownToken,
    NEXT_PUBLIC_READ_ONLY_MODE: "true",
    NODE_ENV: "production",
  },
  stdio: "inherit",
});

let testExitCode = 1;

try {
  await waitForServer(server);

  const runner = spawn(
    process.execPath,
    ["./node_modules/@playwright/test/cli.js", "test"],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        PLAYWRIGHT_EXTERNAL_SERVER: "true",
      },
      stdio: "inherit",
    },
  );

  const result = await waitForExit(runner);
  testExitCode = result.code ?? 1;
} finally {
  try {
    await fetch(`${baseUrl}/__e2e_shutdown`, {
      method: "POST",
      headers: { authorization: `Bearer ${shutdownToken}` },
    });
  } catch {
    // O processo já pode ter encerrado por falha própria.
  }

  if (server.exitCode === null) {
    await Promise.race([
      waitForExit(server),
      new Promise((resolve) => setTimeout(resolve, 6_000)),
    ]);
  }

  if (server.exitCode === null) server.kill();
}

process.exitCode = testExitCode;
