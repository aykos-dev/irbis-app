# irbis-app — Architecture

The Irbis end-user mobile app for iOS and Android: a Duolingo-style, gamified outdoor app — this week's path of
places matched to level, season and forecast, live safety conditions, safety lessons, trip plans with auto-alerts and
SOS, check-ins, a companion that evolves over 7 levels, badges, community and games.
(Product: `irbis-docs/PROJECT.md`; screens: `irbis-docs/design/canvas/`, 390×844, light + dark.)

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
ADR in `irbis-docs/decisions/`). Exact versions installed at scaffold time (2026-10-17), pinned
without `^` in `package.json`. "Not installed yet" rows are approved but arrive with the first feature that uses them.

| Layer | Technology | Version |
| ----- | ---------- | ------- |
| **Framework** | React Native (bare, New Architecture, Hermes) + React | 0.88.0 / 19.3.0 |
| **CLI** | `@react-native-community/cli` | 20.2.0 |
| **Language** | TypeScript strict | 6.0.3 |
| **Navigation** | React Navigation 7 — `native` / `native-stack` / `bottom-tabs` | 7.5.1 / 7.21.0 / 7.21.0 |
| **Server state** | TanStack Query 5 | 5.104.3 |
| **API client** | **orval**-generated hooks + zod schemas over **axios** | orval 8.43.0 / axios 1.20.0 |
| **Forms** | react-hook-form + zod (own `shared/forms/zodResolver`, no resolvers package) | 7.90.0 / 4.6.7 |
| **Animation** | react-native-reanimated 4 + react-native-worklets | 4.7.1 / 0.13.0 |
| **Gestures** | react-native-gesture-handler | 3.4.0 |
| **Screens** | react-native-screens | 4.30.0 |
| **Bottom sheets** | @gorhom/bottom-sheet | 5.2.14 |
| **Lists** | @shopify/flash-list (not installed yet) | 2.x |
| **Secure storage** | react-native-keychain (tokens) | 10.0.0 |
| **Local storage** | react-native-mmkv (prefs, drafts) + react-native-nitro-modules | 4.3.2 / 0.37.1 |
| **i18n** | i18n-js + react-native-localize | 4.5.4 / 3.7.2 |
| **Haptics** | react-native-haptic-feedback | 3.0.0 |
| **Keyboard** | react-native-keyboard-controller | 1.22.7 |
| **Safe area** | react-native-safe-area-context | 5.10.1 |
| **Network status** | @react-native-community/netinfo | 12.0.1 |
| **Icons / SVG** | react-native-svg + `@react-native-vector-icons/*` (not installed yet) behind `shared/components/Icon.tsx` | 15.16.0 / — |
| **Config** | react-native-config (public build-time values only) | 1.7.2 |
| **Splash** | react-native-bootsplash (not installed yet) | 7.x |
| **Tests** | Jest + @testing-library/react-native (+ `test-renderer`) | 30.5.2 / 14.1.0 (1.3.1) |
| **Lint** | ESLint flat config + typescript-eslint + react-hooks + eslint-plugin-boundaries | 10.13.0 / 8.71.2 / 7.1.1 / 7.2.0 |
| **Build tooling** | `@babel/plugin-transform-export-namespace-from` (zod 4 under Metro), `react-native-asset` (fonts) | 7.29.7 / 2.3.0 |

**Planned — approve when the first feature needs it** (each must support bare RN 0.88 + New
Architecture; verify before adding):

| Need | Candidate | First feature |
| ---- | --------- | ------------- |
| Location (foreground + background during an active trip) | `react-native-permissions` + `@react-native-community/geolocation` (verify background support, else `react-native-background-geolocation` via ADR) | active-trip, check-in |
| Maps + offline regions | `react-native-maps` or MapLibre (`@maplibre/maplibre-react-native`, offline packs) — decide by ADR | places, safety-center |
| Push | `@react-native-firebase/app` + `/messaging` | streaks, conditions, trip alerts |
| SMS fallback for SOS | native SMS intent (no package) | active-trip |
| Animation assets | `lottie-react-native` or `react-native-video` — per media format the owner provides | levels, onboarding |
| 360° viewer, local hotspot server | TBD by ADR | bu-qayer, campfire-core |
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
    │   ├── auth/  onboarding/  profile/            # Phase 1 — slugs match ROADMAP.md and the api
    │   ├── places/  conditions/  weekly-path/       # Path + Explore tabs
    │   ├── levels/  lessons/  streaks/  badges/     # Lessons tab, progress
    │   ├── trip-plan/  active-trip/  check-in/  safety-center/
    │   ├── …                                        # Phase 2+ features add their own folder
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

