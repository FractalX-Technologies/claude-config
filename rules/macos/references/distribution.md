---
paths:
  - "**/Casks/**"
  - "**/macosApp/*.xcodeproj/**"
  - "**/macosApp/**/*.entitlements"
  - "**/macosApp/**/Info.plist"
  - "**/macosApp/scripts/**"
  - "**/.github/workflows/*macos*"
---

# Distributing a macOS app through Homebrew

## Sign, notarize, staple

1. Build a release archive with the **Developer ID Application** certificate and Hardened Runtime on.
2. Sign normally. Never `codesign --deep`: it breaks nested helpers (for example Sparkle's) that have their own
   entitlements.
3. Notarize with `xcrun notarytool submit <file> --wait`. In CI use an App Store Connect API key, not an Apple ID.
4. Staple the ticket: `xcrun stapler staple` on the `.app`, and again on the DMG if you ship one.
5. Check it: `codesign --verify --strict --verbose=2 <App>.app` and `spctl --assess -vv <App>.app` must pass.

Since 2026-09-01 Homebrew disables casks whose app doesn't pass the Gatekeeper check, so an unsigned or
un-notarized build is not shippable.

## The Homebrew cask

The cask lives in our own tap (a repository named `homebrew-<tap>`), in `Casks/<app>.rb`:

```ruby
cask "<app>" do
  version "1.4.0"
  sha256 "…"

  url "https://github.com/<org>/<repo>/releases/download/v#{version}/<App>-#{version}.zip"
  name "<App>"
  desc "One sentence on what it does"
  homepage "https://github.com/<org>/<repo>"

  depends_on macos: ">= :sonoma"
  auto_updates true                        # only if the app updates itself (Sparkle)

  app "<App>.app"

  zap trash: [
    "~/Library/Application Support/<bundle id>",
    "~/Library/Preferences/<bundle id>.plist",
  ]
end
```

- Users install it with `brew install --cask <org>/<tap>/<app>`.
- Each release updates `version` and `sha256` in the same pull request as the release, never by hand later.
- The download comes from our own release, never a mirror.

## Updates

- **Homebrew only**: users run `brew upgrade`. Simple, and enough for internal tools.
- **Sparkle**, if the app updates itself: EdDSA keys (the private key in CI secrets and a safe backup: losing it means
  installed copies can never update), an appcast feed, `auto_updates true` in the cask.
- Never reuse a file name, and the build number always goes up.

## Release pipeline (GitHub Actions)

The shared pipeline template has no macOS workflow yet, so a macOS app has its own, on a macOS runner, following the
[GitHub Actions rules](../../github-actions/RULE.md):

1. Build and test.
2. Archive, sign, notarize, staple, verify.
3. Upload the ZIP or DMG to the GitHub release.
4. Update the cask (and the appcast with Sparkle).

- The certificate, the notarization key and the Sparkle key are repository secrets, passed as environment variables.
- When a second macOS app needs this, move it into the shared pipeline template instead of copying it.

## Versions

`CFBundleShortVersionString` is the version users see (`1.4.0`); `CFBundleVersion` is the build number and always
goes up. The release tag is `v<version>`.
