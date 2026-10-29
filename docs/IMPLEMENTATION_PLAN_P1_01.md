# Implementation Plan — Milestone P1-01: Monorepo Scaffolding & Tooling

## Mode and approvals
- **Current mode:** PLANNING ONLY until explicit owner permission.
- **Approval scope:** Milestone P1-01 only (Monorepo scaffolding, workspace tooling, shared contracts, and CI pipeline).
- **Subsequent milestones (P1-02 to P1-04):** Strictly require separate, subsequent approval.

## Preflight evidence
- **Documents read:** `AGENTS.md`, `CLAUDE.md`, `PRD.md`, `TASK.md`, `docs/ARCHITECTURE.md`, `docs/API_CONTRACTS.md`, `docs/DATA_MODEL.md`, `docs/ADR.md` (ADR-001 through ADR-015), `docs/IOS_ALARM.md`, `docs/TEST_PLAN.md`.
- **Environment versions verified:**
  - OS: Windows 11 Home 10.0.26200
  - Node.js: `v22.16.0` (LTS)
  - pnpm: `v10.15.1`
  - Git: `C:\Program Files\Git\cmd\git.exe`
  - Target Mobile Device: iPhone 12 physical hardware running verified modern iOS 26.4.1
- **Existing files/branches and changes:**
  - Branch: Working tree on root directory `C:\laragon\www\Personal_AI_Workspace`.
  - Documentation pack v1.0 integrity preserved.

## Deliverables
1. **Monorepo Workspace Scaffolding:**
   - `package.json` (root): Configured with `private: true`, scripts (`build`, `test`, `lint`, `typecheck`, `format`), and package manager pinned to `pnpm@10.15.1`.
   - `pnpm-workspace.yaml`: Declares workspace members (`apps/*`, `packages/*`, `services/*`).
   - `.gitignore`: Standardized for Node.js, pnpm, TypeScript, Next.js, NestJS, Xcode/Swift, and local environment files (`.env*`).
2. **Unified Tooling & Strict Type Governance:**
   - `tsconfig.base.json`: Base TypeScript configuration with `strict: true`, `noImplicitAny: true`, `target: ES2022`, `moduleResolution: NodeNext`.
   - `.prettierrc` and `.prettierignore`: Code formatting consistency.
   - Root ESLint configuration enforcing TypeScript strict rules and avoiding raw hex color literals in component code (per `docs/DESIGN_SYSTEM.md`).
3. **Core Packages Foundation:**
   - `packages/contracts`:
     - Canonical OpenAPI 3.1 specification baseline (`openapi.yaml`) covering P0 REST endpoints defined in `docs/API_CONTRACTS.md`.
     - Script to generate typed TypeScript definitions (`openapi-typescript`).
   - `packages/config`: Type-safe environment variable schema using Zod, distinguishing local dev, staging, and prod variables.
   - `packages/database`: Package structure for Prisma/Kysely schemas and migrations (prepared for P1-03).
   - `packages/ui`: Package structure for design tokens and theme engine primitives.
4. **Automated CI Workflows:**
   - `.github/workflows/ci.yml`: Automated pull request validation (checkout, pnpm install, lint, typecheck, contract check).
   - `.github/workflows/ios-build.yml`: Headless macOS runner build pipeline for compiling `apps/ios` and producing `.ipa` artifacts (per ADR-015).

## Design approach / ADR alignment
- **ADR-001 (Modular Monolith):** Single repository organized with `pnpm` workspaces for clear domain boundaries and atomic dependency management.
- **ADR-005 (REST /api/v1 + OpenAPI):** `packages/contracts` serves as the single source of truth for API contracts, enabling code generation for TypeScript apps and Swift iOS clients.
- **ADR-012 (Semantic Design Tokens):** `packages/ui` enforces semantic tokens and contrast boundaries.
- **ADR-015 (iOS Target & Headless CI):** CI includes the automated macOS runner workflow for packaging `.ipa` files for Windows sideloading.

## Files to be created
```text
.gitignore
package.json
pnpm-workspace.yaml
tsconfig.base.json
.prettierrc
eslint.config.mjs
packages/
  contracts/
    package.json
    tsconfig.json
    src/
      openapi.yaml
      index.ts
  config/
    package.json
    tsconfig.json
    src/
      index.ts
      env.schema.ts
  ui/
    package.json
    tsconfig.json
    src/
      tokens.ts
      index.ts
  database/
    package.json
    tsconfig.json
.github/
  workflows/
    ci.yml
    ios-build.yml
```

## Validation & Test Plan
- **Workspace Resolution:** Run `pnpm install` at root; confirm lockfile `pnpm-lock.yaml` is generated without peer dependency conflicts or cyclic references.
- **Strict Typecheck:** Run `pnpm typecheck`; confirm all workspace packages compile cleanly with zero TypeScript errors.
- **Lint Check:** Run `pnpm lint`; verify rules pass across root and packages.
- **Contract Integrity:** Validate `openapi.yaml` with a schema validator; verify TypeScript types are generated cleanly into `packages/contracts/src/generated.ts`.
- **Physical iOS Device Check:** N/A for P1-01 (Swift source scaffolding follows in Phase 3; CI workflow syntax validated in P1-01).
- **External Provider Check:** N/A for P1-01 (Mock contracts only; no network calls to Google/Zoom).

## Security / secrets / rollback / costs
- **Zero Secrets Policy:** No API keys, credentials, or client secrets in configuration files. All configurations use `.env.example` placeholders.
- **Cost:** $0 (Local execution + free GitHub Actions public/private tier).
- **Rollback Strategy:** All changes are additive workspace scaffolding files. Rollback can be performed cleanly by deleting the newly generated scaffolding files without affecting the existing documentation pack.

## Decisions required before execution
- [x] Target runtime confirmed: Node.js v22.16.0 + pnpm v10.15.1.
- [x] Monorepo tool confirmed: pnpm workspaces (lightweight, native, zero extra runtime).
- [x] OpenAPI baseline confirmed: YAML specification based on `docs/API_CONTRACTS.md`.

## Go / No-Go
- [ ] Owner authorizes exact scope of Milestone P1-01.
- [x] Dependencies available (Node.js, pnpm, Git verified).
- [x] Test plan and validation criteria approved.
