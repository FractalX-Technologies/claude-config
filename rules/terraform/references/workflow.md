---
paths:
  - "**/*.tf"
  - "**/.terraform.lock.hcl"
---

# How a Terraform change ships

## The pipeline

1. A pull request runs `check` (fmt, validate, the repo's script tests), then a read-only plan per environment. The
   plan identity reads state without a lock and can't write anything.
2. The merge to `main` plans and applies dev, with dev's own apply identity.
3. prd is applied by running the workflow by hand on `main`, once dev is green. That deliberate run is the gate where
   the GitHub plan has no required reviewers.

There is no Terraform rollback: revert the change in a new pull request.

## A new project

1. Its root under `projects/<app>/`, with `backend/<env>.hcl` and `env/<env>.tfvars` per environment.
2. Before its first pull request, an Owner seeds each environment's empty state once (the repo's `seed` command). The
   read-only plan can't create a missing state: Terraform writes to create one, even without a lock.
3. Its pipelines (deployers, registries, apps) take their names from the platform's pattern.

## Drift

- The next plan shows it. Fix drift in code (change the HCL, or add an `import` / `removed` block) and let the
  pipeline apply it. Never a local `terraform refresh`, `state rm` or `import`.

## Locks

- Applies take the state lock and wait for it (`-lock-timeout`); plans take none. A held lock means an apply is running
  or died: check the workflow runs before anyone releases it.

## Before opening the pull request

- [ ] `terraform fmt` and `terraform validate` clean, and the repo's script tests green.
- [ ] The plan read: every destroy or replace explained; no secret in the diff.
- [ ] New resources carry the naming pattern and the tags.
- [ ] An app setting exists in every environment that needs it, and the app reads it.
- [ ] The pull request says what will change in each environment.
