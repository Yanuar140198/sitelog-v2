# Load tests

[k6](https://k6.io) scripts for verifying API throughput + latency.

## Smoke test (~20s, 1 VU)

```bash
K6_BASE_URL=http://localhost:4000 K6_API_KEY=sk_live_xxx k6 run loadtest/smoke.js
```

Thresholds: `http_req_failed < 1%`, `http_req_duration p95 < 500ms`.

## Stress test (~4min, ramps 10→200 VUs)

```bash
K6_BASE_URL=http://localhost:4000 K6_API_KEY=sk_live_xxx k6 run loadtest/stress.js
```

Thresholds: `http_req_failed < 5%`, `http_req_duration p95 < 1s`.

## CI

Skip in main CI; run on demand or in `nightly.yml` against staging.
