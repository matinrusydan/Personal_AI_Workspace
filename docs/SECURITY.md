# SECURITY.md — Threat Model & Defense-in-Depth

## Assets and boundaries
Sensitive: user schedules/task content, meeting links, OAuth refresh tokens, APNs credentials, Telegram bot token, app session keys, iPhone alarms, repo code, VPS credentials. Trust boundaries: public clients/webhooks -> API; provider data -> integration adapter; AI model output -> policy engine; coding worker -> repository; mobile device -> server sync.

## Threat scenarios / mitigations
| Threat | Mitigation | Test |
|---|---|---|
| Account takeover | MFA passkey/TOTP, secure sessions, device revocation | login/MFA negative paths |
| Malicious Telegram sender | numeric ID allowlist, webhook secret, no bot in arbitrary groups by default | sender spoof tests |
| OAuth token leak | envelope encryption at rest, short-lived access tokens, scoped refresh, log redaction | log/DB access test |
| CSRF/XSS | secure HttpOnly SameSite cookie, CSRF when relevant, CSP, escape/sanitize, input validation | security regression |
| Webhook spoof/replay | provider verification and dedupe inbox | replay/tamper tests |
| SQL injection/SSRF | parameterized ORM, URL host allowlist, egress restriction | adversarial tests |
| Agent prompt injection | provider/email/docs are untrusted data; action schema + approval + tool allowlist | red-team prompts |
| Approval replay/payload swap | immutable payload hash + expiry + one-time decision + revalidate on execution | change-after-approval test |
| Agent command execution | rootless ephemeral container, no production secrets, restricted network/filesystems, PR only | sandbox escape review |
| Plugin arbitrary code | no plugin execution in MVP; signed/reviewed manifests, constrained extension slots | policy tests |
| Data loss | encrypted off-site backup, tested restore, migration rollback plan | restore drill |
| VPS compromise | minimal inbound ports, SSH keys, updates, no public DB/Redis, resource limits | hardening review |

## Principle of least privilege
Web/PWA users cannot request arbitrary shell commands. CLI scoped to owner API credentials. AI tool gateway separates read-only vs side-effecting actions. Backend never treats natural language as a permission grant. Coding worker must not inherit shell session or user home credentials; no host Docker socket; no direct deploy. Secrets passed per-job scoped and short-lived if unavoidable.

## Approval rule
All AI-initiated mutations require explicit owner approval (even seemingly safe `task.create`). AI may read only scoped allowed data without additional per-read consent according to privacy policy, unless reading itself is sensitive and prohibited. Owner's explicit manual commands are not AI proposals. Deployment/destructive/credential operations always have separate manual confirmation. See `AI_APPROVAL_AND_AGENTS.md`.

## Network and infra
Public HTTPS via reverse proxy, HSTS, rate limiting, bot/IP abuse detection; sensitive admin operations private network where possible. Use TLS to provider APIs. No DB/Redis public binds. Encrypt backups, track credential rotation/incident response. MFA recovery codes offline, never in repo.

## Data governance
Data minimization, retention policy by table, export/delete path, access logging, encryption at rest for tokens. RAG and Obsidian later require explicit folder allowlists, PII scrubbing and opt-in indexing. No cross-account leakage if multi-user added.

## CI/CD policy
Protected main branch, signed/verified provenance where feasible, dependency audit, secret scan, test gates, review of migration/security change, manual approval before prod deploy. Avoid auto-approving agent PRs.

## Incident runbook prerequisites
Define who to notify (single owner), revoke providers, rotate secrets, disable affected integration flag, restore backups and investigate audit trail. Do not suppress evidence automatically.
