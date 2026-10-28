---
paths:
  - ".github/workflows/**"
  - ".github/actions/**"
  - "**/action.yml"
  - ".github/dependabot.yml"
---

# GitHub Actions

Deployments use the shared pipeline template: reusable workflows plus callers you copy into each repo.

## Never break these

1. A service's pipeline comes from the shared template: copy its callers, never write one from scratch. Call the
   template by its **release tag** (`@vX.Y.Z`), never `@main` or a branch.
2. Build once and promote the same artifact up the environments (dev → prd). Never rebuild for another environment.
3. The version comes from the pull request title marker. A tag is created only after a healthy deploy, by the
   pipeline: never by hand.
4. Azure through OIDC (`id-token: write` + `azure/login`). No long-lived credentials, no registry admin user. Another
   GitHub repo or the GitHub API: a GitHub App token, never a personal access token.
5. `permissions:` read-only at the top of the workflow, widened per job only as far as that job needs.
6. Never put untrusted text (`${{ github.event.pull_request.title }}`, branch names, issue text) inside `run:`. Pass it
   through `env:` and quote it.
7. Secrets go from `secrets` into a step's `env:`, or into an action's `with:` input: never on a command line, in
   `$GITHUB_ENV`, in logs or in build arguments.
8. Third-party actions are pinned to a full commit SHA, with the version in a comment. Dependabot keeps them current.
9. Production deploys run in a GitHub Environment. Its gate is a required reviewer where the GitHub plan offers one,
   otherwise the manual promote run.
10. Every job has `timeout-minutes`; deploy workflows use `concurrency` so runs queue instead of racing.

## More detail

| File | Explains | Loads with |
|---|---|---|
| [`template.md`](references/template.md) | callers per workload, version markers, the ladder, promote, rollback, migrations, setup | workflows |
| [`security.md`](references/security.md) | permissions, OIDC, a GitHub App for other repos, injection, secrets, pinning, untrusted pull requests, runners | workflows, actions |
| [`mobile.md`](references/mobile.md) | Android and iOS pipelines: the template's mobile callers and shared lanes, or an app's own | mobile workflows, fastlane |
