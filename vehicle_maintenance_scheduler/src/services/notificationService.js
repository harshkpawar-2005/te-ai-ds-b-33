const { axiosInstance } = require("../config/axiosInstance");
const { Log } = require("logging-middleware");
const { buildPriorityInbox } = require("../algorithms/minHeap");
const ApiError = require("../utils/ApiError");

async function fetchNotifications(queryParams = {}) {
  await Log("backend", "info", "service", `Fetching notifications from evaluation API with params: ${JSON.stringify(queryParams)}`);

  try {
    const response = await axiosInstance.get("/notifications", {
      params: queryParams,
    });
    const notifications = response.data?.notifications || response.data?.data || response.data;

    if (!Array.isArray(notifications)) {
      throw ApiError.internal("Notifications API response is not an array");
    }

    await Log(
      "backend",
      "info",
      "service",
      `Notifications fetched successfully — total: ${notifications.length}`
    );

    return notifications;
  } catch (err) {
    await Log("backend", "error", "service", `Failed to fetch notifications — ${err.message}`);
    throw err;
  }
}

async function getPriorityInboxForUser(queryParams = {}) {
  await Log("backend", "info", "service", `Building priority inbox for query parameters: ${JSON.stringify(queryParams)}`);
  
  const notifications = await fetchNotifications(queryParams);
  const priorityInbox = await buildPriorityInbox(notifications, 10);

  return priorityInbox;
}

module.exports = { fetchNotifications, getPriorityInboxForUser };
