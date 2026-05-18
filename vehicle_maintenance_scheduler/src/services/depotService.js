const { axiosInstance } = require("../config/axiosInstance");
const { Log } = require("logging-middleware");
const ApiError = require("../utils/ApiError");

async function fetchDepots() {
  await Log("backend", "info", "service", "Fetching depots from evaluation API");

  try {
    const response = await axiosInstance.get("/depots");
    const depots = response.data?.depots || response.data?.data || response.data;

    if (!Array.isArray(depots)) {
      throw ApiError.internal("Depots API returned unexpected non-array payload");
    }

    await Log(
      "backend",
      "info",
      "service",
      `Depots fetched successfully — total: ${depots.length}`
    );

    return depots;
  } catch (err) {
    await Log("backend", "error", "service", `Failed to fetch depots — ${err.message}`);
    throw err;
  }
}

module.exports = { fetchDepots };
