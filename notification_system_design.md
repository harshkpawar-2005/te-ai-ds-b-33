# Notification System Design

**Roll No:** te-ai&ds-b-33  
**Assignment:** Backend Engineering Evaluation

---

## Stage 1 — API Design & Architecture

### Notification API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/notifications` | Create and dispatch a notification |
| `GET` | `/api/notifications/:userId` | Paginated notification feed for a user (Supports query parameters: `limit`, `page`, `notification_type`) |
| `GET` | `/api/notifications/:userId/unread` | Unread notifications only |
| `PATCH` | `/api/notifications/:id/read` | Mark one notification as read |
| `PATCH` | `/api/notifications/:userId/read-all` | Mark all notifications as read |
| `DELETE` | `/api/notifications/:id` | Delete a notification |
| `GET` | `/api/notifications/:userId/priority-inbox` | Top-10 prioritized notifications |
| `POST` | `/api/notifications/broadcast` | Send notification to all users (async) |

---

### Request / Response Structure

**POST /api/notifications**
```json
{
  "recipientId": "student_001",
  "type": "Placement",
  "title": "New Placement Drive",
  "body": "Google is recruiting for Software Engineering roles.",
  "metadata": { "jobId": "G-101" }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "notificationId": "uuid-v4",
    "recipientId": "student_001",
    "type": "assignment_due",
    "title": "Assignment Deadline Approaching",
    "isRead": false,
    "createdAt": "2025-01-01T10:00:00Z"
  }
}
```

---

### Architecture Diagram

```
Client App
    │
    ▼
API Gateway  (rate limiting · auth validation · TLS termination)
    │
    ▼
Notification Service  (Express REST API — stateless · horizontally scalable)
    │
    ├──► PostgreSQL  (persist notification records)
    │
    └──► Message Queue  (BullMQ / RabbitMQ)
              │
              ▼
        Delivery Worker Pool
              │
         ┌────┴────┐
         ▼         ▼
    WebSocket    Push / Email
    Gateway      (async delivery)
         │
    Redis Pub/Sub
    (multi-node WS sync)
```

---

### Notification Flow

1. Client sends `POST /api/notifications`
2. API validates payload, persists to PostgreSQL
3. Job pushed to message queue
4. API returns `201 Created` immediately — decoupled from delivery
5. Worker picks up the job, delivers via WebSocket if user is online
6. If offline, notification sits in DB, fetched on next login

---

### Real-time Delivery

**WebSocket** (via `socket.io`) is used for real-time push:
- Each user authenticates a persistent WebSocket connection on login
- Delivery workers check if the user's socket is active via Redis Pub/Sub
- If active: push instantly
- If offline: notification delivered passively on next fetch

**Long-polling** is available as a fallback for restricted network environments.

---

### Scalability Considerations

- API service is **stateless** — any number of replicas behind a load balancer
- WebSocket routing uses **Redis Pub/Sub** so any worker node can deliver to any connected client
- **Cursor-based pagination** on all list endpoints to avoid costly OFFSET scans
- **Message queue** decouples creation from delivery — slow delivery channels cannot block the API

---

## Stage 2 — Database Selection: PostgreSQL

### Recommendation: PostgreSQL

#### Consistency (ACID)

PostgreSQL provides fully ACID-compliant transactions. A notification is atomically written or not at all — no partial states where metadata exists without the notification record or vice versa. This is critical for correctness of unread counts.

#### Relational Structure

Notifications have natural foreign key relationships:

```sql
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id VARCHAR(64) NOT NULL REFERENCES users(id),
  type         VARCHAR(64) NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  priority     SMALLINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata     JSONB
);
```

The `JSONB` column allows flexible per-notification metadata without schema migrations, while keeping structured columns queryable with indexes.

#### Unread Notification Queries

```sql
SELECT * FROM notifications
WHERE recipient_id = $1 AND is_read = FALSE
ORDER BY created_at DESC
LIMIT 20;
```

With a composite index (see Stage 3), this query uses an index-only scan — extremely efficient even at millions of rows.

#### Scalability

- **Read replicas** offload notification feed reads from the primary
- **Table partitioning** by `created_at` range manages large historical tables
- **PgBouncer** connection pooling handles high-concurrency API loads

---

## Stage 3 — Query Optimization

### The Problem

Without indexing, the query:

```sql
SELECT * FROM notifications
WHERE recipient_id = $1 AND is_read = FALSE
ORDER BY created_at DESC;
```

Causes PostgreSQL to:
1. **Full sequential scan** — read every row in the table — O(N) I/O
2. **Filter in memory** — apply `recipient_id` and `is_read` conditions
3. **Sort in memory** — sort surviving rows by `created_at DESC` — O(M log M)

