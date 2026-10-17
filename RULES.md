# irbis-app — rules for a coding run (read this, not the full docs)

Full detail only if the brief points you there: `docs/architecture.md`, `docs/engineering-standards.md`.

## Shape
- **Bare React Native 0.88 — never Expo.** React Navigation 7 (root stack → bottom tabs), TanStack Query,
  orval hooks over the one axios client, react-hook-form + generated zod, Reanimated 4, i18n-js (uz/ru/en), Jest + RNTL.
- `src/app/` (providers, navigation + typed params) · `src/features/<slug>/` (screens, components, hooks, schemas — never
  import another feature) · `src/shared/` (api, components, constants = tokens, hooks, i18n, storage, utils).
- Reuse before writing: `shared/components` (Screen, Pressable, AppText, AppButton, TextField, Icon, Toast, Skeleton,
  EmptyState, ErrorState, OfflineBanner, StatusChip, ComingSoon, Sheet), `shared/hooks`, `useRequireAccount(reason)`
  for anything that saves or earns, guest-merge registry, `qaLog`, `haptics`.
- API only via `npm run gen:api` hooks (never hand-written fetch/types; never edit `src/shared/api/generated/`).

## Every screen (the Quick gate, short form)
Tokens only (`StyleSheet.create`, no raw hex / magic numbers) · light + dark · safe areas via `Screen` ·
keyboard-controller around inputs · loading skeleton / empty / error + retry / offline · toast + haptic on mutations ·
press states · every string via i18n in uz, ru AND en · a11y labels · `testID` on everything a test touches
(names from the brief) · QA events from the brief via `qaLog`. XP/levels/badges never optimistic.

## Tests (budget)
1–3 RNTL tests per AC in the brief (render → act → assert visible state / QA event), network mocked at HTTP.
Don't re-test shared components; don't snapshot.

## Commands — quiet, always
- `npm run check` (lint · typecheck · jest · slop; failures only). Green = done.
- `npm i --silent --no-audit --no-fund <pkg>` only for packages the brief approves (must support bare RN + New Arch).
- Build only when the brief asks: `cd android && ./gradlew assembleDevRelease -PreactNativeArchitectures=arm64-v8a -q`
  (JAVA_HOME=$(/usr/libexec/java_home -v 17), ANDROID_HOME=$HOME/Library/Android/sdk), output `| tail -20`.
- Long output: `… 2>&1 | tail -30`. Screenshots: downscale before looking (one at most).

## Finish
Commit on the branch the brief names (Conventional message + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`),
no push. Reply ≤10 lines: what changed, deviations, last line of `npm run check`.
