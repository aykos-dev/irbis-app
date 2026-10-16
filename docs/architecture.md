# irbis-app — Architecture

The Irbis end-user mobile app for iOS and Android. Users discover verified **spots**, check in
when they are physically there, and earn **XP**. (Product summary: `irbis-docs/PROJECT.md`.)

> **Bare React Native. No Expo** — no Expo SDK, Expo Router, EAS, `expo-*` packages or
> Expo prebuild. Native projects in `ios/` and `android/` are source code, committed and owned.

Companion documents — both mandatory:

- **[`engineering-standards.md`](./engineering-standards.md)** — the definition of done for every
  feature (animation, haptics, safe area, keyboard, tokens, data layer, navigation, validation,
  toasts, four data states, a11y, i18n, security, testing).
- **`irbis-docs/design/design.md`** — the design-token source of truth.

---

## Tech Stack

Pinned. Do not substitute or add libraries without explicit approval (recorded below or as an
ADR in `irbis-docs/decisions/`). Versions are the latest stable as of 2026-10-16 — replace with
the exact versions installed at scaffold time.

| Layer | Technology | Version |
| ----- | ---------- | ------- |
| **Framework** | React Native (bare, New Architecture, Hermes) + React | 0.88 / 19.3 |
| **CLI** | `@react-native-community/cli` | 20.x |
| **Language** | TypeScript strict | per `PROJECT.md` |
| **Navigation** | React Navigation 7 (Native Stack + Bottom Tabs) | 7.x |
| **Server state** | TanStack Query 5 | 5.x |
| **API client** | **orval**-generated hooks + zod schemas over **axios** | orval 8 / axios 1.x |
| **Forms** | react-hook-form + zod | 7.x / 4.x |
| **Animation** | react-native-reanimated 4 + react-native-worklets | 4.7 / 0.13 |
| **Gestures** | react-native-gesture-handler | 3.x |
| **Screens** | react-native-screens | 4.x |
| **Bottom sheets** | @gorhom/bottom-sheet | 5.x |
| **Lists** | @shopify/flash-list | 2.x |
| **Secure storage** | react-native-keychain (tokens) | 10.x |
| **Local storage** | react-native-mmkv (prefs, drafts) | 4.x |
| **i18n** | i18n-js + react-native-localize | 4.x / 3.x |
| **Haptics** | react-native-haptic-feedback | 3.x |
| **Keyboard** | react-native-keyboard-controller | 1.x |
| **Safe area** | react-native-safe-area-context | 5.x |
| **Network status** | @react-native-community/netinfo | 12.x |
| **Icons / SVG** | react-native-svg + `@react-native-vector-icons/*` behind `shared/components/Icon.tsx` | 15.x / 13.x |
| **Config** | react-native-config (public build-time values only) | 1.x |
| **Splash** | react-native-bootsplash | 7.x |
| **Tests** | Jest + @testing-library/react-native | 30 / 14 |

**Planned — approve when the first feature needs it** (each must support bare RN 0.88 + New
Architecture; verify before adding):

| Need | Candidate | First feature |
| ---- | --------- | ------------- |
| Location | `react-native-permissions` + `@react-native-community/geolocation` | spot-checkin |
| Maps | `react-native-maps` | spots |
| Push | `@react-native-firebase/app` + `/messaging` | notifications |
| Images | `react-native-image-picker` | profile |
| Liquid Glass | TBD (no Expo packages) | — |

How the less obvious libraries earn their place:

- **Keychain** — access + refresh tokens. Never MMKV: MMKV is not a secret store.
- **MMKV** — persisted prefs (locale, map/list view choice), form drafts, last-known-good UI state.
- **@gorhom/bottom-sheet** — pickers, filters, confirmations: sheets, not screens.
- **flash-list** — any unbounded list (spots, history, leaderboards later).
- **orval** — types, query hooks, query keys and zod schemas generated from the API's OpenAPI
  spec; contract drift becomes a compile error.

### Design system

Tokens are **not** defined in code by hand. `irbis-docs/design/design.md` is the source of truth
(shared with `irbis-web`); `shared/constants/{colors,typography,spacing}.ts` mirror its token
block verbatim and are the only place raw hex or font sizes may appear. New visual values go
into `design.md` first.

Fonts: `.ttf`/`.otf` files in `src/assets/fonts/`, linked via `react-native.config.js` +
`npx react-native-asset`. Select weight by family name, not `fontWeight`.

---

## Directory Structure

