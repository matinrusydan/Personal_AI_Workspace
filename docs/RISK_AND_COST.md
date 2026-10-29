# RISK_AND_COST.md — Risk Register & Budget Guardrails

## Risk ranking
| Risk | Likelihood | Impact | Owner response |
|---|---|---|---|
| iPhone native alarm behavior incompatible with owner expectations | medium | critical | physical feasibility gate + explicit scope agreement |
| Missing Mac/Xcode build/sign path | high if only Windows | critical | identify Mac/macOS CI before code |
| Google/Zoom permissions/meeting API restrictions | medium | high | account-specific proof/adapter support |
| Reminder duplicate or lost after crashes | medium | critical | outbox/reconcile/idempotency |
| AI prompt injection/over-broad shell access | medium | critical | approval gateway/sandbox P1 |
| OAuth credential compromise | medium | critical | encryption/scoped permissions/rotation |
| Cost overruns (AI/API/VPS) | unknown | medium | budget cap + monthly report |
| VPS 8GB too constrained | medium | medium | monitor, resource limits, outsource heavy CI |
| Shared Obsidian vault privacy leakage | medium | high | explicit folder allowlist P2 |

## Budget (NOT priced yet)
Cost categories: VPS + volume, off-host encrypted backups, domain/TLS (TLS may be free), managed SMTP if needed, provider pricing/quotas, model API tokens, macOS CI/build/signing, Apple Developer program where applicable, Zoom account plan where applicable. Avoid falsely quoting current vendor prices without regional verification.

## Policy
Owner chooses monthly `hard budget ceiling`, AI API cost ceiling, developer/CI budget, retention. Agent must not purchase services or enable paid provider features without owner approval. Claude Code `--max-budget-usd` is an estimated run cap, **not** a billing hard stop; enforce billing-level budgets independently.

## Change management
Maintain risk register update at each phase gate, including unresolved assumptions, owner sign-off and fallback strategy.
