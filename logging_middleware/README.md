# logging-middleware

**Roll No:** te-ai&ds-b-33  
**Type:** Standalone reusable logging package  

---

## Overview

A standalone Node.js package that provides a structured, async `Log()` function for sending log events to the evaluation logging API. Designed to be consumed as a local package dependency from any service in this monorepo.

---

## API

### `Log(stack, level, packageName, message)`

Sends a structured log event to the evaluation logs API.

| Parameter | Type | Allowed Values |
|---|---|---|
| `stack` | string | `backend`, `frontend` |
| `level` | string | `debug`, `info`, `warn`, `error`, `fatal` |
| `packageName` | string | `cache`, `controller`, `cron_job`, `db`, `domain`, `handler`, `repository`, `route`, `service`, `auth`, `config`, `middleware`, `utils` |
| `message` | string | Any descriptive string |

### `setToken(token)`

Stores the bearer token used to authenticate log API requests. Must be called after authentication succeeds before logs will be sent to the API.

### `getToken()`

Returns the currently stored bearer token.

---

## Behavior

1. Validates all parameters before sending.
2. If no token is set yet (e.g., during early startup), falls back gracefully to `process.stderr` — no log events are silently dropped.
3. If the logs API call fails (network error, timeout), falls back to `process.stderr` — never throws.
4. All API calls use a 5-second timeout to prevent blocking the request lifecycle.

---

## Usage

```js
const { Log, setToken } = require("logging-middleware");

setToken("your-bearer-token");

await Log("backend", "info", "service", "Fetching depots from evaluation API");
await Log("backend", "error", "service", "Failed to fetch vehicles: timeout");
await Log("backend", "warn", "controller", "Invalid depot requested");
```

---

## Integration

This package is consumed by `vehicle_maintenance_scheduler` as a local file dependency:

```json
"dependencies": {
  "logging-middleware": "file:../logging_middleware"
}
```

The token lifecycle:

1. Server starts → `Log()` falls back to stderr (no token yet)
2. `authService.authenticate()` completes → calls `setToken(token)`
3. All subsequent `Log()` calls send to the evaluation logs API with `Authorization: Bearer <token>`
