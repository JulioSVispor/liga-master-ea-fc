import { createServer } from "node:http";
import { json } from "node:stream/consumers";

const fixtureOrigin = "http://127.0.0.1:54321";
const users = new Map(["user", "admin", "master"].map((role, index) => {
  const id = `00000000-0000-4000-8000-00000000000${index + 1}`;
  return [`${role}@e2e.example`, { id, role, name: `Conta E2E ${role}` }];
}));
const token = (id) => `e2e-session-${id}`;

function authUser({ id }, email) {
  return { id, email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} };
}

function session(account, email) {
  return {
    access_token: token(account.id),
    refresh_token: `e2e-refresh-${account.id}`,
    token_type: "bearer",
    expires_in: 3600,
    user: authUser(account, email),
  };
}

async function handle(request, response) {
  const url = new URL(request.url, fixtureOrigin);
  const route = url.pathname;
  const identity = [...users].find(([, account]) => request.headers.authorization === `Bearer ${token(account.id)}`);
  const respond = (status, body) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(body === undefined ? undefined : JSON.stringify(body));
  };

  if (request.method === "OPTIONS") return respond(204);

  if (route === "/auth/v1/token" && request.method === "POST") {
    const body = await json(request);
    if (url.searchParams.get("grant_type") === "pkce" && body.auth_code === "recovery-code" && body.code_verifier) {
      return respond(200, session(users.get("user@e2e.example"), "user@e2e.example"));
    }
    const account = users.get(body.email);
    if (account && body.password === "Test-password-123") return respond(200, session(account, body.email));
    return respond(400, { message: "Invalid login credentials" });
  }

  if (route === "/auth/v1/recover" && request.method === "POST") return respond(200, {});
  if (!identity) return respond(401, { message: "Missing test session" });
  const [email, account] = identity;

  if (route === "/auth/v1/user") return respond(200, authUser(account, email));
  if (route === "/auth/v1/logout") return respond(204);

  if (route === "/rest/v1/profiles" && url.searchParams.get("id") === `eq.${account.id}`) {
    const profile = { id: account.id, role: account.role, display_name: account.name, avatar_url: null };
    return respond(200, request.headers.accept?.includes("vnd.pgrst.object") ? profile : [profile]);
  }

  if (route.startsWith("/rest/v1/") && ["GET", "HEAD"].includes(request.method)) {
    response.setHeader("Content-Range", "*/0");
    return respond(200, []);
  }

  return respond(404, { message: "Unknown test endpoint" });
}

export async function startAuthFixture() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== fixtureOrigin || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "ci-placeholder") {
    throw new Error("The auth fixture requires the local Supabase URL and ci-placeholder key.");
  }

  const server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3000");
    response.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", request.headers["access-control-request-headers"] ?? "");
    response.setHeader("Access-Control-Expose-Headers", "Content-Range");
    handle(request, response).catch(() => {
      response.writeHead(500);
      response.end();
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(54321, "127.0.0.1", resolve);
  });
}
