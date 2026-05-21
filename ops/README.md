# Ops

## Prometheus + Grafana

1. **Scrape config** (`prometheus.yml`):
   ```yaml
   scrape_configs:
     - job_name: sitelog-api
       scrape_interval: 30s
       static_configs:
         - targets: ['api.sitelog.app:443']
       scheme: https
       metrics_path: /metrics
       authorization:
         credentials: ${METRICS_TOKEN}
   ```

2. **Import dashboard**: Grafana → Dashboards → Import → upload `grafana-dashboard.json`.

3. **Alert examples**:
   ```yaml
   - alert: HighErrorRate
     expr: rate(sitelog_http_errors_total[5m]) / rate(sitelog_http_requests_total[5m]) > 0.05
     for: 5m
   - alert: NoAuditEvents24h
     expr: sitelog_audit_events_24h == 0
     for: 30m
   - alert: ApiDown
     expr: up{job="sitelog-api"} == 0
     for: 2m
   ```

## Backups

```bash
0 3 * * * bun /app/scripts/backup.ts backup
```

## Status page

`https://sitelog.app/status` reads `/api/status` JSON.
