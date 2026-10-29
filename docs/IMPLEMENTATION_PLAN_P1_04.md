# Implementation Plan — Milestone P1-04: Token-Based Responsive Web Shell & Adaptive Theme Engine

## Mode and approvals
- **Current mode:** PLANNING ONLY until explicit owner permission to execute.
- **Approval scope:** Milestone P1-04 only (Next.js App Router Web Application, Token-based Adaptive Theme Engine, Responsive Desktop & Mobile Shell, PWA Manifest, and UI Smoke Tests).
- **Gate:** Completes Phase 1 (Platform Core). Phase 2 milestones strictly require separate, subsequent approval.

## Preflight evidence
- **Documents read:** `AGENTS.md`, `CLAUDE.md`, `PRD.md`, `TASK.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/UI_INFORMATION_ARCHITECTURE.md`, `docs/ADR.md` (ADR-012: Dynamic Semantic Design Tokens/Themes), `docs/TEST_PLAN.md`.
- **Environment verified:** Node.js v22.16.0, pnpm v10.15.1, Git; workspace packages (`@paw/contracts`, `@paw/config`, `@paw/ui`, `@paw/database`) and services (`apps/api`, `apps/worker`) fully operational and tested.
- **Zero Secrets Policy:** Web frontend will never store or expose OAuth refresh tokens, JWT signing secrets, or private keys.

## Deliverables
1. **Next.js Web Application Scaffolding (`apps/web`):**
   - Next.js (App Router) initialized with React 19, TypeScript, and Tailwind CSS configured to consume CSS variables from `@paw/ui`.
   - Integration with workspace packages: `@paw/ui`, `@paw/contracts`, and `@paw/config`.
2. **Adaptive Theme Engine (ADR-012 & `docs/DESIGN_SYSTEM.md`):**
   - Zero-FOUC (Flash of Unstyled Content) theme injection script reading stored preferences (`light`, `dark`, `system`).
   - Theme presets: `default` (Slate/Blue), `forest` (Emerald/Sage), `ocean` (Cyan/Sky).
   - Real-time WCAG 2.2 AA contrast validator enforcing minimum 4.5:1 ratio for text and 3:1 for interactive borders.
   - Dynamic CSS variable mapping (`--paw-color-bg-canvas`, `--paw-color-text-primary`, `--paw-color-action-primary`, `--paw-radius-*`, `--paw-space-*`).
3. **Responsive App Shell (`AppShell`):**
   - **Desktop Layout:** Accessible collapsible `Sidebar`, top bar with user profile/status, and central workspace canvas.
   - **Mobile PWA Layout:** Ergonomic bottom navigation bar with 44pt touch targets, safe-area inset support, and sticky header.
   - Global status badges using text + icons (never color alone): `pending`, `confirmed`, `failed`, `unsynced`.
4. **Core Navigation Shell Pages (P0 Placeholders):**
   - `/`: Overview Dashboard (Today's agenda summary, task counts, alarm readiness indicator).
   - `/calendar`: Calendar agenda view skeleton.
   - `/tasks`: Tasks & projects list skeleton.
   - `/meetings`: Google Meet & Zoom meeting launcher skeleton.
   - `/reminders`: Reminders & native alarm readiness status.
   - `/settings`: Theme Switcher (mode, preset, contrast preview) & Profile settings.
5. **Mobile PWA Capabilities:**
   - Web App Manifest (`manifest.json`) configured for standalone display on iPhone/Android with adaptive theme colors.
6. **Frontend Unit & Component Tests:**
   - Vitest + Testing Library test suite verifying:
     - Theme context switches between `light`, `dark`, and `system`.
     - Contrast validator prevents invalid color pairings.
     - Responsive shell renders accessible navigation landmarks and labels.

## Design approach / ADR alignment
- **ADR-001 (Modular Monolith):** Frontend decoupled into `apps/web`, communicating strictly via typed API client from `@paw/contracts`.
- **ADR-012 (Dynamic Semantic Design Tokens):** Zero hardcoded hex values in component templates; all colors derived from semantic CSS tokens.
- **`docs/DESIGN_SYSTEM.md`:** Mobile-first responsive breakpoints: Compact (<640px), Medium (640-1023px), Wide (>=1024px).
- **`docs/SECURITY.md`:** All API requests use HttpOnly cookie or in-memory Bearer token; client bundle contains zero private backend secrets.

## Files to be created
```text
apps/
  web/
    package.json
    tsconfig.json
    next.config.mjs
    tailwind.config.ts
    postcss.config.mjs
    src/
      app/
        layout.tsx
        page.tsx
        globals.css
        manifest.json
        calendar/page.tsx
        tasks/page.tsx
        meetings/page.tsx
        reminders/page.tsx
        settings/page.tsx
      components/
        layout/
          AppShell.tsx
          Sidebar.tsx
          BottomNav.tsx
          Header.tsx
        theme/
          ThemeProvider.tsx
          ThemeSwitcher.tsx
      test/
        theme.spec.ts
```

## Validation & Test Plan
- **Lint & Formatting:** `pnpm run lint` and `pnpm run format:check` pass 100% across the monorepo.
- **Strict Typecheck:** `pnpm run typecheck` passes with 0 errors across all 7 workspace projects.
- **Component Tests:** `pnpm --filter @paw/web test` passes all theme switching and contrast tests.
- **Next.js Production Build:** `pnpm --filter @paw/web build` compiles the Next.js App Router site with zero errors and outputs static/dynamic routes cleanly.
- **Full Monorepo Test Run:** `pnpm test` executes and passes all test suites across `apps/api`, `apps/worker`, and `apps/web`.

## Security / secrets / rollback / costs
- **Zero Secrets:** Frontend client bundle contains zero API keys or tokens.
- **Cost:** $0 (Local execution).
- **Rollback Strategy:** Clean deletion of `apps/web` directory without impacting backend or core packages.

## Go / No-Go
- [ ] Owner authorizes exact scope of Milestone P1-04.
- [x] Dependencies available (Node.js, pnpm, `@paw/ui`, `@paw/contracts`).
- [x] Implementation Plan reviewed and aligned with ADR-012.
