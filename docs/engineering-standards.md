# Engineering Standards — irbis-app (bare React Native)

These are **not optional polish**. They are the definition of done for every feature in
this app. A feature that works but skips these is not finished.

Read this before building anything, together with [`architecture.md`](./architecture.md).
If a feature ships without an item below, the reason must be written in the feature spec
(`irbis-docs/features/<slug>.md`) and the wrap-up summary — never silently omitted.

> These apply to every feature proactively, even when the request doesn't mention them.
> The `reviewer` agent checks the Quick gate on every diff.

---

## Quick gate

Before marking any feature complete, every line must be true or explicitly waived:

- [ ] Every interactive element has a press state and a transition (nothing snaps)
- [ ] Every meaningful action fires the correct haptic, via `shared/utils/haptics.ts`
- [ ] Screen respects safe area on all four edges — notch, Dynamic Island, home indicator, landscape
- [ ] Every focused input stays visible above the keyboard; keyboard dismisses correctly
- [ ] Zero inline styles, zero raw hex, zero magic numbers — tokens only
- [ ] All server data goes through **orval-generated hooks** over the axios `apiClient`. No raw `fetch`, no hand-written API types
- [ ] Navigation typed, back behaviour correct (incl. Android hardware back), deep-linkable where it makes sense
- [ ] Native platform affordances used where they exist, degraded gracefully where they don't
- [ ] Inputs show pristine / validating / success / error states
- [ ] Every mutation surfaces its result (toast, or the screen itself visibly shows the outcome)
- [ ] Every data surface has empty, loading, error **and** offline states
- [ ] Every touchable labelled for screen readers; screen checked at the largest font size
- [ ] Zero hardcoded user-facing strings; layout survives +40% text expansion; styles are RTL-safe
- [ ] Permission-gated features (location, camera, notifications) handle *denied* and *blocked*
- [ ] `npm run check` green; tests written from the spec's acceptance criteria

---

## 1. Interactions & animations

**Rule:** nothing appears, disappears or changes state instantly. Every state change is
animated, and every animation is interruptible.

- Driven by **Reanimated 4** (with `react-native-worklets`) on the UI thread. Never `Animated`
  from core RN, never `setState`-driven animation loops.
- **Durations:** 150ms press feedback, 200–250ms enter/exit, 300ms screen-level or layout
  transitions. Nothing over 400ms.
- **Easing:** `Easing.out(Easing.cubic)` entering, `Easing.in(Easing.cubic)` exiting. Springs
  only for gesture-following motion (sheet pull, swipe-to-dismiss, drag).
- **Press feedback** on every touchable: scale to `0.97` + opacity `0.9`, 150ms — implemented
  once in the shared `<Pressable>` primitive so it is impossible to forget. Never use
  `TouchableOpacity` / raw `Pressable` in features.
- **Layout animations** (`LinearTransition`, `FadeIn`/`FadeOut`) whenever list content changes.
- **Respect `useReducedMotion()`** — cut to a cross-fade or no animation. Never ignore it.
- **List entrances** stagger by 30ms per item, capped at ~8 items.
- Gesture-driven motion uses **react-native-gesture-handler** and must track the finger at
  60fps with no JS-thread work in the gesture path.

## 2. Haptic feedback

**Rule:** every action with a consequence confirms itself physically.

Library: **`react-native-haptic-feedback`**, wrapped in `shared/utils/haptics.ts` — never
called directly from a component, so the mapping stays consistent and is trivially mockable.

| Situation | Haptic |
| --------- | ------ |
| Button / row press | `impactLight` |
| Toggle, checkbox, filter pill, segment change | `selection` |
| Sheet opens, tab changes | `impactLight` |
| Action succeeded (saved, checked in, reward earned) | `notificationSuccess` |
| Validation failure, refused action | `notificationError` |
| Destructive action confirmed (delete, sign out) | `notificationWarning` |
| Drag picks up / snaps | `impactMedium` / `selection` |

Never haptic on scroll, on a passive state change, or more than once per user action.
Respect the OS setting — `ignoreAndroidSystemSettings: false`.

## 3. Safe area

**Rule:** no content and no interactive element ever sits under a notch, Dynamic Island,
home indicator, status bar or rounded corner.

- **`react-native-safe-area-context`**, `SafeAreaProvider` at the root.
- `useSafeAreaInsets()`; apply insets to **padding, not margin**. Scroll views put the inset
  on `contentContainerStyle` so content scrolls under the edge but rests clear of it.
