import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    webhook_flood: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.WEBHOOK_RPS || 50),
      timeUnit: "1s",
      duration: __ENV.DURATION || "5m",
      preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 50),
      maxVUs: Number(__ENV.MAX_VUS || 500)
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2000", "p(99)<4000"]
  }
};

const baseUrl = __ENV.LETBUYY_API_BASE_URL || "https://api.staging.letbuyy.store";

export default function () {
  const requestId = `k6-webhook-flood-${__VU}-${__ITER}`;
  const response = http.post(`${baseUrl}/v1/webhooks/provider-sandbox`, JSON.stringify({
    id: requestId,
    event: "payment.authorized",
    dry_run: true
  }), {
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId
    }
  });

  check(response, {
    "webhook boundary does not 5xx": (result) => result.status < 500,
    "unsigned webhook is rejected or dry-run accepted": (result) => [200, 202, 400, 401, 403].includes(result.status)
  });

  sleep(0.2);
}
