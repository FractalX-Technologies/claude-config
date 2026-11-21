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

  url "https://github.com/<org>/<repo>/releases/download/macos-#{version}-prd/<App>-#{version}.dmg"
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
- The download comes from our own release, never a mirror: the pipeline's last rung (`macos-X.Y.Z-prd`), in a public
  repository. A private repository's release can't feed a cask: its app is handed out by the release's link.

## Updates

- **Homebrew only**: users run `brew upgrade`. Simple, and enough for internal tools.
- **Sparkle**, if the app updates itself: EdDSA keys (the private key in CI secrets and a safe backup: losing it means
  installed copies can never update), an appcast feed, `auto_updates true` in the cask.
- Never reuse a file name, and the build number always goes up.

## Release pipeline (GitHub Actions)

The shared pipeline template releases a native macOS app (`macos-release.yml` and the `mac` lanes, since v3.4.0): put
the app on it with the `flow-pipelines` skill. An app has no release script and no release workflow of its own.

1. A merge's build job archives ad hoc, with no certificate in reach.
2. A second job signs with Developer ID, notarizes and staples the app and its DMG, and holds both to the template's
   app check (version, entitlements, Gatekeeper).
3. The DMG ships as a release of the app's repository, tagged by the pipeline: a pre-release below the last rung, the
   latest release on it.

- The certificate and the notarization key are the owner's secrets, in the rung's GitHub environment and the
  organisation, under the template's names (`docs/settings.md`).
- What the template doesn't do yet (nested code such as Sparkle's helpers, the cask's update, a pull request check)
  moves into the template when an app needs it, never into the app's own scripts.

## Versions

`CFBundleShortVersionString` is the version users see (`1.4.0`); `CFBundleVersion` is the build number and always
goes up. Both come from the pipeline, as build settings: the version from the pull request's title, the build number
from the clock. The release tag is the pipeline's, `macos-X.Y.Z-<rung>`, never made by hand.
