# ROADMAP.md — Milestones, Dependencies, Release Gates

**All estimates are provisional planning ranges, not promises.** Approval for each milestone required. Phase 0 before scaffolding.

| Milestone | Suggested effort | Deliverables | Entry/exit gate |
|---|---|---|---|
| 0 Feasibility | 3–7 workdays + access constraints | alarm physical test plan/results, provider feasibility, ADR, budget and build path | owner approves proof + plan |
| 1 Foundation | 1–2 weeks | monorepo, auth/MFA, DB, API/worker CI, tokenized shell | deterministic auth/API tests |
| 2 Productivity | 2–4 weeks | task/project, recurrence, Google Calendar two-way, Meet & Zoom | provider E2E/dedupe/sync |
| 3 Reminders/iOS | 2–5 weeks | persistent scheduler, Telegram, iOS AlarmKit, snooze/escalate | physical-device alarm matrix PASS |
| 4 UI/MVP | 1–3 weeks | polished dynamic themes, dashboard, security/restore tests | all applicable P0 AC pass |
| 5 AI workflow | post-MVP | AI assistant, proposal/approval, sandbox coding agent, workflow | adversarial approval tests |
| 6 VPS + expansion | after validated MVP | Docker Compose prod, monitoring, integrations/plugins/RAG | release + rollback evidence |

## Dependency critical path
Mac/Xcode + iPhone/OS + AlarmKit permission/behavior -> device alarm protocol -> reminder MVP. Google credentials/account -> sync & Meet. Zoom app/account -> creation & lifecycle. HTTPS callback -> provider staging tests. Budget + secrets handling -> sustainable VPS release.

## Release rule
P0 includes Google Meet **and** Zoom **and** native iOS alarms. Cannot substitute generic notification or omit provider silently. If blocked, notify owner and request scope amendment through ADR.

## Parallelism
Safe parallel planning: DB design, design tokens, threat model, provider docs. Do not run multiple agents editing same ADR/contract without a merge owner and review. During implementation, one bounded task PR each, tests before merge.

## Review protocol
For each milestone: scope, dependencies, changed files, proof, risks, rollback, explicit owner APPROVE. Handoff using template, update TASK.md and ADR status.
