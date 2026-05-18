require("./config/env");

const { Log } = require("logging-middleware");
const { authenticate } = require("./services/authService");
const app = require("./app");
const env = require("./config/env");

async function startServer() {
  process.on("unhandledRejection", async (reason) => {
    process.stderr.write(`[FATAL] [config] Unhandled Promise Rejection: ${String(reason.stack || reason)}\n`);
    try {
      await Log(
        "backend",
        "fatal",
        "config",
        `Unhandled Promise Rejection: ${String(reason)}`
      );
    } catch (_) {}
    process.exit(1);
  });

  process.on("uncaughtException", async (err) => {
    process.stderr.write(`[FATAL] [config] Uncaught Exception: ${String(err.stack || err.message)}\n`);
    try {
      await Log(
        "backend",
        "fatal",
        "config",
        `Uncaught Exception: ${err.message}`
      );
    } catch (_) {}
    process.exit(1);
  });

  await Log("backend", "info", "config", "Server startup initialized");

  await Log("backend", "info", "config", "App initialization complete — starting authentication");

  await authenticate();

  await Log("backend", "info", "config", "Authentication complete — binding HTTP server");

  const server = app.listen(env.PORT, async () => {
    await Log(
      "backend",
      "info",
      "config",
      `Vehicle Maintenance Scheduler is running on port ${env.PORT}`
    );
  });

  server.on("error", async (err) => {
    process.stderr.write(`[FATAL] [config] Server error: ${err.message}\n`);
    try {
      await Log("backend", "fatal", "config", `Server error: ${err.message}`);
    } catch (_) {}
    process.exit(1);
  });

  const shutdown = async (signal) => {
    await Log(
      "backend",
      "warn",
      "config",
      `${signal} received — initiating graceful shutdown`
    );

    server.close(async () => {
      await Log("backend", "info", "config", "HTTP server closed — all connections drained");
      process.exit(0);
    });

    setTimeout(async () => {
      await Log("backend", "fatal", "config", "Graceful shutdown timeout exceeded — forcing exit");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();