- **Never hardcode** `44`, `20`, `34` or any status-bar / home-indicator constant.
- Bottom-anchored actions add `insets.bottom || spacing[200]` to their container.
- Handle left/right insets — landscape on phones and tablets is real.
- Sheets get their bottom inset from the sheet, not the screen.
- Android is **edge-to-edge** (RN default); insets are handled, not avoided with translucent hacks.
- The shared `<Screen>` primitive applies all of this; features use it instead of re-implementing.

## 4. Keyboard handling

**Rule:** a focused input is always visible. The keyboard never covers what the user is
typing into, and never traps them.

Library: **`react-native-keyboard-controller`** — not `KeyboardAvoidingView`, which is
inconsistent across platforms and cannot animate in sync with the keyboard.

- `KeyboardAwareScrollView` (or `KeyboardStickyView` for pinned footers) on every screen
  that contains an input.
- Content moves in lockstep with the keyboard (interpolated), not after it.
- **Dismiss:** tap outside dismisses; scroll dismisses (`keyboardDismissMode="interactive"`).
- **`returnKeyType`** chains fields — `next` through the form, `done` on the last, which submits.
- Correct `keyboardType`, `textContentType` and `autoComplete` every time: `email-address`,
  `phone-pad`, `decimal-pad` for money, `number-pad` for OTP / quantity.
- **`autoFocus` only** where typing is the whole point of the screen (search, OTP).
- A submit button pinned above the keyboard stays reachable; it never scrolls out of view.

## 5. StyleSheet discipline

**Rule:** all styling is `StyleSheet.create`, sourced from tokens. No exceptions.

- **Zero inline style objects** in JSX except genuinely dynamic values (an animated
  transform, a colour resolved at runtime).
- **Zero raw hex, raw font sizes, magic spacing numbers.** Everything comes from
  `shared/constants/{colors,typography,spacing}.ts`, which mirror
  `irbis-docs/design/design.md` verbatim.
- If a value you need isn't a token, **add it to `design.md` first**, then mirror it. Never inline it.
- `StyleSheet.create` at **module scope**, never inside the component body.
- Compose as arrays: `[styles.base, isActive && styles.active]`.
- Platform differences via `Platform.select` inside the stylesheet, not branching in JSX.
- Shadows: iOS `shadow*` and Android `elevation` both set, from the elevation tokens.
- No cross-feature style imports. Shared visuals become a shared component.
- Fonts selected by **family name** (`<Family>-Regular` / `-Medium` / `-Bold`), not
  `fontWeight` — Android ignores numeric weights for custom families.

## 6. Data layer — orval + TanStack Query + axios

**Rule:** all server communication goes through the **orval-generated** client in
`src/shared/api/generated/`, which calls the single axios instance in
`shared/api/client.ts` (the orval *mutator*). Raw `fetch` and hand-written API types are banned.

- `npm run gen:api` regenerates from `../irbis-api/openapi.json`. Generated files are never
  edited; if a field is missing, the API changes first.
