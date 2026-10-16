# irbis-app

**Bare React Native** (no Expo — never add `expo-*` packages, Expo Router, EAS or prebuild).
iOS + Android, New Architecture, Hermes. `ios/` and `android/` are committed source.

**Before any change read:** `docs/architecture.md` (structure, stack, decisions) and
`docs/engineering-standards.md` (definition of done — its Quick gate must pass).
Project-wide rules: `../irbis-docs/CLAUDE.md`. Tokens: `../irbis-docs/design/design.md`.

## Commands
- `npm run check` — lint + typecheck + tests + slop grep, failures only. Green before "done".
- `npm run gen:api` — orval from `../irbis-api/openapi.json` → `src/shared/api/generated/`. Never edit generated files.
- `npm run test -- <path>` — single test file (Jest + Testing Library).
- `cd ios && LANG=en_US.UTF-8 pod install` — after any native dependency change.
- `npm run ios` / `npm run android` — run on simulator/emulator.

## Layout (details in docs/architecture.md)
- `src/app/` — App.tsx, providers, `navigation/` (typed param lists in `types.ts`).
- `src/features/<slug>/` — screens, components, hooks, schemas. Never import another feature.
- `src/shared/` — api (client, generated, tokenManager), components, constants (tokens), contexts, hooks, i18n, storage, utils.

## Shared modules — check before creating anything new
- `shared/components/` — Screen, Pressable, AppText, AppButton, TextField, Icon, Toast, Skeleton, EmptyState, ErrorState, OfflineBanner, ListRow, Sheet
- `shared/utils/` — haptics, format (Intl), geo, time
- `shared/hooks/` — useNetworkStatus, usePermission, useDebounce, useAppState
- `shared/api/client.ts` — the only axios instance; `tokenManager.ts` — the only Keychain user
- `shared/storage/` — the only MMKV user

## Non-negotiables (from the standards)
Tokens only, `StyleSheet.create` at module scope · Reanimated for all motion · haptics via `shared/utils/haptics` ·
safe area via `Screen` · keyboard-controller for inputs · generated hooks only · four data states ·
toasts on mutations · i18n for every string · a11y labels · tokens in Keychain, never MMKV ·
`testID` on interactive/asserted elements + spec's QA events via `shared/utils/qaLog` (standards §16).
