const { fetchDepots } = require("./depotService");
const { fetchVehicles } = require("./vehicleService");
const { runKnapsack } = require("../algorithms/knapsack");
const { Log } = require("logging-middleware");
const ApiError = require("../utils/ApiError");

async function buildSchedule(depotId) {
  await Log(
    "backend",
    "info",
    "service",
    `Schedule build initiated — depotId: ${depotId}`
  );

  const depots = await fetchDepots();

  const depot = depots.find((d) => d.ID === depotId);

  if (!depot) {
    await Log(
      "backend",
      "warn",
      "controller",
      `Invalid depot requested — depotId: ${depotId} not found in ${depots.length} depots`
    );
    throw ApiError.notFound(`Depot with ID ${depotId} not found`);
  }

  await Log(
    "backend",
    "info",
    "service",
    `Depot resolved — ID: ${depot.ID}, MechanicHours: ${depot.MechanicHours}`
  );

  const vehicles = await fetchVehicles();

  const { selected, maxImpact, totalHoursUsed } = await runKnapsack(
    depot.MechanicHours,
    vehicles
  );

  await Log(
    "backend",
    "info",
    "service",
    `Schedule built successfully — depotId: ${depotId}, maxImpact: ${maxImpact}, hoursUsed: ${totalHoursUsed}`
  );

  return {
    depotId: depot.ID,
    mechanicHours: depot.MechanicHours,
    totalHoursUsed,
    maxImpact,
    selectedVehicles: selected,
  };
}

module.exports = { buildSchedule };
