# IOS_ALARM.md — Native Alarm MVP Feasibility & Protocol

## Decision
Native iPhone alarm from MVP (P0) is locked by owner. Apple **AlarmKit** framework supports prominent alarms, one-time/repeating schedules and snooze on supported iOS versions. Apple sample states alarms can override Focus and silent mode when needed. **Not equivalent to an unconditional guarantee on every device/version**. Verify supported OS version and current Apple API docs before coding. Sources in `REFERENCES.md`.

## Current verification status (2026-10-30)
- The checked-in iOS code defaults to a loopback address (`http://127.0.0.1:4000/api/v1`), which does not reach the development computer from an iPhone.
- `ContentView` contains demo alarms and simulated authorization; AlarmKit calls are not live on a physical device.
- Native login, token storage, and verified pairing are not implemented.
- The checked-in GitHub Actions workflow packages a placeholder text file, not an application IPA.
- Sideloading and native physical-device verification remain a separate milestone (**BLOCKED_PHYSICAL**); accessing the workspace through iPhone Safari does not provide native alarms.

## Mandatory Phase 0 spike / go-no-go
1. Validate exact supported iOS deployment target and actual available iPhone OS version(s); identify whether older devices require explicit unsupported status/fallback.
2. Confirm distribution method (local development/TestFlight/App Store, Apple Developer account) and build/signing with macOS/Xcode. Windows cannot perform standard native iOS compilation/signing in isolation.
3. Test AlarmKit authorization request and denial/revocation, including `NSAlarmKitUsageDescription` per Apple guidance.
4. Create one-time alarm and repeating schedule; snooze, cancel, reschedule (change calendar event), idempotent update.
5. Physical device matrix: app foreground/background/terminated, screen locked, silent switch, Focus, offline, after restart, timezone travel, DST, low-power state if relevant. Record observed behavior and limits, do not assume identical Clock semantics.
6. Determine what delivery/trigger/ack telemetry the API exposes; never claim OS displayed sound without measurable evidence.
7. Document sound customization/AlarmKit UI capabilities and restrictions from API, user settings and distribution entitlements.
8. Obtain owner signoff on practical behavior, unsupported OS handling and test evidence.

## Architecture contract
- Server = authoritative intent (`reminder_occurrences` due time + target device policy).
- Device = on-device scheduler; sync desired state, schedule via AlarmKit after consent, return scheduling result and opaque platform identifier.
- Sync request version and unique `(deviceId, occurrenceId)` prevent duplicate alarms.
- iPhone persists necessary mapping locally, reconciles after foreground/app wake, token refresh, and reset; time-critical schedules need sufficiently early device sync.
- Prefer local scheduled alarms for offline operation; APNs/Telegram are adjunct delivery and **cannot** guarantee alarm when device is unreachable/not provisioned.
- Device alarm state: `pending_sync|schedule_requested|scheduled|failed|canceled|acknowledged|snoozed|unknown` (proposed).
- Alarm acknowledgment can arrive after offline period; server resolves idempotently with authoritative user action times and policy.

## Safety and user messaging
UI explicitly displays: device compatible? permission granted? last successful sync? next alarm locally scheduled? If no device sync/permission, show **not ready** state and suggest manual backup alarm; do not use success green for `pending`.

## Acceptance evidence
A matrix with tested OS/device, permission state, time zone, network, Focus/silent, app state, expected/observed alarm, schedule confirmation, ack synchronization, video/log evidence if appropriate. Test failures produce BLOCKED status; owner may explicitly re-scope by ADR only.

## Headless macOS Build Pipeline (GitHub Actions Specification)
*Approved via ADR-015 for Windows desktop development with zero hardware/Apple account cost.*

### 1. Workflow Architecture
- **Trigger:** Manual dispatch (`workflow_dispatch`) or push to `main` with changes in `apps/ios/**`.
- **Runner:** `macos-15` / `macos-latest` (free tier GitHub Actions).
- **Toolchain:** Xcode (latest compatible toolchain with iOS 26 SDK support).
- **Output:** Unsigned/Ad-hoc signed `.ipa` uploaded as a build artifact.

### 2. Workflow Specification (`.github/workflows/ios-build.yml` — Design Spec)
```yaml
name: iOS Native Alarm Build
on:
  workflow_dispatch:
  push:
    paths:
      - 'apps/ios/**'
      - '.github/workflows/ios-build.yml'

jobs:
  build-ios:
    runs-on: macos-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Select latest Xcode
        run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

      - name: Build and package .ipa (Ad-Hoc / Sideloading profile)
        run: |
          cd apps/ios
          xcodebuild clean build \
            -project PersonalAIWorkspace.xcodeproj \
            -scheme PersonalAIWorkspace \
            -configuration Release \
            -destination "generic/platform=iOS" \
            -derivedDataPath build \
            CODE_SIGN_IDENTITY="" \
            CODE_SIGNING_REQUIRED=NO \
            CODE_SIGNING_ALLOWED=NO

          # Create Payload directory for .ipa archive
          mkdir -p build/Payload
          cp -r build/Build/Products/Release-iphoneos/PersonalAIWorkspace.app build/Payload/
          cd build
          zip -r PersonalAIWorkspace.ipa Payload

      - name: Upload .ipa Artifact
        uses: actions/upload-artifact@v4
        with:
          name: personal-ai-workspace-ios-ipa
          path: apps/ios/build/PersonalAIWorkspace.ipa
          retention-days: 7
```

### 3. Sideloading Execution on Windows
1. Owner downloads `PersonalAIWorkspace.ipa` from GitHub Actions run artifacts.
2. Open Sideloadly (or AltServer) on Windows 11.
3. Connect iPhone 12 via USB cable (or enable Wi-Fi sync in iTunes/Apple Devices app).
4. Drag and drop `PersonalAIWorkspace.ipa`, enter personal Apple ID, and start installation.
5. On iPhone 12: navigate to *Settings > General > VPN & Device Management*, trust developer profile, and launch app.

## Official references
- https://developer.apple.com/documentation/alarmkit
- https://developer.apple.com/documentation/AlarmKit/scheduling-an-alarm-with-alarmkit
- https://developer.apple.com/videos/play/wwdc2025/230/
