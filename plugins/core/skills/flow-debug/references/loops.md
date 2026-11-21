# Loops per stack

The narrowest command that runs one test, offline. Installing or restoring is never part of a loop: if one is
needed, ask.

| Stack | One test | Notes |
|---|---|---|
| KMP | `./gradlew :shared:testDebugUnitTest --tests "*LoginViewModelTest.emits error*" --offline` | `:shared:allTests` only when the bug is per platform |
| Android | `./gradlew :composeApp:testDevelopDebugUnitTest --tests "<Class>" --offline` | swap the flavor; device tests need an emulator |
| iOS | `xcodebuild test -project iosApp/iosApp.xcodeproj -scheme develop -destination '<simulator>' -only-testing:iosAppTests/<Suite>/<test>` | relink the shared framework after a Kotlin change |
| macOS | `xcodebuild test … -destination 'platform=macOS' -only-testing:<Target>/<Suite>/<test>` | |
| .NET | `dotnet test --no-restore --filter "FullyQualifiedName~<Class>.<Method>"` | integration tests need Docker |
| Next.js, Electron (unit) | `npx --no -- vitest run <file> -t "<name>"` | |
| Next.js, Electron (e2e) | `npx --no -- playwright test <file> -g "<name>"` | against a fresh build |
| Mobile UI | `maestro test <flow>.yaml` | one flow, one device |
| Terraform | `terraform fmt -check` · `terraform validate` | `init` downloads providers: ask. The plan comes from the pull request's CI run; nothing is applied from a laptop |
| HTTP | `curl -sS -w '\n%{http_code}\n' <url>` with the token from an env var | calling the user's dev server is fine; never stop or restart it |

## Flaky

- Vitest: `test("…", { repeats: 50 }, …)` while debugging, removed after; Playwright: `--repeat-each=50 --workers=4`;
  Gradle: a loop in bash.
- A flaky test is a bug: find the shared state, the clock or the race. Never add retries to make it green.

## Performance

- Kotlin and Android: Android Studio profiler, `measureTime {}` in a test.
- Swift: Instruments (Time Profiler), `ContinuousClock` in a test.
- .NET: `EXPLAIN (ANALYZE, BUFFERS)` for SQL, `Stopwatch` in a test, `dotnet-counters` if already installed.
- Web: Playwright trace, the browser Performance panel, `performance.now()`.
