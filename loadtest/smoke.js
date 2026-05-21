// k6 smoke test — verifies API responds correctly under light load.
// Run:  k6 run loadtest/smoke.js
// Env:  K6_BASE_URL (default http://localhost:4000), K6_API_KEY (required for REST)
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.01'],          // <1% failures
    http_req_duration: ['p(95)<500'],        // 95th percentile <500ms
  },
};

const BASE = __ENV.K6_BASE_URL || 'http://localhost:4000';
const KEY = __ENV.K6_API_KEY || '';

export default function () {
  // Public endpoints (no auth)
  const healthz = http.get(`${BASE}/healthz`);
  check(healthz, { 'healthz 200': r => r.status === 200 });

  const status = http.get(`${BASE}/status`);
  check(status, { 'status 200': r => r.status === 200 });

  const metrics = http.get(`${BASE}/metrics`);
  check(metrics, { 'metrics 200': r => r.status === 200, 'metrics has body': r => (r.body?.length ?? 0) > 100 });

  const openapi = http.get(`${BASE}/api/v1/openapi.json`);
  check(openapi, { 'openapi 200': r => r.status === 200 });

  // Authed endpoint (if key provided)
  if (KEY) {
    const me = http.get(`${BASE}/api/v1/me`, { headers: { Authorization: `Bearer ${KEY}` } });
    check(me, { 'me 200': r => r.status === 200 });

    const projects = http.get(`${BASE}/api/v1/projects`, { headers: { Authorization: `Bearer ${KEY}` } });
    check(projects, { 'projects 200': r => r.status === 200 });
  }

  sleep(0.5);
}
