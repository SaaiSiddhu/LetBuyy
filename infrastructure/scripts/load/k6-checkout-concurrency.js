import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    checkout_concurrency: {
      executor: "ramping-vus",
      stages: [
        { duration: "2m", target: 50 },
        { duration: "5m", target: 200 },
        { duration: "2m", target: 0 }
      ]
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"]
  }
};

const baseUrl = __ENV.LETBUYY_API_BASE_URL || "https://api.letbuyy.com";

export default function () {
  const response = http.get(`${baseUrl}/v1/health`, {
    headers: {
      "X-Request-ID": `k6-${__VU}-${__ITER}`
    }
  });

  check(response, {
    "health is 200": (result) => result.status === 200
  });

  sleep(1);
}
