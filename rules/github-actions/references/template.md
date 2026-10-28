---
paths:
  - ".github/workflows/**"
---

# The shared pipeline template

The template's README is the reference (every input, the Azure roles, troubleshooting): read it at the tag the repo
pins. This file holds what to decide before copying anything.

## Pick the callers

| Workload | Callers |
|---|---|
| Backend in an Azure Container App | `callers/backend/containerapp/` (build and deploy, promote, rollback) |
| Mobile app, native screens on shared Kotlin | `callers/mobile/kmp/` (CI, store deploy), plus the template's fastlane lanes ([mobile](mobile.md)) |

Copy them into `.github/workflows/`, edit only their `with:` block (service, image, resource names with `{0}` for the
environment), and pin the template to its release tag.

## Version markers (in the pull request title)

| Marker | Effect |
|---|---|
| `[MAJOR]` | `1.4.2 → 2.0.0` |
| `[FEATURE]` | `1.4.2 → 1.5.0` |
| `[PATCH]`, or no marker | `1.4.2 → 1.4.3` |
| `[NOVERSION]` | no build, no release |

## The ladder

```
<service>-X.Y.Z-dev  ─promote→  <service>-X.Y.Z-prd
```

- A merge to `main` that touches the service builds one image, deploys it to dev by digest and tags
  `<service>-X.Y.Z-dev`, only if dev is healthy.
- **Promote** (Actions tab, with `X.Y.Z`) imports that same digest into the next environment's registry and deploys
  it. Only a version built on the default branch climbs; nothing is rebuilt.
- **Rollback** redeploys the newest earlier digest the environment ran, never one older than `oldest_version`. It runs
  no migration.
- With `migration_job_name`, the environment's Container Apps Job runs the same digest before the deploy and must
  succeed, or nothing is deployed or tagged. Migrations are additive: the running version keeps serving meanwhile.
- What an environment runs is its deployed image, not the newest git tag.

## Setup per repo, once

- Backend: repo variable `AZURE_TENANT_ID`; per GitHub Environment (`Development`, `Production`), `AZURE_CLIENT_ID`
  and `AZURE_SUBSCRIPTION_ID`, plus `AZURE_PROMOTION_SOURCE_SUBSCRIPTION_ID` on an environment that is promoted into.
  The deployer identities and their roles come from the platform IaC repo.
- Mobile: the CI GitHub App and the `Mobile stores` environment ([mobile](mobile.md), the template's README).
- `Production`'s gate is a required reviewer where the GitHub plan offers one (not on private repos below
  Enterprise); otherwise the manual promote run is the gate.
- The calling job grants what the template's jobs need (`contents: write` and `id-token: write` for build and promote),
  or GitHub refuses the run.

## When the template doesn't cover it

A mobile app of another shape and macOS apps have their own workflows ([mobile](mobile.md)). A new kind of service
starts from the template's conventions (the version markers, the ladder, OIDC, environments) and, once a second repo
needs it, moves into the template instead of being copied.
