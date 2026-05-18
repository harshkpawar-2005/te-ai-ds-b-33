const express = require("express");
const cors = require("cors");
const { Log } = require("logging-middleware");

const requestId = require("./middleware/requestId");
const requestLogger = require("./middleware/requestLogger");
const errorHandler = require("./middleware/errorHandler");
const schedulerRoutes = require("./routes/schedulerRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(requestId);
app.use(requestLogger);

app.use("/api", schedulerRoutes);

app.get("/health", async (req, res) => {
  await Log("backend", "info", "handler", "Root health check endpoint hit");
  return res.status(200).json({
    success: true,
    status: "healthy",
    service: "vehicle-maintenance-scheduler",
    timestamp: new Date().toISOString(),
  });
});

app.use(async (req, res) => {
  await Log(
    "backend",
    "warn",
    "handler",
    `404 — Route not found: ${req.method} ${req.originalUrl}`
  );
  return res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    requestId: req.requestId,
  });
});

app.use(errorHandler);

module.exports = app;
