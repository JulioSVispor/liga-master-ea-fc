import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const skillAudit = join(
  homedir(), ".codex", "plugins", "cache", "openai-curated-remote",
  "frontend-design-premium", "1.4.0", "skills", "frontend-design-premium",
  "scripts", "audit_project.py"
);
const bundledPython = join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe");
const candidates = [process.env.PYTHON, existsSync(bundledPython) ? bundledPython : null, "python3", "python"].filter(Boolean);

for (const executable of candidates) {
  const result = spawnSync(executable, [skillAudit, ".", "--mode", "strict", "--no-write"], { stdio: "inherit" });
  if (!result.error) process.exit(result.status ?? 1);
}

console.error("Python não encontrado para executar a auditoria frontend-design-premium.");
process.exit(1);
