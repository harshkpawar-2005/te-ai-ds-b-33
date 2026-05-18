const { fetchNotifications, getPriorityInboxForUser } = require("../services/notificationService");
const asyncHandler = require("../utils/asyncHandler");
const { Log } = require("logging-middleware");

const getNotificationsList = asyncHandler(async (req, res) => {
  const { limit, page, notification_type } = req.query;

  const queryParams = {};
  if (limit) queryParams.limit = limit;
  if (page) queryParams.page = page;
  if (notification_type) queryParams.notification_type = notification_type;

  await Log(
    "backend",
    "info",
    "controller",
    `Notifications list request received with params — limit: ${limit}, page: ${page}, type: ${notification_type}`
  );

  const notifications = await fetchNotifications(queryParams);

  return res.status(200).json({
    success: true,
    data: notifications,
    requestId: req.requestId,
  });
});

const getPriorityInbox = asyncHandler(async (req, res) => {
  const { notification_type } = req.query;

  const queryParams = {};
  if (notification_type) queryParams.notification_type = notification_type;

  await Log(
    "backend",
    "info",
    "controller",
    `Priority inbox request received with type filter: ${notification_type}`
  );

  const inbox = await getPriorityInboxForUser(queryParams);

  return res.status(200).json({
    success: true,
    data: inbox,
    requestId: req.requestId,
  });
});

module.exports = { getNotificationsList, getPriorityInbox };
