import http from "node:http";

const startedAt = new Date().toISOString();
const port = Number(process.env.PORT || 8091);

function json(res, status, body) {
  const serialized = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(serialized),
  });
  res.end(serialized);
}

function metrics() {
  return [
    "# HELP letbuyy_local_replay_runtime_up Local replay runtime health.",
    "# TYPE letbuyy_local_replay_runtime_up gauge",
    "letbuyy_local_replay_runtime_up 1",
    "# HELP letbuyy_local_replay_runtime_started_at Local replay runtime start timestamp.",
    "# TYPE letbuyy_local_replay_runtime_started_at gauge",
    `letbuyy_local_replay_runtime_started_at ${Math.floor(Date.parse(startedAt) / 1000)}`,
    "",
  ].join("\n");
}

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    json(res, 200, {
      status: "healthy",
      environment: process.env.LETBUYY_ENVIRONMENT || "local",
      replaySafe: true,
      eventStore: process.env.LOCAL_EVENT_STORE_URL ? "configured" : "missing",
      startedAt,
    });
    return;
  }

  if (req.url === "/metrics") {
    const body = metrics();
    res.writeHead(200, {
      "Content-Type": "text/plain; version=0.0.4",
      "Content-Length": Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }

  if (req.url === "/replay/dry-run" && req.method === "POST") {
    json(res, 202, {
      status: "accepted",
      dryRun: true,
      replayId: `local-replay-${Date.now()}`,
    });
    return;
  }

  json(res, 404, { error: { code: "NOT_FOUND", message: "Unknown local replay route" } });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[local-replay-runtime] listening on ${port}`);
});