At scale (millions of notifications), this is catastrophic.

---

### Solution: Composite Index

```sql
CREATE INDEX idx_notifications_user_unread_time
ON notifications (recipient_id, is_read, created_at DESC);
```

#### Why This Index Works

| Column | Role |
|---|---|
| `recipient_id` | Instantly narrows scan to one user's rows |
| `is_read` | Further filters to unread within that user's partition |
| `created_at DESC` | Pre-sorts the result — eliminates in-memory sort entirely |

PostgreSQL satisfies the entire query — filter + sort — from the index alone (**Index-Only Scan**).

**Result:** O(N) → O(log N + K) where K = result set size

---

### Why NOT Index Every Column

1. **Write amplification** — every INSERT/UPDATE/DELETE must update all indexes. For a notification system with frequent bulk dispatches, this destroys write throughput.
2. **Storage cost** — each index copies the column data in a B-Tree structure, multiplying disk usage.
3. **Planner confusion** — too many indexes causes the query planner to choose poorly.
4. **Low-cardinality waste** — indexing `is_read` (boolean) alone provides no benefit since it has only 2 distinct values; the planner prefers a sequential scan.

**Rule**: Index for the queries that matter most, not every column.

---

## Stage 4 — Redis Caching

### Problem

Notification feeds are read on every app open, every page refresh, every dashboard load. High read-to-write ratio saturates PostgreSQL connection pools.

### Solution: Cache-Aside Pattern with Redis

```
Application
    │
    ├── Check Redis: key = notifications:{userId}
    │       │
    │       ├── HIT  → return cached result (sub-millisecond)
    │       │
    │       └── MISS → query PostgreSQL
    │                      └── store in Redis with TTL
    │                      └── return to client
```

**Implementation:**

```js
async function getNotifications(userId) {
  const key = `notifications:${userId}`;
  const cached = await redis.get(key);

  if (cached) return JSON.parse(cached);

  const rows = await db.query(
    `SELECT * FROM notifications WHERE recipient_id = $1
     ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );

  await redis.setex(key, 60, JSON.stringify(rows));
  return rows;
}
```

---

### TTL Strategy

| Data | TTL |
|---|---|
| Unread notification count | 30 seconds |
| Recent feed | 60 seconds |
| Priority inbox | 120 seconds |

---

### Cache Invalidation

On any write (create / mark read / delete):

```js
await redis.del(`notifications:${userId}`);
await redis.del(`unread_count:${userId}`);
```

The next read re-populates from PostgreSQL.

---

### Tradeoffs

| Advantage | Disadvantage |
|---|---|
| Sub-millisecond reads | Added operational complexity |
| Massively reduces DB load | Stale data risk if invalidation is missed |
| Horizontally scalable with Redis Cluster | Memory cost for large feeds |
| Unread count O(1) lookups | Cold-start: first read after expiry hits DB |

---

## Stage 5 — "Notify All" Architecture

### Problem with Naive Broadcast

A naive loop over all students with synchronous DB inserts and delivery calls:
- Blocks the API response until all deliveries complete
- One failure aborts the entire batch
- No retry mechanism
- Times out for large student populations

---

### Improved Architecture: Async Queue-Based Processing

```
POST /api/notifications/broadcast
       │
       ▼
  Validate payload
       │
       ▼
  Persist broadcast event record to DB
       │
       ▼
  Enqueue batch jobs to message queue (BullMQ)
       │
  [API returns 202 Accepted immediately]
       │
       ▼
  Worker Pool fetches batches of students
    Worker 1: recipients [0 – 499]
    Worker 2: recipients [500 – 999]
    Worker 3: recipients [1000+]
       │
       ▼
  Per recipient: insert notification + push to WebSocket
  Failures → dead-letter queue with exponential backoff retry
```

---

### Queue Technology

| Option | Recommended For |
|---|---|
| **BullMQ** | Node.js services, moderate scale — Redis-backed, easy retry/backoff |
| **RabbitMQ** | Multi-language, complex routing — AMQP protocol, fanout exchanges |
| **Kafka** | Extremely high throughput, event sourcing, audit logs |

For this system: **BullMQ** — native Node.js integration, built-in retry dashboard, minimal ops overhead.

---

### Retry and Partial Failure

```js
notificationQueue.process(async (job) => {
  const { batch, payload } = job.data;
  const failed = [];

  for (const recipientId of batch) {
    try {
      await db.insertNotification(recipientId, payload);
      await wsGateway.push(recipientId, payload);
    } catch (err) {
      failed.push({ recipientId, error: err.message });
    }
  }

  if (failed.length > 0) {
    await deadLetterQueue.add({ failed, payload });
  }
});
```

Dead-letter items retry with exponential backoff (5s → 25s → 125s). After exhaustion, operations team is alerted.

---

### Improved Pseudocode

```
function notifyAll(payload):
  validate(payload)
  event = db.insert("broadcast_events", payload)

  students = db.fetchAllStudents()
  batches  = chunk(students, size=500)

  for each batch:
    queue.enqueue("notification_dispatch", {
      broadcastId: event.id,
      batch,
      payload,
      attempts: 3,
      backoff: "exponential"
    })

  return { status: 202, broadcastId: event.id }

