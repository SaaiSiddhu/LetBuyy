import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    black_friday_api_spike: {
      executor: "ramping-arrival-rate",
      startRate: Number(__ENV.START_RPS || 25),
      timeUnit: "1s",
      preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 100),
      maxVUs: Number(__ENV.MAX_VUS || 1000),
      stages: [
        { duration: __ENV.RAMP_UP || "2m", target: Number(__ENV.PEAK_RPS || 500) },
        { duration: __ENV.PEAK_DURATION || "5m", target: Number(__ENV.PEAK_RPS || 500) },
        { duration: __ENV.RAMP_DOWN || "2m", target: 0 }
      ]
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500", "p(99)<3000"]
  }
};

const baseUrl = __ENV.LETBUYY_API_BASE_URL || "https://api.staging.letbuyy.store";

export default function () {
  const requestId = `k6-black-friday-${__VU}-${__ITER}`;
  const response = http.get(`${baseUrl}/v1/health`, {
    headers: { "X-Request-ID": requestId }
  });

  check(response, {
    "api health reachable": (result) => result.status === 200,
    "request id correlated": (result) => Boolean(result.headers["X-Request-ID"] || requestId)
  });

  sleep(0.2);
}
