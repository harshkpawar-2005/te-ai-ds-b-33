const { Log } = require("logging-middleware");

function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl } = req;

  Log(
    "backend",
    "info",
    "middleware",
    `Incoming ${method} ${originalUrl} — requestId: ${req.requestId}`
  );

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const level =
      statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

    Log(
      "backend",
      level,
      "middleware",
      `Completed ${method} ${originalUrl} — status: ${statusCode}, duration: ${duration}ms, requestId: ${req.requestId}`
    );
  });

  next();
}

module.exports = requestLogger;
