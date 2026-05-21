// k6 stress test — finds API breaking point.
// Ramps from 10 → 200 VUs over 5 min, looks for error rate spike + p95 latency.
// Run:  k6 run loadtest/stress.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m',  target: 50 },
    { duration: '1m',  target: 100 },
    { duration: '1m',  target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed:   ['rate<0.05'],     // <5% errors at peak
    http_req_duration: ['p(95)<1000'],    // p95 <1s under stress
  },
};

const BASE = __ENV.K6_BASE_URL || 'http://localhost:4000';
const KEY = __ENV.K6_API_KEY || '';

export default function () {
  const res = KEY
    ? http.get(`${BASE}/api/v1/projects`, { headers: { Authorization: `Bearer ${KEY}` } })
    : http.get(`${BASE}/status`);
  check(res, { 'status 2xx': r => r.status >= 200 && r.status < 300 });
}
