const { Log } = require("logging-middleware");

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
    const typeVal = n.Type || n.type;
    const baseScore = typePriority[typeVal] || 0;
    const timeVal = n.Timestamp || n.createdAt;
    const recencyTime = timeVal ? new Date(timeVal).getTime() : Date.now();
    const recencyScore = recencyTime / 1e12;
    return baseScore + recencyScore;
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
    if (min !== i) {
      this._swap(i, min);
      this._siftDown(min);
    }
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

async function buildPriorityInbox(notifications, limit = 10) {
  await Log("backend", "info", "utils", `Starting Priority Inbox build with ${notifications.length} notifications`);
  const heap = new MinHeap(limit);
  for (const n of notifications) {
    heap.push(n);
  }
  const result = heap.toSortedArray();
  await Log("backend", "info", "utils", `Priority Inbox built successfully with ${result.length} prioritized items`);
  return result;
}

module.exports = { MinHeap, buildPriorityInbox };