- **axios instance** with `baseURL`, timeout and interceptors:
  - request — `Authorization: Bearer`, `Accept-Language`, and an **`Idempotency-Key`** on every
    mutation (so a retry after a timeout can't double-apply)
  - response — normalise errors into one `ApiError` (`{ code, message, fieldErrors? }`),
    refresh the token once on 401 and retry, hand failures to the toast layer (§10)
- **Every** read is a generated `useQuery` / `useInfiniteQuery`. No `useEffect` + `setState`
  fetching anywhere.
- **Every** write is a generated `useMutation`. Features add behaviour (optimistic update,
  invalidation, toast, haptic) in `features/<name>/hooks/`, wrapping the generated hook.
- **Query keys** come from orval's generated `get…QueryKey()` helpers. Keys not backed by an
  endpoint live in `shared/api/queryKeys.ts`. Never an inline array.
- Stale times set deliberately per data shape in `shared/api/query.ts` (e.g. profile ~5min,
  lists ~30s, static reference data ~30min). The default is not a decision.
- Components never call `apiClient` or generated functions directly — only through hooks.
- Errors are typed. A component branches on `error.code`, never on a message string.
- **Optimistic where a wrong state for 300ms is harmless; never for anything that grants or
  moves value** (rewards, payments, check-ins that award XP) — those render success only after
  the server confirms.
- Forms validate with the **orval-generated zod schemas** (extended locally for UI-only rules),
  so client and server validation can't drift.

## 7. React Navigation

**Rule:** navigation is fully typed, back behaviour is always correct, and stacks/tabs
compose predictably.

- **React Navigation 7**: Root Native Stack → Bottom Tabs → per-tab Native Stacks.
  (A Drawer is only added by ADR.)
- **Fully typed** — param lists in `app/navigation/types.ts`, global `RootParamList`
  declaration. No `any` params, no untyped `navigate`.
- **Params carry ids, not objects.** Pass `spotId`, then query it.
- Android **hardware back** handled on every screen — a dirty form warns before discarding.
- `navigationRef` for navigation from outside React (push taps, deep links).
- **Deep links** (`irbis://` + universal/app links) for every detail screen worth sharing.
- Sheets are **`@gorhom/bottom-sheet`**, not navigation modals — except full-screen flows,
  which are stack screens with `presentation: 'fullScreenModal'`.
- Heavy screens unmount on blur / are lazy where the tab isn't the entry point.

## 8. Native components & platform feel

**Rule:** use the platform's real affordances. The app should feel native on each OS, not
like one design ported twice.

- Native **date/time pickers**, native **share sheet**, platform **pull-to-refresh** on every list.
- **Context menus / long-press** on rows where secondary actions exist.
- `StatusBar` style follows the surface beneath it.
- Android: **Material ripple**; iOS: opacity/scale. The shared `Pressable` resolves this per platform.
- **Liquid Glass** (iOS 26+) on floating surfaces only where it improves legibility, with a
  solid token surface on older iOS and Android. Never required for a screen to work.
  **Do not add a glass dependency until it's verified on bare RN 0.88 + New Architecture**
  (Expo-only packages such as `expo-glass-effect` are not allowed — this is a bare app).
- Native iOS keyboard accessory for form field navigation.
- **No Expo packages.** This is a bare React Native app. Anything `expo-*` is rejected in review.

## 9. Input validation

**Rule:** every input has four visible states, and validation never surprises the user at
submit time.

`react-hook-form` + `zod` (generated schemas, §6). One schema per form, colocated in the feature.

| State | When | Visual |
| ----- | ---- | ------ |
| **Pristine** | untouched | `border` token, placeholder in the muted text token |
| **Validating** | async check in flight (e.g. username availability) | spinner in trailing slot, border unchanged |
| **Success** | valid **and** confirmation is genuinely reassuring | `success` border + check icon |
| **Error** | invalid, after blur or on submit | `error` border + message below in the small body token |

- Validate on blur; re-validate on change once a field has errored.
- Never validate on the first keystroke of a pristine field.
- Border and message always appear **together**.
- Success state is selective, not on every field.
- Submit is **never disabled** to signal invalidity — submit, show errors, focus + scroll to the first.
- Server `fieldErrors` map back onto the matching field, not into a toast.

## 10. Toasts

**Rule:** every mutation tells the user what happened. Silence is a bug.

Built in-house — `shared/components/Toast` + `ToastProvider`, on Reanimated and
safe-area-context. No dependency, full token control.

- Variants: success, error, info, undo-capable.
- Positioned **top**, below the safe-area inset — never colliding with bottom actions or the keyboard.
- Durations: success 2.5s, info 3s, error 4s (or sticky with Close). Swipe or tap to dismiss.
- Wired into the axios response interceptor so no mutation fails silently; a mutation may opt
  out only when the screen itself shows the outcome.
- Error toasts are actionable where retry is possible ("Couldn't save — Retry").
- Reversible destructive actions get an **Undo toast** instead of a blocking confirm dialog.
- Toasts queue; one visible at a time.
- Field-level validation errors are not toasts (§9).

## 11. Empty, loading, error & offline states

**Rule:** every surface that renders server data has **four** designed states. A spinner
alone is not a loading state.

- **Loading — skeletons**, shaped like the real content, subtle shimmer. A centred spinner only
  for a first whole-screen load with no known shape.
- **Empty** — icon/illustration, one-line explanation, primary action where one exists.
  **Empty-because-filtered ≠ empty-because-no-data**; they never share a message.
- **Error** — plain-language cause + **Retry** wired to `refetch`. Never a raw error or status code.
- **Offline** — detected via `@react-native-community/netinfo`, shown as a persistent banner,
  not a toast. Cached data stays visible and is marked stale. Writes are refused with a clear
  reason (no offline queue unless an ADR adds one).
- **Partial** — next page failed → inline footer error with retry, not a whole-screen error.
- **Permission** — denied → explain + ask again; blocked → explain + "Open Settings".
- Built **with** the happy path, never retrofitted.

## 12. Accessibility

**Rule:** fully operable by screen reader and legible at the largest system font size.

- Every touchable has `accessibilityLabel`, `accessibilityRole` and, where stateful,
  `accessibilityState`. An icon-only button without a label is a bug.
- Compound rows are grouped into one announcement (`accessible` on the row).
- `hitSlop` brings any control under 44pt up to 44pt.
- `allowFontScaling` stays on; `maxFontSizeMultiplier` set per typography token. Every screen
  checked at the largest accessibility size — layouts wrap or scroll, never clip.
- Contrast comes from tokens (all pairings WCAG AA) — don't bypass them.
- Never convey meaning by colour alone; badges carry text or an icon.
- Sheets/modals set `accessibilityViewIsModal`; focus moves in on open and returns on close.
- Toasts announce via `AccessibilityInfo.announceForAccessibility`.
- Reduced motion honoured (§1). Tested on **VoiceOver and TalkBack**, not just a linter.

## 13. Internationalisation & RTL

**Rule:** no user-facing string is hardcoded, and no layout assumes a fixed text length.

`i18n-js` + `react-native-localize`, translations in `shared/i18n/<locale>/<feature>.json`.
Supported locales are listed in `irbis-docs/PROJECT.md`.

- Zero hardcoded copy. Keys namespaced by feature (`spots.empty.title`).
- Plurals and interpolation through i18n-js — never string concatenation or `if (n === 1)`.
  Russian-style plural rules (one/few/many) must work.
- Dates, times, numbers, distances and currency via `Intl` — never hand-rolled. Server times are
  UTC; display converts to the device timezone unless the spec says otherwise.
- **RTL-safe styles from day one:** `start`/`end`, `marginStart` — never `left`/`right`,
  `marginLeft`. Directional icons flip. (Full RTL QA only once an RTL locale is added.)
- Layouts tolerate **+40% string length**. Buttons grow or wrap; they don't truncate.
- No text baked into images. Locale-aware sorting with `Intl.Collator`.

## 14. Security & privacy

- Tokens live in the **Keychain / Keystore** (`react-native-keychain`), never MMKV or AsyncStorage.
- MMKV holds only non-sensitive state (prefs, drafts, cached UI state).
- No secrets in the bundle. Build-time config via `react-native-config` holds **public** values only
  (API base URL, environment name). Real `.env` files are filled in by a human and never read by Claude.
- Never log tokens, phone numbers, locations or other personal data — not even in dev builds.
- Location is requested **when-in-use**, only at the moment a feature needs it, with a rationale screen first.
- Deep links are validated; never navigate to an arbitrary URL from a link or push payload.

## 15. Testing

- **Jest** + **@testing-library/react-native**. Tests in `__tests__/` beside the code.
- Tests are written from the spec's acceptance criteria **before** implementation.
- Test behaviour through the UI (render, press, assert text/state), not implementation details.
- Network mocked at the HTTP boundary (MSW or an axios adapter), not by mocking our own hooks.
- Pure utilities (`shared/utils`) are unit-tested exhaustively.
- Never modify, skip or weaken an existing test to make it pass — report it.

---

## Libraries these standards require

| Library | For |
| ------- | --- |
| `react-native-reanimated` + `react-native-worklets` | §1 animations |
| `react-native-gesture-handler` | §1 gestures, sheets |
| `react-native-haptic-feedback` | §2 haptics |
| `react-native-safe-area-context` | §3 safe area |
| `react-native-keyboard-controller` | §4 keyboard |
| `axios`, `@tanstack/react-query`, `orval` (dev) | §6 data layer |
| `@react-navigation/*` | §7 navigation |
| `@gorhom/bottom-sheet` | §7 sheets |
| `react-hook-form`, `zod` | §9 validation |
| `@react-native-community/netinfo` | §11 offline |
| `i18n-js`, `react-native-localize` | §13 i18n |
| `react-native-keychain`, `react-native-mmkv` | §14 storage |
| — | §10 toasts, §11 skeletons: built in-house |

**Deliberately not adopted yet** (raise via ADR when needed): analytics, crash reporting
(Sentry/Crashlytics), performance budgets, offline write queue, E2E (Maestro/Detox).
