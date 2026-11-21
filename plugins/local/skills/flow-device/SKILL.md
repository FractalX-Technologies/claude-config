---
name: flow-device
description: Run a develop build on a physical iPhone or Android phone against the backend on this Mac - the Mac's network name (iOS) or adb reverse (Android), and a device build that stops without it. Use when the app must run on a real phone against the local backend ("correr en mi iPhone", "en el dispositivo físico", "en mi teléfono", "probar con localhost en el device"), or a device build says offline while the simulator works ("You are offline").
---

# Develop on a physical device

**On a phone, `localhost` is the phone.** The iOS simulator shares the Mac's network and the Android emulator reaches
it at `10.0.2.2`; a phone does neither, so a develop build pointed there can only say it is offline.

The person runs the app on the phone (Xcode's or Android Studio's Run). You set the build up, prove it, and tell them
what they will see.

## Steps

1. **Read what a device build points at**: iOS `xcodebuild -project <p> -scheme <develop> -sdk iphoneos
   -showBuildSettings`, Android the develop flavor's URL property. Done when you can name each platform's device URL.
2. **The Mac answers on its name**: from the Mac, `curl -s -o /dev/null -w "%{http_code}"
   "http://$(scutil --get LocalHostName).local:<port>/<health>"`. A server bound to `127.0.0.1` never answers a phone
   (`lsof -iTCP:<port> -sTCP:LISTEN` or `docker port <container>` shows the bind), and the firewall
   (`/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate`) must let it in. Done when the name answers as
   `localhost` does.
3. **Point the device build at the Mac**: iOS and Android below. Done when the device URL is the Mac's and the
   simulator's and emulator's are unchanged.
4. **Red, then green**: a device build without this Mac's value stops and names the line to write; with it, the
   bundle carries the Mac's name; the store build carries no local-network setting. Done when all three are seen.
5. **Hand over**: the one-time line for their Mac, the phone on the Mac's network, Local Network allowed (iOS) or
   `adb reverse` run (Android), and sign-in codes in the local mail catcher, not their inbox. The phone reaching the
   Mac is a waiver in `tasks/waivers.md`: their run is the check. Done when your reply names each.

## iOS: the Mac's network name

- A device build gets its own URL and the simulator keeps `localhost`:
  `API_BASE_URL[sdk=iphoneos*] = http:/$()/$(DEVELOP_MAC_HOST):<port>/` in the develop xcconfig.
- `DEVELOP_MAC_HOST` comes from a gitignored per-Mac xcconfig, included last with `#include? "<file>"` (the `?` makes
  it optional) and written once: `echo "DEVELOP_MAC_HOST = $(scutil --get LocalHostName).local" > <file>`.
- Keep that file out of every folder xcodegen adds whole (`fileGroups`): there it lands in the committed project as a
  file no other checkout has.
- A build phase stops a develop build for `iphoneos` without `DEVELOP_MAC_HOST` and prints the line to write, this
  Mac's name filled in from `scutil --get LocalHostName`.
- Only the develop plist gets `NSAllowsLocalNetworking` (ATS lets plain HTTP reach `.local` names, unqualified names
  and IP addresses; since iOS 17 IP addresses need it) and `NSLocalNetworkUsageDescription`. iOS asks once, at the
  first connection: allowed, try again; denied, Settings → Privacy & Security → Local Network.
- iOS has no `adb reverse`: the phone reaches the Mac over a network that lets devices talk to each other, and an
  office Wi-Fi can isolate them. Other devices' Bonjour names there (`dns-sd -B _apple-mobdev2._tcp local.`, stopped
  after a few seconds) mean `.local` names resolve; where they don't, the Mac's IP (`ipconfig getifaddr en0`) does for
  the session.

## Android: adb reverse

- `adb reverse tcp:<port> tcp:<port>` makes the phone's `localhost:<port>` the Mac's, over USB, whatever the network.
  It lasts until the phone disconnects or adb restarts.
- Build develop with the URL at `http://localhost:<port>/` for that run: `-P<property>=…`, or the property in
  `~/.gradle/gradle.properties` (the emulator then needs `adb reverse` too).
- The develop network security config allows cleartext to `localhost` as well as `10.0.2.2`.

## Checking it yourself

- An unsigned device build in a scratch derived data folder, never the person's:
  `xcodebuild … -destination 'generic/platform=iOS' -derivedDataPath <scratch> CODE_SIGNING_ALLOWED=NO build`, then
  `plutil -extract <URL key> raw <scratch>/Build/Products/<Configuration>-iphoneos/<App>.app/Info.plist`.
- A fresh derived data folder can hang extracting a Swift package's binary target: reuse one whose packages are
  resolved, `-clonedSourcePackagesDirPath <resolved>/SourcePackages -skipPackageUpdates`.
- Which phone, and how it is connected: `xcrun devicectl list devices`, then
  `xcrun devicectl device info details --device <udid>` (transport `wired` or the network); `adb devices` on Android.
- After the person opens the project in Xcode, run `git status`: Xcode can rewrite a generated project and its plists
  (seen: a develop-only plist key moved into every configuration's build settings, the store build's included).
  Regenerate from the project spec instead of keeping that edit.
