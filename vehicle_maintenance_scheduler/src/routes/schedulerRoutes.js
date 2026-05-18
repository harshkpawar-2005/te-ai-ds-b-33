const express = require("express");
const { getSchedule, healthCheck } = require("../controllers/schedulerController");
const { getNotificationsList, getPriorityInbox } = require("../controllers/notificationController");
const { Log } = require("logging-middleware");

const router = express.Router();

router.use(async (req, res, next) => {
  await Log(
    "backend",
    "info",
    "route",
    `Route matched — ${req.method} ${req.baseUrl}${req.path}`
  );
  next();
});

router.get("/health", healthCheck);
router.get("/schedule/:depotId", getSchedule);
router.get("/notifications", getNotificationsList);
router.get("/notifications/priority-inbox", getPriorityInbox);

module.exports = router;