worker("notification_dispatch", async (job):
  failed = []
  for each recipient in job.batch:
    try:
      db.insert(notification, recipient.id)
      ws.push(recipient.id, notification)
    catch err:
      failed.push({ id: recipient.id, reason: err })

  if failed.length > 0:
    deadLetterQueue.add({ failed, payload: job.payload })
)
```

---

## Stage 6 — Priority Inbox (Min-Heap Implementation)

### Problem

The Priority Inbox must maintain the **top-10 notifications** ranked by:
1. **Notification type priority** (higher type priority = ranked higher)
2. **Recency** (newer notification wins when type priority ties)

Sorting the full notification array on every incoming notification is **O(N log N)** per event — completely impractical for a live inbox.

---

### Solution: Fixed-Size Min-Heap

A **Min-Heap of size 10** keeps only the current top-10. The heap root always holds the **lowest-ranked item** in the top-10:

- New notification scores **higher** than root → evict root, insert new item → **O(log 10)**
- New notification scores **lower** than root → discard → **O(1)**

---

### Priority Scoring

```js
const TYPE_PRIORITY = {
  Placement: 3,
  Result:    2,
  Event:     1,
};

function score(notification) {
  const typePriority = TYPE_PRIORITY[notification.type] || 0;
  const recency = new Date(notification.createdAt).getTime() / 1e12;
  return typePriority + recency;
}
```

Type dominates; recency breaks ties within the same type.

---

### Min-Heap Implementation

```js
class MinHeap {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.heap = [];
  }

  _score(n) {
    const typePriority = {
      Placement: 3,
      Result:    2,
      Event:     1,
    };
    return (typePriority[n.type] || 0) + new Date(n.createdAt).getTime() / 1e12;
  }

  _parent(i) { return Math.floor((i - 1) / 2); }
  _left(i)   { return 2 * i + 1; }
  _right(i)  { return 2 * i + 2; }

  _swap(i, j) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  _bubbleUp(i) {
    while (i > 0 && this._score(this.heap[i]) < this._score(this.heap[this._parent(i)])) {
      this._swap(i, this._parent(i));
      i = this._parent(i);
    }
  }

  _siftDown(i) {
    let min = i;
    const l = this._left(i), r = this._right(i);
    if (l < this.heap.length && this._score(this.heap[l]) < this._score(this.heap[min])) min = l;
    if (r < this.heap.length && this._score(this.heap[r]) < this._score(this.heap[min])) min = r;
    if (min !== i) { this._swap(i, min); this._siftDown(min); }
  }

  push(notification) {
    if (this.heap.length < this.maxSize) {
      this.heap.push(notification);
      this._bubbleUp(this.heap.length - 1);
    } else if (this._score(notification) > this._score(this.heap[0])) {
      this.heap[0] = notification;
      this._siftDown(0);
    }
  }

  toSortedArray() {
    return [...this.heap].sort((a, b) => this._score(b) - this._score(a));
  }
}
```

---

### Fetching Priority Inbox

```js
async function getPriorityInbox(userId) {
  const response = await axios.get(`/api/notifications/${userId}`);
  const notifications = response.data.data.notifications;

  const heap = new MinHeap(10);
  for (const n of notifications) heap.push(n);

  return heap.toSortedArray();
}
```

---

### Real-time Updates via WebSocket

```js
socket.on("notification", (incoming) => {
  heap.push(incoming);
  renderInbox(heap.toSortedArray());
});
```

Each new notification triggers a single `heap.push()` — **O(log 10)** — then re-renders.

---

### Complexity Comparison

| Operation | Naive Sort | Min-Heap |
|---|---|---|
| Initialize from N notifications | O(N log N) | O(N log 10) ≈ O(N) |
| Insert new notification | O(N log N) | O(log 10) ≈ **O(1)** |
| Read top-10 | O(N) | O(10 log 10) ≈ **O(1)** |
| Space complexity | O(N) | **O(10) = O(1)** |

The Min-Heap approach provides **constant-space** priority inbox management regardless of total notification count — the correct production choice for a live inbox.
