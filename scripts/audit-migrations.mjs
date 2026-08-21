import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import PgQuery from "pg-query-emscripten";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();
const failures = [];

function splitStatements(sql) {
  const statements = [];
  let start = 0;
  let state = "normal";
  let dollarTag = "";
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];
    if (state === "line-comment") { if (char === "\n") state = "normal"; continue; }
    if (state === "block-comment") { if (char === "*" && next === "/") { state = "normal"; index += 1; } continue; }
    if (state === "single") { if (char === "'" && next === "'") index += 1; else if (char === "'") state = "normal"; continue; }
    if (state === "double") { if (char === '"' && next === '"') index += 1; else if (char === '"') state = "normal"; continue; }
    if (state === "dollar") { if (sql.startsWith(dollarTag, index)) { index += dollarTag.length - 1; state = "normal"; } continue; }
    if (char === "-" && next === "-") { state = "line-comment"; index += 1; continue; }
    if (char === "/" && next === "*") { state = "block-comment"; index += 1; continue; }
    if (char === "'") { state = "single"; continue; }
    if (char === '"') { state = "double"; continue; }
    if (char === "$") {
      const tag = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0];
      if (tag) { dollarTag = tag; state = "dollar"; index += tag.length - 1; continue; }
    }
    if (char === ";") {
      const statement = sql.slice(start, index + 1).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }
  const tail = sql.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

for (const file of files) {
  const sql = await readFile(join(migrationsDirectory, file), "utf8");
  const fileParser = await new PgQuery();
  try {
    fileParser.parse(sql);
  } catch {
    const statements = splitStatements(sql);
    for (let index = 0; index < statements.length; index += 1) {
      const isolatedParser = await new PgQuery();
      try {
        isolatedParser.parse(statements[index]);
      } catch {
        const preview = statements[index].split(/\r?\n/).find((line) => line.trim() && !line.trim().startsWith("--"))?.trim();
        failures.push(`${file}: statement ${index + 1} inválido perto de "${preview}".`);
      }
    }
  }
  if (/\bdrop\s+table\b/i.test(sql)) failures.push(`${file}: DROP TABLE não é permitido em migrations de recuperação.`);
  if (/grant\s+execute[\s\S]{0,200}\bto\s+(?:public|anon)\b/i.test(sql)) {
    failures.push(`${file}: função executável por PUBLIC/anon.`);
  }
  const privilegedFunctions = [...sql.matchAll(/security\s+definer/gi)];
  for (const match of privilegedFunctions) {
    const neighborhood = sql.slice(match.index, match.index + 180);
    if (!/set\s+search_path\s*=\s*''/i.test(neighborhood)) {
      failures.push(`${file}: SECURITY DEFINER sem search_path vazio próximo da declaração.`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`${files.length} migrations auditadas sem padrões críticos.`);
}