The API's domain model (`irbis-api/docs/architecture.md`) is authoritative and arrives as generated types. What the
app must reason about locally:
- **Condition status** (go / caution / not_now / seasonal_lock) — always rendered as colour + icon + label; "Not now"
  never shows a start / "Go there" action.
- **Difficulty lock** — places and trails above the user's level are visible with the required level, not startable.
- **XP, level, badges, streaks are server-authoritative** — never computed or shown optimistically; the app shows what
  the server returned (e.g. the summit celebration renders the check-in response).
- **Offline:** downloaded region maps, the active trip plan and SOS work with no data; XP earned offline (campfire
  games) is queued and synced — the only offline write queue, added by its feature via ADR.

---

## Navigation Structure

From the canvas (`Nav.dc.html` + page boards). Bottom tabs: **Path · Explore · Lessons · Community · Profile**.

```
RootNavigator (Native Stack)
├── Status               M0 initial route (features/health.md) — replaced by Splash/MainTabs as features land
├── Splash
├── Onboarding           Meet Irbis → Language → Experience → Interests → Companion reveal (no account needed)
├── Auth (modal stack)   LogIn · SignUp · ForgotPassword → ResetCode     (canvas page "Accounts & sign-in")
└── MainTabs (Bottom Tabs) — open to guests
    ├── Path       → Home (This Week's Path) → PlaceDetail → TrailMap
    │                                        → TripPlan → ActiveTrip → Summit / check-in celebration
    ├── Explore    → ExploreMap → PlaceDetail …
    ├── Lessons    → LessonsHub → MicroLesson (question → correct / incorrect)
    │                → LevelProgress → LevelUp · Badges · (Phase 3: Bu qayer?, Leagues)
    ├── Community  → (Phase 2) Feed · Groups · Buddies · Top Shots · (Phase 3) Campfire games
    └── Profile    → Profile → EditProfile · Settings · Notifications · SafetyCenter · MySpots · Badges
                     · (Phase 4) Tours · Gear · Irbis Plus
```
Full-screen flows (stack, `fullScreenModal`): onboarding, auth, trip plan → active trip, micro-lesson, level-up, Add a Spot.
**Guest-first (ADR-001):** no login wall. `useRequireAccount(reason)` opens the **log-in prompt sheet** (`AccGate`) before
any action that saves or earns; after sign-up/log-in the action resumes, "Not now" returns to where the user was. The
Profile tab shows the guest profile (`AccGuestProfile`) until signed in. Guest data lives in `shared/storage` (MMKV,
non-sensitive) and is sent once to `/v1/me/guest-merge` after the first sign-up/log-in.
Sheets: report, filters, smart swap, confirm check-out.
Deep links: `irbis://places/:placeId`, `irbis://trips/:tripId`, `irbis://lessons/:lessonId`, `irbis://profile`.

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

Per-request overrides go through the generated hook's `request` option (e.g. `health` accepts
200 **and** 503 via `validateStatus` and validates the body with the generated zod schema in
`select`), never by changing the shared client.

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

- Environments: `dev`, `staging`, `prod` — Android product flavours (`uz.irbis.app.dev` "Irbis Dev",
  `uz.irbis.app.staging` "Irbis Staging", `uz.irbis.app` "Irbis"), each reading `.env.dev` /
  `.env.staging` / `.env.prod` via react-native-config (`API_URL`, `APP_ENV`). iOS schemes: not yet
  (iOS is generated, not built, in M0).
- dev/staging **release** builds are signed with the public debug keystore so QA can sideload them;
  prod release is signed only when `IRBIS_UPLOAD_*` properties exist in `~/.gradle/gradle.properties`.
- Run: `npm start` (Metro) + `npm run android` (= `run-android --mode devDebug --appId uz.irbis.app.dev`).
  Standalone APK: `cd android && ./gradlew assembleDevRelease` → `android/app/build/outputs/apk/dev/release/`.
- The **dev** flavour adds `src/dev/res/xml/network_security_config.xml`: cleartext only to
  `localhost` / `127.0.0.1` / `10.0.2.2` (local API via `adb reverse tcp:3000 tcp:3000`, Metro).
  staging/prod stay HTTPS-only (release forces `usesCleartextTraffic=false`).
- Watchman is disabled in `metro.config.js` / `jest.config.js` (node crawler) — the dev Mac's Homebrew
  watchman fails to load `libfmt`.
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
| 6 | Server-granted value | XP, levels, badges, streaks are never optimistic. |
| 7 | Device QA | Android QA over adb (`irbis-docs/scripts/qa`). App provides `testID`s and `qaLog` events (standards §16). iOS is tested by hand. |

> Extend this doc as screens land: add the screen to **Navigation Structure**, any new entity to
> **Domain Model**, and any new library to **Tech Stack** (with its approval). Each feature also
> gets a spec in `irbis-docs/features/` and a line in `irbis-docs/STATUS.md`.
