import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    replay_schedule_pressure: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.REPLAY_SCHEDULE_RPS || 5),
      timeUnit: '1s',
      duration: __ENV.DURATION || '2m',
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
  },
};

const apiBase = __ENV.LETBUYY_API_BASE_URL || 'https://api.staging.letbuyy.com';
const token = __ENV.LETBUYY_OPERATIONS_TOKEN;

export default function () {
  const replayId = `k6-replay-${__VU}-${__ITER}-${Date.now()}`;
  const response = http.post(`${apiBase}/v1/operations/runtime/replays`, JSON.stringify({
    replay_id: replayId,
    owner_runtime: 'services/event-bus',
    event_types: ['runtime.load.validation'],
    cursor: { source: 'k6-replay-stress' },
    batch_size: 25,
    dry_run: true,
    reason: 'k6 replay stress dry-run validation',
  }), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Request-ID': replayId,
    },
  });

  check(response, {
    'replay scheduled': (result) => result.status === 201 || result.status === 200 || result.status === 409,
  });
  sleep(1);
}
