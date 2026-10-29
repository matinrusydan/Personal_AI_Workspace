# WORKFLOW_AND_PLUGIN_SPEC.md — Extensibility (P1/P2)

## Objective
Composable automation without putting AI in critical scheduling path. Workflow engine in P1 with templates, and visual builder later. Plugin SDK P2, designed at architecture time but not implemented in MVP.

## Workflow schema proposal
- `workflowId`, `version`, `trigger` (domain event/time/manual/provider webhook), `conditions` (typed expressions), `actions` (registry-backed), `errorPolicy`, `permissionPolicy`, `ownerId`.
- Actions: `task.create`, `calendar.createEvent`, `reminder.schedule`, `notification.send`, `integration.<provider>.<operation>`, `ai.propose` (P1, not execute).
- Trigger/action form schemas must be validated and versioned, no dynamic arbitrary JavaScript execution from UI.
- Human approval for *any AI-originated state-changing actions*, even when inside workflow. Explicit owner-authored deterministic workflows can execute per declared scope without AI approval unless high-risk action policy requires secondary confirmation.
- UI builder: nodes, edge validation, cycle limits, preview/dry-run, test mode, publish revision, rollback revision, historical run logs.

## Plugin manifest proposal
Metadata: `id`, `version`, `minCoreVersion`, `displayName`, `permissions`, `apiContractVersion`, `uiSlots`, `eventsConsumed`, `eventsEmitted`, `configSchema`, `featureFlags`, `ownerApproval`.
- Prefer internal module adapters first. No untrusted runtime code plugin in MVP.
- External plugins must not obtain raw DB access or production env. Use authenticated scoped API and sandboxing when ready.
- Design system inheritance via `docs/DESIGN_SYSTEM.md`; plugins use semantic tokens and accessible components.

## Future workflow examples
1. `calendar.event.created` -> create reminders 60/10 minutes before -> route iPhone and Telegram.
2. `task.overdue` -> escalation after configured delay if no ack.
3. Daily morning digest -> deterministic query -> optional AI summary **read-only** -> send preview/digest.
4. GitHub issue to coding-agent -> proposal + owner approval -> sandbox branch/PR (no auto deploy).

## Versioning and audit
Published workflows immutable revisions; all side effects traceable to workflowRunId/ownerId, idempotent execution keys and compensating action policy. Shutdown via feature flag should stop future actions and preserve pending/audit state.
