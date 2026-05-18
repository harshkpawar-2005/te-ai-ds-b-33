# Vehicle Maintenance Scheduler

**Roll No:** te-ai&ds-b-33  
**Type:** Backend Microservice — REST API  
**Stack:** Node.js · Express.js · JavaScript · Axios · logging-middleware  

---

## Overview

A production-grade backend microservice that optimally schedules vehicle maintenance tasks for a depot using **0/1 Knapsack Dynamic Programming**. Given a depot's available mechanic-hours as capacity, the algorithm maximizes total maintenance impact by selecting which vehicle tasks to schedule.

---

## Setup Instructions

### 1. Clone and Navigate

```bash
git clone https://github.com/harshkpawar-2005/te-ai-ds-b-33.git
cd te-ai-ds-b-33/vehicle_maintenance_scheduler
```

### 2. Install Dependencies

```bash
npm install
```

This installs all dependencies including `logging-middleware` from the local `../logging_middleware` directory.

### 3. Environment Variables

The `.env` file is pre-configured. Variables used:

| Variable | Description |
|---|---|
| `PORT` | HTTP port (default: 3000) |
| `BASE_URL` | Evaluation API base URL |
| `EMAIL` | Registered email |
| `NAME` | Candidate name |
| `ROLL_NO` | Roll number identifier |
| `ACCESS_CODE` | Evaluation access code |
| `CLIENT_ID` | OAuth client ID |
| `CLIENT_SECRET` | OAuth client secret |

All variables are validated at startup — the process will fail fast if any are missing.

### 4. Run

```bash
# Development with hot reload
npm run dev

# Production
npm start
```

---

## Project Structure

```
src/
├── algorithms/
│   ├── knapsack.js           # 0/1 Knapsack DP — O(n × capacity)
│   └── minHeap.js            # Fixed-size Min Heap for Priority Inbox (O(1) updates)
├── config/
│   ├── axiosInstance.js      # Shared axios client with auth interceptor
│   └── env.js                # Environment validation
├── controllers/
│   ├── schedulerController.js
│   └── notificationController.js
├── middleware/
│   ├── requestId.js          # UUID per request
│   ├── requestLogger.js      # Log every request/response with timing
│   └── errorHandler.js       # Centralized error handler
├── routes/
│   └── schedulerRoutes.js
├── services/
│   ├── authService.js        # Token acquisition and distribution
│   ├── depotService.js       # GET /depots integration
│   ├── vehicleService.js     # GET /vehicles integration
│   ├── schedulerService.js   # Orchestration layer
│   └── notificationService.js # GET /notifications integration with priority heap
├── utils/
│   ├── ApiError.js           # Custom error class
│   └── asyncHandler.js       # Async-safe controller wrapper
├── app.js                    # Express setup
└── server.js                 # Entry point
```

---

## API Documentation

### `GET /health`

Returns service health status.

```json
{
  "success": true,
  "status": "healthy",
  "service": "vehicle-maintenance-scheduler",
  "timestamp": "2025-01-01T10:00:00.000Z"
}
```

---

### `GET /api/health`

Same health check, routed through the API prefix.

---

### `GET /api/schedule/:depotId`

Fetches depot info, fetches all vehicle tasks, runs 0/1 Knapsack optimization, returns optimized schedule.

**Parameters:** `depotId` — integer ID of the target depot

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "depotId": 1,
    "mechanicHours": 8,
    "totalHoursUsed": 7,
    "maxImpact": 42,
    "selectedVehicles": [
      { "TaskID": "T-001", "Duration": 3, "Impact": 18 },
      { "TaskID": "T-004", "Duration": 4, "Impact": 24 }
    ]
  },
  "requestId": "uuid-v4"
}
```

---

### `GET /api/notifications`

Fetches list of notifications from evaluation server.

**Query Parameters:**
- `limit` (optional): Number of notifications to fetch
- `page` (optional): Page number
- `notification_type` (optional): Filters by supported types (`"Event"`, `"Result"`, `"Placement"`)

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "notificationId": "uuid-v4",
      "recipientId": "student_001",
      "type": "Placement",
      "title": "Google Drive Open",
      "body": "Applications are live.",
      "createdAt": "2025-01-01T10:00:00.000Z"
    }
  ],
  "requestId": "uuid-v4"
}
```

