# DESIGN_SYSTEM.md — Dynamic Design System v1.0

## Vision
Modern, custom, calm productivity interface yang **dinamis dan themeable** untuk dashboard web desktop, iPhone PWA, dan pedoman visual iOS native. Tidak bergantung pada satu palet warna atau dashboard template. Semua komponen menggunakan design tokens semantik; UI tetap aksesibel dan konsisten saat plugin/fitur bertambah.

## 1. Layered tokens (proposed)
1. `primitive`: palette ramps, spacing scale, radii, typography, durations, shadows.
2. `semantic`: surface/canvas, text, border, action, destructive, warning, success, focus-ring; dark/light values berbeda.
3. `component`: input-height, button-radius, nav-width, calendar-event-padding, modal-elevation (refer semantic).
4. `context`: sidebar, workspace cards, calendar density, notification urgency; plugin memakai contract sama.

**Token naming convention** CSS variables `--paw-color-bg-canvas`, `--paw-color-text-primary`, `--paw-space-4`, `--paw-radius-lg`, `--paw-motion-fast`, `--paw-z-modal`. Semantics never map directly to arbitrary provider brand colors. Maintain token metadata: name, type, description, light/dark values, fallback, deprecated.

## 2. Theme engine
- Mode `light`, `dark`, `system`; user preference persisted server-side and cached locally without PII.
- Theme `default`, `forest`, `ocean`, `custom`; themes are config, NOT copies of CSS/component code.
- Custom theme builder (MVP): accent + background/foreground presets + density + font scale + border radius within validated bounds; preview before save and reset to safe default.
- Palette semantic derivation validated against contrast; invalid combinations rejected or automatically corrected (with notice).
- Server stores `themeId`, `themeVersion`, `overrides` (allowlisted tokens only), `mode`, `density`; schema migratable.
- Avoid FOUC: server or bootstrapping script applies theme before hydration using secure, validated preferences.
- Preserve focus outlines and error states when colors customized; browser system forced-colors/high-contrast support.

## 3. Layout primitives and composition
- Layout primitives: `AppShell`, `Sidebar`, `Topbar`, `PageHeader`, `Stack`, `Inline`, `Grid`, `Container`, `Section`, `ResponsiveDialog`.
- Foundation: `Button`, `Input`, `Select`, `DateTimePicker`, `Checkbox`, `Switch`, `Popover`, `Tooltip`, `Toast`, `Dialog`, `Drawer`, `Tabs`, `Badge`, `Skeleton`, `EmptyState`.
- Product compositions: `TaskCard`, `ProjectBoard`, `AgendaTimeline`, `CalendarGrid`, `MeetingCard`, `ReminderRuleEditor`, `AlarmStatus`, `ApprovalPreview`, `WorkflowCanvas` (P1).
- Components must accept theme via context/token system, semantic variants, size/density, disabled/loading/error; no direct `#hex` or fixed px outside primitive config without ADR.
- UI library candidate: Radix primitives + Tailwind + shadcn/ui as scaffold, **not** unchangeable source of truth. Own token API and component wrappers.

## 4. Responsive behavior
- Mobile-first; suggested breakpoints: compact <640px, medium 640–1023px, wide >=1024px (initial proposal, validate in tests).
- Desktop sidebar -> iPhone bottom navigation or accessible collapsible navigation; no important action hover-only.
- Calendar: mobile agenda/list view; desktop week/month; accessible keyboard alternatives.
- Prefer 44x44 pt touch targets on iPhone as ergonomic baseline; CSS px mapping to be evaluated in implementation.
- Support safe area, dynamic type/font scaling, reduced motion and orientation changes.

## 5. Accessibility and motion
- Target WCAG 2.2 AA for web; semantic landmarks, labels, SR announcements, focus order, full keyboard paths.
- Contrast target >=4.5:1 normal text, >=3:1 large text or nontext UI indicators as applicable.
- Error indication not solely color; labels and icons; chart has tabular alternative.
- Honor `prefers-reduced-motion`; animation 120–220ms default only for noncritical transitions; no animation required for alarm reliability.
- Localization via translation keys, long Indonesian labels, UTC/timezone view, 12/24 hour formatting and RTL-ready tokens later.

## 6. Plugin-ready design system
Plugins register UI extensions through declared *slots* (e.g. task-detail-panel, dashboard-widget) and manifest with permission, navigation title/icon, schema version; plugin cannot inject arbitrary CSS/JS into host without sandbox/review. Plugin styles must inherit semantic tokens. Unknown token key rejected; feature flag guards rollout. No live plugin marketplace in MVP.

## 7. Example **documentation only** token mapping
```yaml
# illustrative concept; NOT runnable config
modes:
  light:
    color.bg.canvas: '#F8FAFC'
    color.text.primary: '#0F172A'
  dark:
    color.bg.canvas: '#0B1220'
    color.text.primary: '#F1F5F9'
semantic:
  color.action.primary: '{palette.accent.600}'
  color.focus.ring: '{palette.accent.500}'
component:
  button.radius: '{radius.md}'
  card.padding: '{space.4}'
```
Theme generator must validate contrast instead of blindly using examples. See `FEATURE_FLAGS.md` for controlled rollout.

## 8. Governance
- New component requires usage, variants, keyboard behavior, a11y examples, theme screenshots in light/dark/custom, responsive states, tests.
- Breaking token change requires migration/deprecation and ADR.
- Design review gate: dark/light/system + custom theme, accessibility, responsive and no hardcoded theme in feature modules.
