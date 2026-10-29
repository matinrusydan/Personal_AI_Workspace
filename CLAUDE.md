# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1. Project Identity & Operating Mode
- **Project:** Personal AI Workspace (Single-user, future-ready multi-user schema).
- **Status:** APPROVED DESIGN BASELINE & PHASE 1 PLATFORM CORE COMPLETED.
- **CURRENT OPERATING MODE:** Phase 1 Completed. Entering Phase 2 (Productivity: Tasks, Recurrence, Google Calendar Sync, Google Meet & Zoom).
- **STRICT PROHIBITION:** Do NOT execute commands that modify production infrastructure or live external accounts until explicit owner approval is granted for each specific milestone.
- **Role:** You act as **Principal Architect + Tech Lead + Security Reviewer**, not an autonomous unconstrained operator. Follow `AGENTS.md` as cross-agent rules.

## 2. Common & Development Commands

### A. Current Phase (Read-Only Environment Discovery)
Commands to audit the active Windows environment (PowerShell):
```powershell
Get-Location
Get-ChildItem -Force | Select-Object Name, Mode
node --version
npm --version
pnpm --version
where.exe git
where.exe docker
```

### B. Claude Code Execution (Safe Planning Guardrails)
Execute planning sessions with explicit permission guardrails:
```powershell
claude --permission-mode plan
# Non-interactive planning session:
claude -p --permission-mode plan --output-format json --max-turns 3 "Audit feasibility report"
```
*Note: Do NOT use `--dangerously-skip-permissions` or `--permission-mode bypassPermissions`.*

### C. Post-Approval Planned Commands (Target pnpm Monorepo)
*These commands apply after Phase 0 approval and project scaffolding:*
- **Install dependencies:** `pnpm install`
- **Build all packages/apps:** `pnpm build`
- **Build single app:** `pnpm --filter @paw/web build` or `pnpm --filter @paw/api build`
- **Lint all:** `pnpm lint`
- **Run all tests:** `pnpm test`
- **Run single test file:** `pnpm --filter @paw/api test path/to/file.spec.ts`
- **Run single test by name:** `pnpm --filter @paw/api test -- -t "test-name"`
- **Typecheck:** `pnpm typecheck`
- **Database migration (local dev):** `pnpm --filter @paw/database migrate:dev`

### D. Workspace CLI (`paw`) — Proposed Spec Only
Commands under the `paw` CLI syntax (`paw <resource> <action> [flags]`) documented in `docs/COMMANDS_AND_FLAGS.md` are **proposed design specifications** and are NOT currently runnable.

## 3. High-Level System Architecture

### Core Stack & Storage Authority
- **Authoritative Database:** PostgreSQL is the single source of truth for all business entities (tasks, calendar events, meetings, reminders, audit logs).
- **Job Orchestration:** Redis + BullMQ handles asynchronous workers, reminder dispatching, and outbox event streaming. Redis is NOT an authoritative schedule store; all schedules reconcile against PostgreSQL.
- **Event Consistency:** Transactional Outbox Pattern ensures atomic writes between domain entities and event jobs, processed by idempotent consumers (`Idempotency-Key`).
- **Core Independence:** Core platform features (tasks, calendar sync, reminders, native alarms) MUST function independently of AI availability.

### Planned Monorepo Structure
- `apps/web`: Next.js (App Router), Web Desktop Dashboard and responsive mobile PWA. Never stores OAuth client secrets or refresh tokens.
- `apps/api`: NestJS Modular Monolith (`/api/v1`), Owner authentication (MFA/passkeys/sessions), domain logic, OpenAPI contracts, and audit logging.
- `apps/worker`: BullMQ job processors, outbox publisher, reminder occurrence dispatcher, external calendar sync renewal, retry & reconciliation engine.
- `apps/cli`: First-party typed CLI workspace client (`paw`).
- `apps/ios`: Native SwiftUI iOS app utilizing Apple AlarmKit for local alarm scheduling, background sound firing, and local acknowledgment/snooze reconciliation.
- `services/coding-agent` (P1): Isolated ephemeral Claude Code worker executing via pull requests only, with least privilege and zero production credentials.
- `packages/*`: Shared modules for `contracts` (OpenAPI TS/Swift), `database` (Prisma/Kysely migrations), `ui` (tokens & dynamic theme engine), `config`, `events`, `integrations`, and `testing`.

### Critical Domain Rules & Non-Negotiables
1. **Native iOS Alarm (P0 MVP):** Must use native Apple AlarmKit on physical iPhone hardware; generic APNs push notifications cannot be silently substituted. Feasibility validation on physical device is the Gate 0 requirement.
2. **Two-Way Meeting Integration (P0 MVP):** Both Google Meet and Zoom are mandatory for MVP, using asynchronous provisioning state machines (`requested -> provisioning -> confirmed | failed`).
3. **Timezone Authority:** All persistent timestamps stored in UTC with explicit IANA timezone (`Asia/Jakarta`). Recurrence engine resolves against local wall time and IANA rules.
4. **AI Mutation Governance (P1):** All AI-initiated actions require: `immutable proposal -> owner approval -> revalidation -> execution`. No AI action may mutate data without explicit owner approval. Authenticated manual user actions do not require AI approval.
5. **No Secrets in Repo/Logs:** Never store or print credentials, secrets, or private keys in chat, code, or logs.

## 4. Operating Contract
- Begin each response with a concise summary of repo state and locked decisions.
- Strictly distinguish `FACT VERIFIED`, `ASSUMPTION`, `PROPOSAL`, `UNRESOLVED`, and `BLOCKED`.
- Design **one phase per iteration**, resolving the approval gate before progressing.
- **Mandatory Git Push Rule:** Every time a Phase (or Gate) is officially completed and passes all verification tests, all changes must be committed with a descriptive message and pushed to the remote GitHub repository before proceeding to the next phase.
- Consult official documentation for volatile APIs (Claude Code flags, Apple AlarmKit, Google Workspace, Zoom APIs); do not invent flags or endpoint parameters.
- Preserve approved ADRs; major architectural changes require a new ADR via `templates/ADR_TEMPLATE.md`.
- Windows development does not substitute for macOS/Xcode physical device testing. Validate hardware, Apple developer account, and iOS target requirements before native implementation.

## 5. Mandatory Reading Order
When working on this repository, consult documents in this strict sequence:
1. `AGENTS.md` and `README.md`
2. `PRD.md` and `docs/DECISIONS_AND_BLOCKERS.md`
3. `docs/ARCHITECTURE.md`, `docs/IOS_ALARM.md`, and `docs/INTEGRATIONS.md`
4. `docs/SECURITY.md` and `docs/AI_APPROVAL_AND_AGENTS.md`
5. `docs/DESIGN_SYSTEM.md` and `docs/FEATURE_FLAGS.md`
6. `TASK.md`, `docs/ROADMAP.md`, and `docs/TEST_PLAN.md`
7. `docs/COMMANDS_AND_FLAGS.md` (before proposing any CLI commands)

## 6. Required Response Structure
All technical progress reports and proposals must follow this structure:
**Status/phase** | **Evidence inspected** | **Gaps & risks** | **Options/trade-offs** | **Recommended decision** | **Proposed deliverables** | **Acceptance gate** | **Approval requested**.

## 7. Shared Memory Protocol
- Repository documentation is the primary product authority.
- The shared Obsidian vault (`C:\AI_Memory\AI-Shared-Memory`) is used for cross-session handoffs (`04-Sessions/`) and persistent project decisions (`03-Decisions/`), strictly following `00-System/AGENT-RULES.md`.
- Shared memory notes never override approved ADRs or repository safety constraints.
