const { axiosInstance } = require("../config/axiosInstance");
const { Log } = require("logging-middleware");
const ApiError = require("../utils/ApiError");

async function fetchVehicles() {
  await Log("backend", "info", "service", "Fetching vehicles from evaluation API");

  try {
    const response = await axiosInstance.get("/vehicles");
    const vehicles = response.data?.vehicles || response.data?.data || response.data;

    if (!Array.isArray(vehicles)) {
      throw ApiError.internal("Vehicles API returned unexpected non-array payload");
    }

    await Log(
      "backend",
      "info",
      "service",
      `Vehicles fetched successfully — total: ${vehicles.length}`
    );

    return vehicles;
  } catch (err) {
    await Log("backend", "error", "service", `Failed to fetch vehicles — ${err.message}`);
    throw err;
  }
}

module.exports = { fetchVehicles };
