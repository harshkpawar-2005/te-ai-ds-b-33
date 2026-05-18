const { Log } = require("logging-middleware");

async function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  const level = statusCode >= 500 ? "error" : "warn";

  await Log(
    "backend",
    level,
    "handler",
    `Error [${statusCode}] on ${req.method} ${req.originalUrl} — ${message} | requestId: ${req.requestId}`
  );

  if (!err.isOperational) {
    await Log(
      "backend",
      "fatal",
      "handler",
      `Unhandled non-operational error: ${err.stack || err.message}`
    );
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(err.details && { details: err.details }),
    requestId: req.requestId,
  });
}

module.exports = errorHandler;
