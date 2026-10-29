# DEPLOYMENT.md — Local-to-VPS Operations Plan

## Current
Local-first on Windows. No production deployment approved. Target VPS Ubuntu, 4 vCPU/8GB, Docker Compose. Native iOS build/sign via macOS/Xcode environment.

## Proposed environments
- `dev`: local docker services, fake providers where possible, synthetic data.
- `staging`: HTTPS test domain, external provider integration/test device, anonymized data.
- `prod`: HTTPS+MFA, hardened VPS, DB/private Redis, backups, monitored workers.

## Service topology
Reverse proxy HTTPS -> web/api; background `worker` separated; Postgres and Redis on private network; outbound providers Google/Zoom/Telegram/APNs. Worker processes run as nonroot. Coding agent P1 uses separate isolated worker with strict resource/security constraints and no prod credentials.

## CI/CD (future)
PR -> lint/typecheck/unit/contract -> integration tests -> build immutable images -> staging integration smoke -> manual production approval -> deployment health checks -> rollback if failure. Disallow agent self-approval of PR and production pipeline.

## Backups/restore
Encrypt and copy PostgreSQL backup off-host, retention policy and key recovery; quarterly/regular restore drills as agreed. Snapshot is not backup proof until restore passes. Redis is ephemeral for queues; DB reconciliation recovers schedule.

## Monitoring
API health, worker heartbeat, pending/overdue reminders, outbox age, external provider rate/401, device alarm sync staleness, OAuth expiry, disk/RAM/CPU, backup success, queue dead letters. See `OBSERVABILITY.md`.

## Authentication, network, access
Public web API/dashboard only via TLS and MFA, admin restricted/private where possible. No DB/Redis public ports. Limit inbound ports, SSH key auth, firewall, secret manager, scoped service accounts, rotate keys.

## Disaster recovery
Document safe deploy/rollback, versioned migrations and rollback conditions. Reconcile external event duplicates and device alarms after restore. Avoid restoring leaked OAuth secrets without rotation policy. Owner approves any risky rollback/migration.

## Operational unknowns
Domain/DNS, HTTPS ingress/callback, VPS vendor, budget, backup storage, alert destination, iOS build CI provider and required Apple accounts are not yet chosen. These are Phase 0 decisions, not current resources.
