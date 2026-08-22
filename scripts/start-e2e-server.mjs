import { createServer } from "node:http";
import next from "next";

const hostname = process.env.HOSTNAME ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const shutdownToken = process.env.E2E_SHUTDOWN_TOKEN;
const app = next({ dev: false, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((request, response) => {
  if (
    shutdownToken &&
    request.method === "POST" &&
    request.url === "/__e2e_shutdown" &&
    request.headers.authorization === `Bearer ${shutdownToken}`
  ) {
    response.writeHead(204);
    response.end();
    setImmediate(() => shutdown());
    return;
  }

  handle(request, response);
});

let isShuttingDown = false;

async function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  const forceExit = setTimeout(() => {
    process.exit(1);
  }, 5_000);
  forceExit.unref();

  server.close(async () => {
    await app.close();
    process.exit(exitCode);
  });
}

process.once("SIGINT", () => shutdown());
process.once("SIGTERM", () => shutdown());
process.once("uncaughtException", (error) => {
  console.error(error);
  shutdown(1);
});
process.once("unhandledRejection", (error) => {
  console.error(error);
  shutdown(1);
});

server.listen(port, hostname, () => {
  console.log(`E2E server ready at http://${hostname}:${port}`);
});
