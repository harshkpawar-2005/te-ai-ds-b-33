const axios = require("axios");

const LOGS_URL = "http://4.224.186.213/evaluation-service/logs";

const VALID_STACKS = new Set(["backend", "frontend"]);

const VALID_LEVELS = new Set(["debug", "info", "warn", "error", "fatal"]);

const VALID_PACKAGES = new Set([
  "cache",
  "controller",
  "cron_job",
  "db",
  "domain",
  "handler",
  "repository",
  "route",
  "service",
  "auth",
  "config",
  "middleware",
  "utils",
]);

let _authToken = null;

function setToken(token) {
  _authToken = token;
}

function getToken() {
  return _authToken;
}

async function Log(stack, level, packageName, message) {
  if (!VALID_STACKS.has(stack)) {
    process.stderr.write(`[LOGGING_MIDDLEWARE] Invalid stack: "${stack}"\n`);
    return;
  }
  if (!VALID_LEVELS.has(level)) {
    process.stderr.write(`[LOGGING_MIDDLEWARE] Invalid level: "${level}"\n`);
    return;
  }
  if (!VALID_PACKAGES.has(packageName)) {
    process.stderr.write(
      `[LOGGING_MIDDLEWARE] Invalid packageName: "${packageName}"\n`
    );
    return;
  }

  const truncatedMessage = message.length > 48 ? message.substring(0, 45) + "..." : message;

  const payload = {
    stack,
    level,
    package: packageName,
    message: truncatedMessage,
  };

  if (!_authToken) {
    process.stderr.write(
      `[${level.toUpperCase()}] [${packageName}] ${message}\n`
    );
    return;
  }

  try {
    await axios.post(LOGS_URL, payload, {
      headers: {
        Authorization: `Bearer ${_authToken}`,
        "Content-Type": "application/json",
      },
      timeout: 5000,
    });
  } catch (err) {
    const errorDetails = err.response ? JSON.stringify(err.response.data) : err.message;
    process.stderr.write(
      `[LOG_API_FAILURE] ${level.toUpperCase()} [${packageName}] ${message} | reason: ${errorDetails}\n`
    );
  }
}

module.exports = { Log, setToken, getToken };
