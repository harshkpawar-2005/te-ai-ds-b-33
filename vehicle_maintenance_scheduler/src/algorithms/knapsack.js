const { Log } = require("logging-middleware");

async function runKnapsack(capacity, items) {
  await Log(
    "backend",
    "info",
    "utils",
    `Knapsack optimization started — capacity: ${capacity} hours, items: ${items.length}`
  );

  const n = items.length;

  const dp = Array.from({ length: n + 1 }, () =>
    new Array(capacity + 1).fill(0)
  );

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = items[i - 1];
    for (let w = 0; w <= capacity; w++) {
      if (Duration > w) {
        dp[i][w] = dp[i - 1][w];
      } else {
        dp[i][w] = Math.max(
          dp[i - 1][w],
          dp[i - 1][w - Duration] + Impact
        );
      }
    }
  }

  const selected = [];
  let remaining = capacity;

  for (let i = n; i > 0; i--) {
    if (dp[i][remaining] !== dp[i - 1][remaining]) {
      selected.push(items[i - 1]);
      remaining -= items[i - 1].Duration;
    }
  }

  const totalHoursUsed = selected.reduce((sum, v) => sum + v.Duration, 0);
  const maxImpact = dp[n][capacity];

  await Log(
    "backend",
    "info",
    "utils",
    `Optimization completed — selected: ${selected.length} tasks, maxImpact: ${maxImpact}, hoursUsed: ${totalHoursUsed}/${capacity}`
  );

  return { selected, maxImpact, totalHoursUsed };
}

module.exports = { runKnapsack };
