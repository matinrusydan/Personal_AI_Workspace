# COMMANDS_AND_FLAGS.md — CLI Commands, Flags & Arguments

**Warning:** Part A lists selected **official Claude Code flags**, checked against official CLI docs 2026-10-29; CLI may change, ALWAYS run `claude --help`/consult current docs on actual installed version. Part B is a **PROPOSED first-party `paw` CLI contract**, and is NOT available until implemented. Never execute proposed commands expecting them to work. In planning mode, examples are for specification only.

## A. Claude Code CLI — official subset
Source: https://code.claude.com/docs/en/cli-reference and https://code.claude.com/docs/en/headless

| Command / flag | Arguments | Purpose / safety |
|---|---|---|
| `claude` | optional initial prompt | interactive session |
| `claude -p` / `--print` | text prompt | non-interactive prompt, exits |
| `claude --permission-mode plan` | `plan` | recommended for **read-only/planning workflow**; still review actual permissions |
| `claude --model` | supported alias or model ID | selects model; availability depends on provider |
| `claude --effort` | `low|medium|high|xhigh` etc (version/model dependent) | current session effort |
| `claude --output-format` | `text|json|stream-json` | structured CLI output with `-p` |
| `claude --allowedTools` | tool rules e.g. `Read` | tools auto-approved; restrict tightly; not substitute for sandbox |
| `claude --disallowedTools` | deny rules | explicitly deny tools |
| `claude --max-turns` | integer | bound noninteractive turns |
| `claude --max-budget-usd` | amount | estimated cap in print mode; **can overshoot** and not hard billing limit |
| `claude --mcp-config` | file or JSON | load MCP servers; vet untrusted project config |
| `claude --settings` | file or JSON | per-run settings |
| `claude --append-system-prompt-file` | file path | additional per-run instruction |
| `claude --continue` / `-c` | none | continue latest session |
| `claude --resume` / `-r` | session ID/name | resume selected session |
| `claude auth status` | optional `--text` | inspect auth state; do not paste tokens |
| `claude doctor` | none | read-only diagnosis |

### Safe session example (proposed invocation, does not execute automatically)
```powershell
# From extracted project root, after verifying installed CLI flags:
claude --permission-mode plan "Baca AGENTS.md, CLAUDE.md, PRD.md, TASK.md, dan seluruh dokumen Phase 0. Audit dan buat rencana saja. Jangan coding."
```

### Noninteractive planning example
```powershell
claude -p --permission-mode plan --output-format json --max-turns 3 "Review PRD.md dan docs/DECISIONS_AND_BLOCKERS.md. Ringkas blocker tanpa mengubah file."
```
Beware: `-p` may load project hooks/MCP configuration, potentially executing code from untrusted repo; inspect config first. `--bare` skips automatic `CLAUDE.md` loading and hooks; only use with explicit instruction files/settings and valid API credentials, read official docs. Do NOT use `--dangerously-skip-permissions` or `--permission-mode bypassPermissions` for this project.

## B. Workspace CLI: `paw` — PROPOSED ARGUMENT SPEC ONLY
Planned syntax: `paw <resource> <action> [positional] [--flags]`.

| Command | Proposed flags | Behavior |
|---|---|---|
| `paw auth login` | `--browser`, `--device` | login with owner identity; no plaintext tokens displayed |
| `paw tasks list` | `--status`, `--project`, `--due-before`, `--json` | list tasks |
| `paw tasks add` | `--title`, `--project`, `--priority`, `--due`, `--tz`, `--tag`, `--remind` | create task manually |
| `paw tasks complete <id>` | `--at`, `--json` | mark complete |
| `paw calendar list` | `--from`, `--to`, `--tz`, `--json` | list events |
| `paw calendar create` | `--title`, `--start`, `--end`, `--tz`, `--calendar` | create event |
| `paw meeting create` | `--provider google-meet|zoom`, `--title`, `--start`, `--duration`, `--tz`, `--calendar`, `--remind` | provisioning external meeting |
| `paw reminders list` | `--status`, `--from`, `--to`, `--json` | list due occurrences |
| `paw reminders snooze <id>` | `--minutes`, `--request-id` | snooze one occurrence |
| `paw reminders acknowledge <id>` | `--request-id` | ack one occurrence |
| `paw integrations status` | `--json` | see provider status (redacted) |
| `paw theme set` | `--mode light|dark|system`, `--preset`, `--density` | set validated theme |
| `paw config show` | `--effective`, `--redact` | inspect nonsecret app config |
| `paw ai propose` | `--input`, `--json` | P1: proposal only, never execution |
| `paw approvals decide <id>` | `--decision approve|reject`, `--hash` | P1: exact action digest approval |

### Argument validation policy
- `--start`, `--end`, `--due`: RFC3339 with explicit timezone/offset; store normalized UTC; for local recurrence use `--tz` IANA.
- `--priority`: `low|normal|high|urgent`; `--status`: `todo|in_progress|blocked|done` (proposed).
- `--remind`: repeated `--remind 60m --remind 10m` or canonical structured grammar to finalize in Phase 0; must validate nonnegative offset.
- `--json`: machine readable, no secrets; stdout data vs stderr diagnostics.
- `--dry-run` (proposed for mutating commands): validate and show impact without executing; if implemented, do not conflate with AI approval.
- `--idempotency-key`: proposed cross-channel API argument for external side effects; generate if omitted.
- Unknown flag: fail with nonzero exit code and usage; never silently ignore.
- Never define `--force`, `--no-approval`, `--root`, or unscoped shell pass-through for agent actions.

### Sample **NOT RUNNABLE YET**
```text
paw meeting create --provider zoom --title "Review KP" --start "2026-10-30T09:00:00+07:00" --duration 60m --tz Asia/Jakarta --remind 60m --remind 10m
paw tasks add --title "Revisi BAB V" --priority high --due "2026-10-30T14:00:00+07:00" --tz Asia/Jakarta
paw theme set --mode dark --preset ocean --density compact
```

## C. API params vs CLI flags vs feature flags
- `docs/API_CONTRACTS.md` defines HTTP request/body/query parameters.
- This file defines CLI program arguments.
- `docs/FEATURE_FLAGS.md` defines runtime **proposed** feature switches.
- `--permission-mode` belongs to *Claude Code*, not to `paw`.
- `--provider` belongs to the *planned* `paw meeting create`, not to Claude Code.

## References
https://code.claude.com/docs/en/cli-reference
https://code.claude.com/docs/en/headless