---

### `GET /api/notifications/priority-inbox`

Uses the Min Heap implementation to fetch notifications and build the top 10 prioritized inbox in O(N) time with O(1) space overhead.

**Query Parameters:**
- `notification_type` (optional): Filter type prior to inbox construction

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "notificationId": "uuid",
      "type": "Placement",
      "title": "Google Drive Open",
      "createdAt": "2025-01-01T10:00:00.000Z"
    }
  ],
  "requestId": "uuid-v4"
}
```

**Error Responses (All routes):**

| Status | Cause |
|---|---|
| 400 | Param/Query validation error |
| 404 | Resource not found |
| 500 | Upstream API or internal failure |

---

## Logging Architecture

### Package: `logging-middleware`

Located at `../logging_middleware`, installed as a local file dependency.

```js
const { Log, setToken } = require("logging-middleware");
```

### Core function

```js
Log(stack, level, packageName, message)
```

### Token lifecycle

```
server.js starts
   └── Log() → stderr (no token yet)
authService.authenticate()
   └── POST /auth → receives token
   └── setAuthToken(token)  → axios instance activated
   └── setToken(token)      → logging middleware activated
All subsequent Log() calls → POST /logs with Bearer token
```

### Log levels by event

| Event | Level |
|---|---|
| Server startup | `info` |
| Authentication success | `info` |
| Authentication failure | `fatal` |
| Request received | `info` |
| Request completed (2xx) | `info` |
| Request completed (4xx) | `warn` |
| Request completed (5xx) | `error` |
| Route matched | `info` |
| Depot fetch start/end | `info` |
| Vehicle fetch start/end | `info` |
| Invalid depot | `warn` |
| Knapsack start/end | `info` |
| Upstream API failure | `error` |
| Unhandled exception | `fatal` |
| Graceful shutdown | `warn` |

---

## DP Algorithm — 0/1 Knapsack

### Problem

Given `n` vehicle tasks each with `Duration` (weight) and `Impact` (value), and a depot with `MechanicHours` (capacity):

**Maximize** total `Impact` subject to total `Duration ≤ MechanicHours`.

Each task is either fully scheduled or not — no partial scheduling. This is the classic **0/1 Knapsack** problem.

### Recurrence

```
dp[i][w] = dp[i-1][w]                                    if Duration[i] > w
dp[i][w] = max(dp[i-1][w], dp[i-1][w - Duration[i]] + Impact[i])   otherwise
```

### Complexity

| | Value |
|---|---|
| Time | O(n × capacity) |
| Space | O(n × capacity) — DP table |
| Backtracking | O(n) |

### Why not Greedy?

Greedy (select by highest Impact/Duration ratio) does not guarantee a globally optimal solution for 0/1 Knapsack. Dynamic Programming exhaustively evaluates all subproblems and always finds the true optimum.

---

## Middleware Stack

| Middleware | Purpose |
|---|---|
| `requestId` | Attaches UUID to `req.requestId`, sets `X-Request-Id` response header |
| `requestLogger` | Logs method, route, status, duration for every request using Log() |
| `errorHandler` | Centralizes all error formatting, level-aware logging (warn vs error vs fatal) |

---

## Production Features

- **Graceful shutdown** — SIGTERM/SIGINT drain connections before exit
- **Unhandled rejection capture** — fatal log + controlled exit
- **Env validation** — fails fast on missing config
- **Request traceability** — UUID on every request and response
- **Axios interceptors** — auth token injected on all outbound requests, errors enriched
- **Async safety** — all controllers wrapped in `asyncHandler`
