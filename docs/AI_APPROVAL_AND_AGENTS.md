# AI_APPROVAL_AND_AGENTS.md — Approval-first Agent Runtime (P1)

## Roles
- **Backend AI Assistant:** parse natural-language requests, summarize read-only data, propose typed tools; cannot directly commit side effects.
- **Approval Gateway:** validate principal, tool, arguments, policy, expiry, risk, payload digest, show exact diff/effect to owner.
- **Deterministic Domain Executor:** executes already-approved action with same payload, idempotency and state recheck.
- **Claude Code Coding Worker:** isolated repo worktree/container, code/test/PR, never uses production access.
- **Owner:** final approver. Approvals may be granted from dashboard/native app and Telegram only after authenticated identity/channel binding and clear action preview.

## Proposal lifecycle
`draft -> validated -> pending_approval -> approved|rejected|expired -> executing -> succeeded|failed|needs_reapproval`.
- Store immutable canonical JSON of tool name + args + affected resource IDs + precondition version + expiration + approval hash.
- Show risk classification (`low|medium|high|critical`); **all mutations require approval**, regardless of risk.
- Bind approval token to owner identity and action hash, single use, limited TTL, anti-replay. On changed state/parameters, request new approval.
- Audit proposal generation, decision, actor, time, result digest without dumping secrets.
- Time-limited read access scopes still enforced; approval for mutations does not imply unrestricted file/terminal rights.

## Example
Natural language 'Besok jadwalkan meeting Zoom jam 09.00' -> propose `meeting.create` with local time converted, conflict info, title/duration and provider -> owner sees detail & presses Approve -> backend creates event, Zoom meeting, reminder via deterministic services; no raw model command at executor.

## Coding worker (P1)
- Inputs: approved task ID, selected repository/branch, explicit accessible directories, approved test commands, budget/timeout limits.
- Run under unprivileged identity in isolated container or VM with constrained filesystem & egress. No shared host home, private SSH keys, prod tokens, Docker socket, or database creds.
- Outputs: branch + PR with diff summary, test results, risk and rollback. Owner reviews and manually approves deploy via CI.
- Agent is prohibited from changing its own approval code or bypassing protections unless owner initiates separate reviewed policy change.

## Prompt injection defense
Provider docs, issue descriptions, telegram messages, remote webpage text, Obsidian notes and code comments are untrusted data. Explicitly reject content instructions that say to bypass guardrails or reveal credentials. Only system/owner instructions and approved policy define tool permissions. Sandbox even if model seems compliant.

## Model/provider portability
AI runtime uses adapter with structured/tool calling, response validation and cost tracking. Claude Code CLI is a development tool; do not conflate with backend user-facing AI API. Add Hermes later only by ADR; no requirement in MVP.
