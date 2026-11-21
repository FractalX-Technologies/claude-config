---
paths:
  - "**/composeApp/**"
  - "**/androidApp/**"
  - "**/core-ui/src/androidMain/**"
---

# Android conventions

## Names

| What | Name and place |
|---|---|
| Screen | `<Feature>Screen.kt` in `screens/<feature>/` |
| Part of one screen | `<Screen><Part>.kt` in that feature's `components/` |
| Generic component | `presentation/components/<group>/`, with a generic name |
| Native adapter | `<Name>Reader.kt` / `<Name>Manager.kt` in `core/<area>/` |
| Modifier extension | `Modifier.<verb>()` in `components/modifiers/` |

- One screen-level composable per file, with the file's name.
- No header comment. Explicit imports, unless the file already uses wildcards.

## State in a composable

```kotlin
val state by viewModel.state.collectAsStateWithLifecycle()                    // from the ViewModel
val camera = remember { CameraReader(context) }                                // native adapter
var showDialog by remember { mutableStateOf(false) }                           // UI-only flag
val canSubmit by remember { derivedStateOf { state.query.isNotBlank() && !state.isLoading } }
```

If you need `mutableStateOf` for a value that is already in `state`, that value belongs in the Contract.

## Modern Compose

- `collectAsStateWithLifecycle()`, never `collectAsState()`.
- `Scaffold { padding -> … }`: apply `padding` to the content, never ignore it.
- Coroutines in `LaunchedEffect` (or `rememberCoroutineScope()` for clicks); cleanup in `DisposableEffect`.
- The app is always edge-to-edge (targetSdk 36 removed the opt-out): every screen handles the system bars
  through `Scaffold` padding or `WindowInsets`.
- Back: a `BackHandler` that is enabled only while it's needed. Never override `onBackPressed`: from targetSdk 36
  it isn't called, and predictive back is on.
- New icons are Material Symbols added as vector resources. The `material-icons-*` libraries are deprecated: don't
  use them in new code. Arrows and other direction icons must mirror in right-to-left languages.
- `painterResource(R.drawable.x)` for Android-only images, `Res.drawable.x` for shared ones.
- `AnimatedContent` only for step changes, not for values that change often.

## Theme

Never write colors, fonts, spacing, radii or durations inline.

```kotlin
Text(label, style = AppFonts.bodyMedium, color = SystemColors.SystemTextPrimary)   // ✓
Text(label, fontSize = 14.sp, fontWeight = FontWeight.Medium)                      // ✗
color = Color(0xFFEE5252); shape = RoundedCornerShape(20.dp)                       // ✗
```

- A missing token is added to the theme first, together with its iOS twin. Then use it.
- Read `isSystemInDarkTheme()` only inside the theme, never in a screen.
- Choosing between two tokens by screen size is fine (`if (isTablet) AppFonts.title else AppFonts.titleSmall`).

## Constants in a file

Numbers that only one file uses go in a `private object` at the top, grouped by topic (`Layout`, `Timing`). Never
loose `private val`s or numbers inside a `Modifier` chain. Two files in the same package can't both have
`private object Layout`: prefix it (`MaintenanceLayout`). If a second composable needs it, make it a theme token.

## Errors and logs

- Logs: `AppLogger.info("[Screen][<Feature>] …")` (or `debug`, `warn`, `error`). Screens rarely need to log.
- Errors the user should know about are shown (snackbar, dialog or inline text).
- One-time things come from Effects, never from `LaunchedEffect(state.x)`.

## Accessibility

- An icon-only button needs a `contentDescription`.
- Touch targets of at least 48.dp.
- Use the theme's text styles, so the user's font size works.
- Never use color alone to signal something: add an icon or text.

## Performance

- `LazyColumn` / `LazyRow` for more than ten items, with `key = { it.id }`.
- `remember(input) { … }` around heavy work, `derivedStateOf` for values computed from the State.
- The order of modifiers matters: `padding` before `background` paints only inside the padding.
- Never capture an `Activity` in a long-running coroutine.