```
irbis-app/
├── android/  ios/               # Native projects — real source, committed
├── index.js                     # AppRegistry entry → src/app/App
├── orval.config.ts              # input ../irbis-api/openapi.json → src/shared/api/generated
├── react-native.config.js       # font assets
└── src/
    ├── app/                     # App shell
    │   ├── App.tsx              # Root component
    │   ├── providers.tsx        # Provider hierarchy (see below)
    │   └── navigation/
    │       ├── RootNavigator.tsx  # Auth flow ↔ Main flow
    │       ├── TabNavigator.tsx   # Bottom tabs
    │       ├── linking.ts         # Deep-link config
    │       ├── navigationRef.ts   # Navigation outside React (push, links)
    │       └── types.ts           # All param lists, fully typed
    │
    ├── assets/                  # fonts, svg, images
    │
    ├── features/                # Vertical slices — same slug as irbis-api / irbis-web
    │   ├── auth/                # sign up, sign in, OTP, session restore
    │   ├── profile/             # own profile, XP total, settings entry
    │   ├── spots/               # list, map, spot detail
    │   ├── spot-checkin/        # location check, check-in, XP result
    │   └── debug/               # network log, env info (dev builds only)
    │
    └── shared/                  # Cross-cutting — features import from here, never from each other
        ├── api/
        │   ├── generated/       # orval output — NEVER edited by hand
        │   ├── client.ts        # axios instance + interceptors (orval mutator)
        │   ├── errors.ts        # ApiError type + normaliser
        │   ├── tokenManager.ts  # Keychain token storage + single-flight refresh
        │   ├── query.ts         # QueryClient config (stale times, retry policy)
        │   └── queryKeys.ts     # Keys not backed by a generated endpoint
        ├── components/          # Primitives: Screen, Pressable, AppText, AppButton,
        │                        #   TextField, Icon, Toast, Skeleton, EmptyState,
        │                        #   ErrorState, OfflineBanner, ListRow, Sheet…
        ├── constants/
        │   ├── colors.ts        # Mirrors design.md colour block
        │   ├── typography.ts    # Mirrors design.md typography block
        │   ├── spacing.ts       # Spacing, radii, elevation
        │   └── config.ts        # Typed read of react-native-config (public values only)
        ├── contexts/
        │   ├── auth.tsx         # AuthContext (session state, signIn/signOut)
        │   └── theme.tsx        # ThemeContext (tokens, light/dark)
        ├── hooks/               # useNetworkStatus, usePermission, useDebounce, useAppState…
        ├── i18n/                # setup + <locale>/<feature>.json
        ├── storage/             # MMKV instance + typed keys
        ├── types/               # App-only types (never API shapes — those are generated)
        └── utils/               # haptics, format (Intl), distance/geo, time, qaLog (dev/staging QA events)
```

Rules:

- `features/*` never import from another feature. Shared code moves to `shared/`.
- `shared/*` never imports from `features/*`.
- Only `shared/api/client.ts` imports axios. Only `shared/api/tokenManager.ts` imports keychain.
  Only `shared/storage/` imports MMKV. Only `shared/utils/haptics.ts` imports the haptics lib.
  (Single-owner wrappers keep libraries swappable and mockable.)
- Enforced by `eslint-plugin-boundaries`, not by convention.

---

## Feature Module Convention

```
features/<slug>/
├── screens/        # Screen components (registered in app/navigation)
├── components/     # Feature-specific UI
├── hooks/          # Wrappers around generated hooks (optimistic, invalidation, toast, haptic)
├── schemas.ts      # Form schemas (extend generated zod)
├── utils/          # Feature-specific pure helpers
├── types.ts        # Feature-only UI types
└── __tests__/
```

There is no hand-written `api.ts`: endpoints come from `shared/api/generated/`.

---

## Domain Model (client view)

Provisional — the API's OpenAPI spec is authoritative; these are the shapes the app reasons
about. Extend as features land.

```
User         { id, displayName, avatarUrl?, xp, locale, createdAt }
Spot         { id, name, description, location: { lat, lng }, radiusM, verified, photoUrls[] }
CheckIn      { id, spotId, userId, createdAt, xpAwarded }
XpEntry      { id, userId, amount, reason: 'check_in' | …, refId, createdAt }
```

Rules the app relies on (enforced by the API, mirrored in UI copy):

- Check-in only within the spot's radius (default 200m), once per day per spot.
- **XP is server-authoritative.** The app never computes or optimistically shows awarded XP.
- Distances are computed for display only (`shared/utils/geo.ts`); the server decides eligibility.

---

## Navigation Structure

Provisional — add screens as features land.

```
RootNavigator (Native Stack)
├── Auth flow (unauthenticated)
│   ├── Welcome
│   ├── SignIn          → VerifyOtp
│   └── SignUp          → VerifyOtp
│
└── MainTabs (Bottom Tabs)
    ├── Spots   → SpotsScreen (list ⇄ map)  → SpotDetail → CheckInResult
    └── Profile → ProfileScreen             → Settings → Language
```

Sheets (over any screen): `SpotFilters`, `ConfirmCheckIn`, `LocationRationale`.
Deep links: `irbis://spots/:spotId`, `irbis://profile`.

---

## Data & State Layer

| Concern | Approach |
| ------- | -------- |
| Server data | Generated `useQuery` / `useInfiniteQuery` (orval) |
| Writes | Generated `useMutation`, wrapped in `features/<slug>/hooks/` |
| Auth session | AuthContext + Keychain; refresh once on 401 (single-flight) |
| Prefs & drafts | MMKV via `shared/storage` |
| Form state | react-hook-form (local), never global |
| Network status | NetInfo → `useNetworkStatus` → OfflineBanner + query `onlineManager` |
| App foreground | `focusManager` wired to `AppState` so queries refetch on foreground |
| Global client state | Avoid. If truly needed, a small context — no Redux/Zustand without an ADR |

