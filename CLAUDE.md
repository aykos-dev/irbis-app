# irbis-app

Expo + Expo Router (React Native). Project-wide rules: `../irbis-docs/CLAUDE.md`. Versions: `../irbis-docs/PROJECT.md`.
Expo APIs change between SDKs: check Context7 for the pinned SDK before using an unfamiliar API.

## Commands
- `npm run check` — lint + typecheck + tests + slop grep, failures only. Must be green before "done".
- `npm run gen:api` — orval from `../irbis-api/openapi.json` → `src/api/generated/`. Never edit generated files.
- `npx expo install <pkg>` — only after approval; keeps versions SDK-compatible.
- `npm run test -- <path>` — single test file.

## Layout
- `app/` — Expo Router routes only; thin, import screens from features.
- `src/features/<slug>/` — screens, components, hooks for that feature. No imports from other features.
- `src/api/generated/` — typed client + TanStack Query hooks. The only way to call the API.
- `src/components/ui/` — shared primitives. `src/theme/tokens.ts` — all colours/spacing/type.

## Shared modules — check before creating anything new
<!-- Keep this list current. -->
- `src/components/ui/` — Screen (safe area + keyboard avoiding), Button, TextField, EmptyState, ErrorState, Spinner, Toast
- `src/lib/` — formatDate, formatNumber, location helpers
- `src/api/mutator.ts` — the single HTTP client (auth header, refresh, error mapping)
- Tokens stored only via `expo-secure-store`

## Errors and states
Every screen: loading, empty, error (with retry), offline, permission denied.
Wrap screens in `Screen` (safe areas + keyboard). Root error boundary + toasts for mutation errors.
