const { buildSchedule } = require("../services/schedulerService");
const asyncHandler = require("../utils/asyncHandler");
const { Log } = require("logging-middleware");

const getSchedule = asyncHandler(async (req, res) => {
  const depotId = parseInt(req.params.depotId, 10);

  await Log(
    "backend",
    "info",
    "controller",
    `Schedule request received — depotId param: "${req.params.depotId}"`
  );

  if (isNaN(depotId)) {
    await Log(
      "backend",
      "warn",
      "controller",
      `Invalid depotId received — "${req.params.depotId}" is not a valid integer`
    );
    return res.status(400).json({
      success: false,
      message: "depotId must be a valid integer",
      requestId: req.requestId,
    });
  }

  const result = await buildSchedule(depotId);

  await Log(
    "backend",
    "info",
    "controller",
    `Schedule response dispatched — depotId: ${depotId}, maxImpact: ${result.maxImpact}, requestId: ${req.requestId}`
  );

  return res.status(200).json({
    success: true,
    data: result,
    requestId: req.requestId,
  });
});

const healthCheck = asyncHandler(async (req, res) => {
  await Log("backend", "info", "controller", "Health check endpoint hit");

  return res.status(200).json({
    success: true,
    status: "healthy",
    service: "vehicle-maintenance-scheduler",
    timestamp: new Date().toISOString(),
    rollNo: process.env.ROLL_NO,
  });
});

module.exports = { getSchedule, healthCheck };
