---
paths:
  - "**/*.csproj"
  - "**/Directory.Packages.props"
  - "**/Directory.Build.props"
  - "**/nuget.config"
  - "**/packages.lock.json"
---

# NuGet packages and shared libraries

## Versions

- Every package version lives once, in `Directory.Packages.props` (Central Package Management).
- Restores are locked (`packages.lock.json`, `--locked-mode`): every machine and CI resolve the same graph. Adding or
  bumping a package changes the lock files in the same change.
- `nuget.config` names the sources explicitly, so a machine-wide feed can't answer for a public package.
- `Directory.Build.props` sets, for every project: the target framework, `Nullable`, warnings as errors, the analyzers
  and lock files.
- A new package that touches auth, crypto or the network is a decision, not a convenience. Fewer packages is the goal:
  most needs are in the shared framework.

## Writing a shared library (NuGet)

- **No business logic in a package**: no hardcoded user text or display formatting. The consumer owns its content.
- Only what consumers need is `public`; the rest is `internal`.
- The library exposes one `Add<Feature>()` registration; consumers call it from their own `Add<Area>()`, never
  directly in `Program.cs`.
- Protocol values, third-party enums and standard MIME types live in the package, not repeated in each consumer.
- Similar features look alike: if one pass type has only JSON models, the others follow the same pattern.
- A consumer doesn't create a DTO that copies a library type field for field: it uses the library type, and wraps it
  only to add something.
- Code that two services repeat moves into the shared library.
