# Implementation Plan — Milestone P2-01: Projects, Tasks, Subtasks, Tags, & Deadlines

## Mode and approvals
- **Current mode:** PLANNING ONLY until explicit owner permission to execute.
- **Approval scope:** Milestone P2-01 only (Task & Project Domain Entities, REST Endpoints, Outbox Event Emitting, and Frontend Task Views).
- **Subsequent milestones (P2-02 to P2-04):** Strictly require separate, subsequent approval.

## Preflight evidence
- **Documents read:** `AGENTS.md`, `CLAUDE.md`, `PRD.md`, `TASK.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/API_CONTRACTS.md`, `docs/EVENT_FLOWS.md`, `docs/SECURITY.md`, `docs/TEST_PLAN.md`.
- **Environment verified:** Node.js v22.16.0, pnpm v10.15.1, PostgreSQL 16 (port 5433) with `paw_dev` schema containing `projects`, `tasks`, `tags`, `task_tags`, and `outbox_events` tables; Redis 7 (port 6379) active.
- **Phase 1 Status:** 100% Completed, all 23 tests passing.

## Deliverables
1. **Backend Task & Project Service (`apps/api`):**
   - `TasksModule` and `ProjectsModule` implementing domain logic.
   - Task CRUD endpoints matching `docs/API_CONTRACTS.md`:
     - `GET /api/v1/tasks`: Filter by project, status (`todo`, `in_progress`, `blocked`, `done`), priority (`low`, `normal`, `high`, `urgent`), due dates.
     - `POST /api/v1/tasks`: Create task/subtask with optimistic concurrency `version` counter and atomic transactional outbox event `task.created.v1`.
     - `GET /api/v1/tasks/{id}`: Detailed task view with subtasks and associated tags.
     - `PATCH /api/v1/tasks/{id}`: Update task properties with `If-Match` / `version` check and outbox event `task.updated.v1`.
     - `DELETE /api/v1/tasks/{id}`: Archive / soft-delete task.
   - Project CRUD endpoints (`GET/POST /api/v1/projects`).
2. **Transactional Outbox Event Integration:**
   - Every mutating task action emits `task.created.v1` or `task.updated.v1` into `outbox_events` within the same database transaction.
3. **Frontend Task Board & List View (`apps/web`):**
   - Connect `/tasks` page in Next.js to display active tasks, grouped by status / project.
   - Task creation modal/form accepting title, description, project, priority, and due date with explicit timezone.
   - Status transition buttons (`todo` &rarr; `in_progress` &rarr; `done`).
4. **Automated Unit & Integration Tests:**
   - Vitest test suite for task hierarchy (parent/subtasks), status transitions, tag associations, and outbox event generation.

## Design approach / ADR alignment
- **ADR-002 (PostgreSQL Authoritative):** Foreign keys to `projects`, `parent_task_id`, and `tags` strictly validated.
- **ADR-004 (Transactional Outbox):** Outbox events emitted atomically on task mutations.
- **ADR-005 (REST /api/v1 + OpenAPI):** Endpoints conform 1:1 to `@paw/contracts`.
- **ADR-011 (UTC Instants + IANA Timezones):** Due dates stored in UTC with timezone string (`Asia/Jakarta`).

## Files to be created / modified
```text
apps/
  api/
    src/
      modules/
        tasks/
          tasks.module.ts
          tasks.controller.ts
          tasks.service.ts
          dto/
            create-task.dto.ts
            update-task.dto.ts
        projects/
          projects.module.ts
          projects.controller.ts
          projects.service.ts
      app.module.ts (import TasksModule, ProjectsModule)
    test/
      tasks.spec.ts
  web/
    src/
      app/
        tasks/page.tsx (interactive board/list)
      components/
        tasks/
          TaskCard.tsx
          CreateTaskDialog.tsx
```

## Validation & Test Plan
- **Backend Tests:** `pnpm --filter @paw/api test` passes all task CRUD and optimistic concurrency tests.
- **Outbox Integration:** Creating a task creates both a `tasks` record and an `outbox_events` record with matching `aggregate_id`.
- **Frontend Build:** `pnpm --filter @paw/web build` succeeds with zero errors.
- **Monorepo Checks:** `pnpm run lint` and `pnpm run typecheck` pass with 0 errors.

## Security / secrets / rollback / costs
- **Security:** Strict owner isolation (`owner_id` scoped to authenticated user).
- **Cost:** $0 (Local execution).
- **Rollback Strategy:** Clean Git checkout / branch reversion.

## Go / No-Go
- [ ] Owner authorizes exact scope of Milestone P2-01.
- [x] Phase 1 completed and verified (Gate 1 Passed).
- [x] Database tables and Prisma schema verified.
