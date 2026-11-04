---
paths:
  - ".github/workflows/**"
---

# The shared pipeline template

One template for every workload. Its README is the reference (every input, troubleshooting) and its `docs/` the rest:
`backend.md` (the backend's ladder, Azure roles, setup), `settings.md` (every secret and variable by level),
`adopting.md` (the runbook an agent follows for a client app: the `flow-pipelines` skill). Read them at the tag the
repo pins. This file holds what to decide before copying anything.

## Pick the callers

| Workload | Callers |
|---|---|
| Backend in an Azure Container App | `examples/backend/.github/`: one caller, `backend-release.yml` (a merge, a promotion and a rollback), and `backend.yml`, the rungs |
| Mobile app (Kotlin Multiplatform) or Electron desktop app | `examples/<kind>/.github/`, the fastlane plugin's lanes and the runbook `docs/adopting.md` ([mobile](mobile.md), the `flow-pipelines` skill) |

Copy them into `.github/`, edit only the caller's `with:` block (the Dockerfile's folder, the image name, the health
path; an app's root), declare the rungs in the `.github/<kind>.yml`, and pin the template to its release tag. The
runbook `docs/adopting.md` is for every kind, the backend included.

## Version markers (in the pull request title)

| Marker | Effect |
|---|---|
| `[MAJOR]` | `1.4.2 → 2.0.0` |
| `[FEATURE]` | `1.4.2 → 1.5.0` |
| `[PATCH]`, or no marker | `1.4.2 → 1.4.3` |
| `[NOVERSION]` | no build, no release |

## The ladder

```
backend-X.Y.Z-dev  ─promote→  backend-X.Y.Z-prd        (the rungs of .github/backend.yml, any number, any ids)
```

- A merge to `main` that touches the service builds one image, deploys it to the first rung by digest and tags
  `backend-X.Y.Z-<rung>` with `digest: sha256:…` in the message, only once the rung is healthy (its newest revision
  ready and the health path answering).
- **Promote** (Actions → Backend release → an environment, with `X.Y.Z` or the newest below) imports the digest the
  rung below's tag records into this rung's registry and deploys it. Only a version built on the default branch
  climbs, never skipping a rung; nothing is rebuilt; a tag without a digest (before the ladder, or by hand) cannot
  climb: ship the code as a new merge.
- **Rollback** on any rung (`rollback_to X.Y.Z`, a version that reached it) redeploys that version's recorded digest
  as a new version. It runs no migration. The last rung only moves up: promoting a version older than its newest is
  refused.
- With the rung's `MIGRATION_JOB_NAME` variable, that Container Apps Job runs the same digest before the deploy and
  must succeed, or nothing is deployed or tagged. Migrations are additive: the running version keeps serving meanwhile.
- What an environment runs is its deployed image, not the newest git tag.

## Setup per repo, once

- Backend: the names of the template's `docs/settings.md` § A backend's rungs: repo variable `AZURE_TENANT_ID`; on
  each rung's GitHub environment, `AZURE_CLIENT_ID`, `AZURE_SUBSCRIPTION_ID`, `ACR_NAME`, `CONTAINER_APP_NAME`,
  `RESOURCE_GROUP`, `MIGRATION_JOB_NAME` (a database) and, on a rung promoted into, `PROMOTION_SOURCE_REGISTRY_ID`
  (the rung below's registry resource id). The deployer identities and their roles (`docs/backend.md`: AcrPush on
  the first rung, Data Importer and Reader on both registries for a promotion, Container Apps Contributor, Jobs
  Contributor) come from the platform IaC repo.
- Mobile and desktop: the template's runbook (`docs/adopting.md`) lists the environments, the names and what only the
  owner provides ([mobile](mobile.md)).
- `Production`'s gate is a required reviewer where the GitHub plan offers one (not on private repos below
  Enterprise); otherwise the manual promote run is the gate.
- The calling job grants what the template's jobs need (the example's `contents: write`, `pull-requests: read` and
  `id-token: write`), or GitHub refuses the run.

## When the template doesn't cover it

A mobile app of another shape and macOS apps have their own workflows ([mobile](mobile.md)). A new kind of service
starts from the template's conventions (the version markers, the ladder, OIDC, environments) and, once a second repo
needs it, moves into the template instead of being copied.
