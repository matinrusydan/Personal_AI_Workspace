# UI_INFORMATION_ARCHITECTURE.md — Screens and UX Flows

## Navigation MVP
- Overview (today/next 7 days, tasks due, meetings, alarm readiness).
- Calendar (agenda/day/week/month; provider filter; overlap warnings; timezone).
- Tasks (list/board, projects, tags, recurring, progress).
- Meetings (create Google Meet/Zoom, view provisioning state, link and attendees).
- Reminders (schedule, devices, escalation, ack/snooze, test alarm).
- Integrations (Google OAuth, Zoom OAuth, Telegram connection health).
- Settings (profile, security/MFA, devices, notifications, theme builder, data export).
- Activity/Audit (recent user operations; later agent actions).

## Universal patterns
- Primary Create action in desktop header and mobile bottom nav/FAB as appropriate; action options keyboard accessible.
- Statuses use text+icon, never color only: `pending`, `confirmed`, `failed`, `unsynced`, `acknowledged`.
- Meeting creation has provider choice, preview timezone and conflict check, idempotent submit + state loader.
- Reminder creation displays device readiness and whether alert is **native alarm**, **push**, or **Telegram**; do not collapse into single misleading bell indicator.
- Inline empty/loading/error/offline states, retry CTA without duplicate side effect, optimistic UI only for safe local update.
- Theme editor preview with token constraints, avoid flashing invalid colors; persist preference and allow reset.

## Responsive compositions
Desktop: side rail, multi-column agenda/tasks, quick command palette. iPhone PWA: bottom navigation, single-column cards, calendar agenda. Native iOS: alarm-focused UX and account/device integration, accessible native controls, app visual identity shares semantic design language (not web CSS renderer).

## Accessibility acceptance
Focus visible, full keyboard navigation, screen reader field labels, date-time formats locale-aware, reduced-motion and large text, contrast tested on custom theme variants, modal focus management, safe-area insets.

## Deferred screens
AI chat, Approval Inbox, Workflow Editor, Plugin Marketplace/Registry and Obsidian memory explorer follow P1/P2 milestones.
