# Implementation Plan — Milestone P1-02: Auth, MFA, Sessions, Devices, & Audit

## Mode and approvals
- **Current mode:** PLANNING ONLY until explicit owner permission to execute.
- **Approval scope:** Milestone P1-02 only (NestJS Backend API Scaffolding, Authentication, TOTP MFA, Session Management, Device Enrollment, and Audit Logging).
- **Subsequent milestones (P1-03 to P1-04):** Strictly require separate, subsequent approval.

## Preflight evidence
- **Documents read:** `AGENTS.md`, `CLAUDE.md`, `PRD.md`, `TASK.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/API_CONTRACTS.md`, `docs/SECURITY.md`, `docs/ADR.md` (ADR-014: Hybrid MFA TOTP + Passkey), `packages/contracts/src/openapi.yaml`.
- **Environment verified:** Node.js v22.16.0, pnpm v10.15.1, workspace packages (`@paw/contracts`, `@paw/config`, `@paw/ui`, `@paw/database`) built and clean.
- **Zero-DB local requirement for P1-02:** Because owner deferred Docker Desktop installation until P1-03, authentication, session tokens, TOTP verification, and audit logic in P1-02 will be implemented with clean **in-memory / mock repository adapters** that implement the strict data model interfaces. This enables full unit & contract testing in P1-02 without requiring a live PostgreSQL instance, seamlessly swapping to PostgreSQL Prisma/Kysely repositories in P1-03.

## Deliverables
1. **NestJS Backend Application (`apps/api`):**
   - Scaffolding of `apps/api` using NestJS modular architecture with Fastify/Express under `/api/v1`.
   - Global validation pipe using Zod/class-validator and unified error handling envelope (`{ error: { code, message, details, traceId } }` per `docs/API_CONTRACTS.md`).
   - OpenAPI documentation integration serving from `@paw/contracts`.
2. **Authentication & ADR-014 TOTP MFA Module:**
   - `POST /api/v1/auth/login`: Verifies owner email allowlist and password hash; returns MFA ticket if MFA is enabled.
   - `POST /api/v1/auth/mfa/verify`: Verifies standard 6-digit TOTP token (RFC 6238 via `otplib`) or single-use recovery code; issues JWT session token.
   - `POST /api/v1/auth/logout`: Revokes active session token.
   - `GET /api/v1/me`: Returns owner identity and timezone preferences.
3. **Session & Security Guard:**
   - JWT authentication guard with Bearer token validation and automatic revocation check.
   - Anti-brute-force rate limiting baseline.
4. **Device Enrollment Module:**
   - `POST /api/v1/devices/register`: Enrolls client device (iOS iPhone 12, Web PWA, Windows Desktop) and generates device identifier.
   - `GET /api/v1/devices/alarms`: Contract endpoint ready to serve desired alarm sync state.
5. **Audit Logging Service:**
   - Append-only structured audit logger recording authentication events, MFA verifications, session revocations, and device registrations with correlation/trace IDs and metadata redaction.
6. **Unit & Contract Tests:**
   - Vitest / Jest test suite verifying login step 1, TOTP generation & verification, recovery code consumption, and unauthorized access rejection.

## Design approach / ADR alignment
- **ADR-001 (Modular Monolith):** NestJS modular structure: `AuthModule`, `DeviceModule`, `AuditModule`.
- **ADR-005 (REST /api/v1 + OpenAPI):** Endpoint routes match `packages/contracts/src/openapi.yaml` 1:1.
- **ADR-014 (Hybrid MFA):** Enforces RFC 6238 TOTP validation with offline hashed recovery codes.
- **`docs/SECURITY.md`:** Sensitive fields (passwords, TOTP secrets) are hashed; tokens are encrypted/redacted from logs; owner allowlist enforced.

## Files to be created
```text
apps/
  api/
    package.json
    tsconfig.json
    src/
      main.ts
      app.module.ts
      common/
        filters/http-exception.filter.ts
        guards/auth.guard.ts
        interceptors/audit.interceptor.ts
      modules/
        auth/
          auth.module.ts
          auth.controller.ts
          auth.service.ts
          totp.service.ts
          dto/
        devices/
          devices.module.ts
          devices.controller.ts
          devices.service.ts
        audit/
          audit.module.ts
          audit.service.ts
      test/
        auth.spec.ts
```

## Validation & Test Plan
- **Typecheck & Build:** `pnpm --filter @paw/api typecheck` and `pnpm --filter @paw/api build` pass with 0 errors.
- **Unit Tests:** `pnpm --filter @paw/api test` verifies:
  1. Valid owner login returns MFA ticket.
  2. Non-owner email is rejected with 401/403.
  3. Valid 6-digit TOTP token produces valid JWT access token.
  4. Invalid TOTP token or expired ticket is rejected.
  5. Recovery code successfully authenticates and is marked as consumed.
  6. Device registration succeeds and returns device record.
  7. Audit log records all events with redacted sensitive fields.
- **Lint & Format:** `pnpm run lint` and `pnpm run format:check` pass cleanly across the monorepo.

## Security / secrets / rollback / costs
- **Zero Hardcoded Secrets:** Uses type-safe defaults from `@paw/config` in development; rejects weak secrets in production.
- **Cost:** $0 (Local execution).
- **Rollback Strategy:** Clean deletion of `apps/api` directory without impacting `packages/*` or documentation.

## Go / No-Go
- [ ] Owner authorizes exact scope of Milestone P1-02.
- [x] Dependencies available (Node.js, pnpm, `@paw/config`, `@paw/contracts`).
- [x] Implementation Plan reviewed and aligned with ADR-014.