Rules:

- **Optimistic only when harmless.** Anything that awards XP or grants value waits for the server.
- **Money and points are integers.** Never floats.
- **Times are UTC ISO-8601 on the wire**; formatting happens at render via `Intl`.

---

## API Layer

### Client (`shared/api/client.ts`)

One axios instance, used by orval as its mutator:

- **Request** — `Authorization: Bearer <access>`, `Accept-Language: <locale>`, and an
  `Idempotency-Key` (UUID) on every non-GET request.
- **Response** — normalise every failure to `ApiError { code, message, fieldErrors? }`
  (matching the API's error format, ADR-003); on 401 refresh once (single in-flight refresh
  shared by concurrent requests) and retry; on refresh failure sign out cleanly; pass errors to
  `ToastProvider` unless the mutation opted out.
- **Field errors** route back to the form field (engineering-standards §9).

Components never touch the client — only generated hooks, via feature hooks.

### Codegen

```bash
npm run gen:api     # orval → src/shared/api/generated (react-query + zod), then tsc
```

Run after every API contract change; `npm run check` includes a typecheck, so drift fails the build.

---

## Provider Hierarchy

```tsx
<GestureHandlerRootView>              // Outermost — gestures, sheets
  <SafeAreaProvider>                  // Insets for everything visual
    <KeyboardProvider>                // react-native-keyboard-controller
      <QueryClientProvider>           // TanStack Query
        <AuthProvider>                // Session from Keychain
          <ThemeProvider>             // Tokens, light/dark
            <BottomSheetModalProvider>
              <ToastProvider>         // In-house; receives interceptor errors
                <NavigationContainer ref={navigationRef} linking={linking}>
                  <RootNavigator />
                </NavigationContainer>
              </ToastProvider>
            </BottomSheetModalProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </KeyboardProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

Ordering constraints:

- `GestureHandlerRootView` outermost — required by gesture-handler, sheets and drag.
- `SafeAreaProvider` above everything visual — toasts and sheets need insets.
- `KeyboardProvider` above the navigator so every screen gets keyboard offsets.
- `AuthProvider` inside `QueryClientProvider` so sign-out can clear the cache.
- `ToastProvider` innermost-but-above-navigation so it renders over all screens yet still has
  insets and tokens.

---

## Environments & build

- Environments: `development`, `staging`, `production` — iOS schemes/configurations and Android
  product flavours, each with its own bundle id suffix and `.env.<env>` read by react-native-config.
- `.env.*` files hold **public** values only (API base URL, env name). They are git-ignored,
  filled in by a human, with `.env.example` committed. Claude never reads them.
- Signing keys, keystores, `GoogleService-Info.plist`, `google-services.json` are never committed
  and never read by Claude.
- Release builds: Hermes on, ProGuard/R8 on (Android), dead-code stripping on (iOS).

## Native build environment

Failures here look like code problems but aren't:

- **CocoaPods**: run with `LANG=en_US.UTF-8` (otherwise `Encoding::CompatibilityError`). Pick one
  CocoaPods — Homebrew *or* `bundle exec` per the `Gemfile.lock` — and use it consistently; mixing
  them rewrites `Podfile.lock` and churns checksums.
  ```bash
  cd ios && LANG=en_US.UTF-8 pod install
  ```
- **Prebuilt React core** (`React.xcframework`): if linking fails with undefined
  `facebook::react::Props::getDebugProps` named against third-party pods, the cache served the
  Release artifact to a Debug build. Clear `~/Library/Caches/CocoaPods/Pods/External/React-Core-prebuilt`,
  `ios/Pods/React-Core-prebuilt`, `ios/Pods/ReactNativeCore-artifacts`, then `pod install`.
- **`ios/build/generated` is RN codegen output**, not scratch — don't delete it or point
  `-derivedDataPath` at `ios/build`. `pod install` regenerates it.
- After adding any native dependency: `pod install`, clean Android build, and run both platforms
  before calling it done.

---

## Decisions

| # | Decision | Resolution |
| - | -------- | ---------- |
| 1 | Expo vs bare | **Bare React Native.** No Expo packages, tooling or services. |
| 2 | Token storage | Keychain/Keystore via react-native-keychain (ADR-001). |
| 3 | API types | Generated by orval from `irbis-api/openapi.json` (ADR-003). Never hand-written. |
| 4 | Navigation shape | Native Stack + Bottom Tabs. A Drawer requires an ADR. |
| 5 | Offline | Read-only offline: cached data stays visible and stale-marked; writes refused. No queue. |
| 6 | Server-granted value | XP/rewards are never optimistic. |
| 7 | Device QA | Android QA over adb (`irbis-docs/scripts/qa`). App provides `testID`s and `qaLog` events (standards §16). iOS is tested by hand. |

> Extend this doc as screens land: add the screen to **Navigation Structure**, any new entity to
> **Domain Model**, and any new library to **Tech Stack** (with its approval). Each feature also
> gets a spec in `irbis-docs/features/` and a line in `irbis-docs/STATUS.md`.
