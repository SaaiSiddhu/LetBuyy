import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    runtime_saturation: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.RUNTIME_SATURATION_RPS || 100),
      timeUnit: "1s",
      duration: __ENV.DURATION || "5m",
      preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 100),
      maxVUs: Number(__ENV.MAX_VUS || 1000)
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000", "p(99)<4000"]
  }
};

const baseUrl = __ENV.LETBUYY_API_BASE_URL || "https://api.staging.letbuyy.store";
const token = __ENV.LETBUYY_OPERATIONS_TOKEN || "";

export default function () {
  const requestId = `k6-runtime-saturation-${__VU}-${__ITER}`;
  const response = http.get(`${baseUrl}/v1/operations/runtime/overview`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Request-ID": requestId
    }
  });

  check(response, {
    "runtime overview accepts governed auth boundary": (result) => [200, 401, 403].includes(result.status),
    "runtime overview does not 5xx": (result) => result.status < 500
  });

  sleep(0.2);
}
