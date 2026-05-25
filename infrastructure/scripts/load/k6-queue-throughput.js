import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    queue_ops: {
      executor: "constant-arrival-rate",
      rate: 20,
      timeUnit: "1s",
      duration: "5m",
      preAllocatedVUs: 20,
      maxVUs: 100
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"]
  }
};

const baseUrl = __ENV.LETBUYY_API_BASE_URL || "https://api.letbuyy.store";
const token = __ENV.LETBUYY_PLATFORM_TOKEN || "";

export default function () {
  const response = http.get(`${baseUrl}/v1/operations/runtime/queues/letbuyy-events?limit=25`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Request-ID": `k6-queue-${__VU}-${__ITER}`
    }
  });

  check(response, {
    "queue inspector is reachable": (result) => result.status === 200 || result.status === 401 || result.status === 403
  });

  sleep(1);
}
