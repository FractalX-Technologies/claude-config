---
paths:
  - "**/presentation/**"
  - "**/Presentation/**"
  - "**/renderer/**"
  - "**/components/**"
  - "**/features/**"
---

# Naming screens and components

Names stay the same across platforms, so files can be matched at a glance.

## Screens

| What | Android | iOS | Electron |
|---|---|---|---|
| Screen | `<Feature>Screen.kt` | `<Feature>Screen.swift` | `<Feature>Screen.tsx` |
| Feature folder | `screens/<feature>/` | `Screens/<Feature>/` | `features/<feature>/` |
| Generic components | `presentation/components/<group>/` | `Presentation/Components/<Group>/` | `renderer/components/<group>/` |

- The screens of one flow sit **flat** in the feature folder, with one flat `components/` folder. No subfolder per
  step.
- One feature = one flow = one state holder.

## The owner prefix

A component used by one screen starts with that screen's name, without `Screen`:

- `LoginStatusCard` belongs to `LoginScreen`.
- Drop implied words: `CustomerDetailStatusCard`, not `CustomerDetailAccountStatusCard`.
- A feature with a single screen uses the feature name: `KycContactInputStep`.

Used by another feature → move it to the generic folder and drop the prefix.

## Role suffixes

| Role | Suffix | Example |
|---|---|---|
| Input field | `Field` | `SettingsSearchField` |
| Fields with their submit | `Form` | `LoginPinForm` |
| Picker or menu | `Picker` / `Menu` | `DatePicker`, `CountryMenu` |
| Filter or toggle | `Chip` | `CategoryChip` |
| Compound card | `Card` | `UserProfileCard` |
| Inline alert | `Banner` | `OfflineBanner` |
| Toolbar or header row | `Bar` | `CustomerDetailActionBar` |
| Animated or decorative view | `View` | `LoadingDots` |

Rename on sight: `Input` → `Field`, `Header` → `Bar`.

## When a component becomes a screen

When at least 3 of these are true:

1. It has 3 or more components of its own.
2. It hosts navigation.
3. It would be longer than about 200 lines.
4. It manages its own lifecycle (effects, `.task`, continuous async work).
5. It has logic worth its own ViewModel.

Then, in the same change: the screen file, its own ViewModel (registered in Koin and `KoinHelper`), its components
moved into the feature folder, and the host updated.

## File names

The file name matches its main type. One screen per file.
