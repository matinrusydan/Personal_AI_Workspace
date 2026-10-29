# ADR.md — Architecture Decision Register

Status codes: `PROPOSED`, `ACCEPTED`, `SUPERSEDED`. Baseline decisions accepted as design, not as implementation proof.

| ID | Status | Decision | Reason / consequence |
|---|---|---|---|
| ADR-001 | ACCEPTED | Modular monolith | single owner, operational simplicity; clearly scoped modules |
| ADR-002 | ACCEPTED | PostgreSQL authoritative | transactions, integrity, backup |
| ADR-003 | ACCEPTED | Redis + BullMQ delayed jobs | worker orchestration; DB reconciliation required |
| ADR-004 | ACCEPTED | Transactional outbox | reliability between business writes and event jobs |
| ADR-005 | ACCEPTED | REST `/api/v1` + OpenAPI | multi-client consistency |
| ADR-006 | ACCEPTED | SwiftUI + AlarmKit subject to Phase 0 proof | Native alarm mandatory; OS version/permissions gate |
| ADR-007 | ACCEPTED | Google/Zoom provider adapters | protect core from vendor changes |
| ADR-008 | ACCEPTED | AI immutable approval gateway | user-selected AI approval policy |
| ADR-009 | ACCEPTED | Isolated Claude Code coding worker | least privilege, PR not prod SSH |
| ADR-010 | ACCEPTED | Docker Compose target VPS | right-sized initial ops |
| ADR-011 | ACCEPTED | UTC instants + IANA timezones | recurrence and device correctness |
| ADR-012 | ACCEPTED | Dynamic semantic design tokens/themes | scalable UI consistency |
| ADR-013 | ACCEPTED | Local-first then VPS | minimize initial cost; plan callback strategy |
| ADR-014 | ACCEPTED | Hybrid MFA (TOTP + WebAuthn/Passkey) | Authenticator app (TOTP) baseline + optional Passkeys; offline hashed recovery codes; single-owner allowlist |
| ADR-015 | ACCEPTED | iOS 26.0+ Target & Headless CI Build | Target verified iPhone 12 (iOS 26.4.1); headless build via GitHub Actions (macOS runner) + Windows sideloading ($0 budget) |

## Details of Recent Decisions

### ADR-014: Authentication MFA Mechanism
- **Context:** Single-owner personal workspace requires robust protection against unauthorized access across public internet while remaining accessible from desktop and iPhone.
- **Decision:** Implement TOTP (RFC 6238) as the guaranteed primary second factor, complemented by WebAuthn/Passkeys for biometric convenience on supported devices. Generate single-use offline recovery codes (stored as salted hashes in DB).
- **Consequences:**
  - Owner must register an authenticator app (e.g. Google Authenticator / 1Password) during initial setup.
  - Recovery codes must be saved offline by the owner.
  - No SMS or third-party phone verification dependencies.

### ADR-015: iOS Deployment Target & Headless CI Build Path
- **Context:** The owner operates a Windows 11 desktop without a Mac computer and requires native AlarmKit alarm support on a physical iPhone 12 (verified running iOS 26.4.1). Budget constraint is $0 (avoiding $99/year Apple Developer fee).
- **Decision:**
  - Minimum iOS Deployment Target set to **iOS 26.0+**, ensuring full compatibility with Apple AlarmKit framework.
  - Swift compilation and `.ipa` packaging are executed headlessly via **GitHub Actions using macOS runners**.
  - Local installation to iPhone 12 is performed from the Windows desktop via sideloading tools (Sideloadly / AltServer) using a free personal Apple ID.
- **Consequences:**
  - Code changes to `apps/ios` must be committed and pushed to trigger cloud builds.
  - Sideloaded apps using free Apple IDs expire after 7 days and require weekly re-signing (can be automated locally via AltServer Wi-Fi sync).
  - Validates feasibility without requiring hardware purchase or upfront Apple subscription.

## Procedure
New ADR in `templates/ADR_TEMPLATE.md` -> impact on PRD/data/API/security/test -> alternatives -> owner approval -> update this register. Never edit history silently.
