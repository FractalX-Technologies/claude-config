---
name: flow-pipelines
description: Put a mobile (Kotlin Multiplatform) or Electron desktop app on the shared client app pipelines, or move its pin to a newer release - follow the template's own runbook (docs/adopting.md at the release tag), set up what gh can, hand the owner the names of what only they provide, and prove it with runs read from the API. Use when the user asks for CI/CD, pipelines, releases, a release ladder, TestFlight, Firebase or Play distribution for an app, or to upgrade the template ("monta los pipelines", "añade CI/CD", "configura las releases", "sube la plantilla a vX", "pin to vX").
---

# Pipelines from the template

The template is the one named in `CLAUDE.md` § Stack for client apps. Its `docs/adopting.md` is the runbook and its
README the reference; both are read **at the release tag** the app will pin, never at `main`. This skill only says
how to get there and what never changes.

## 1. Pick the release and read the runbook

```bash
gh api repos/<owner>/<template>/tags --paginate -q '.[].name' | grep -v -- '-rc\.' | sort -V | tail -1
gh api "repos/<owner>/<template>/contents/docs/adopting.md?ref=vX.Y.Z" -H "Accept: application/vnd.github.raw"
```

Say the tag in one line before the first edit. An rc is never pinned by an app that ships.

**Done when** the runbook and the README sections it names are read at that tag.

## 2. Follow the runbook, step by step

Each of its steps ends on a "done when": do not move on before it holds, and write the answer of each in the pull
request's description. The GitHub Actions rules apply to every caller you copy (`rules/github-actions`).

- You set up what `gh` can: environments, branch policies, variables by name, rulesets, the label, `CODEOWNERS`.
- The owner provides values you never see: secrets (`gh secret set NAME --env <Environment> < file`, run by them),
  store accounts, certificates, keys. Ask for all of them once, as one list of names, before the GitHub step.
- Never a secret's value in a file you read, in a log or in chat; never a caller on `@main`; never a tag by hand.

**Done when** every runbook step's criterion holds, in order.

## 3. Prove it with runs, not with a green badge

Every claim about a run comes from the API (`gh run view <id> --json jobs`), job by job: which ran, which skipped,
which was cancelled. A macOS job GitHub cancels for capacity ("not acquired by Runner") is re-run with
`gh run rerun <id> --failed`, not reported as a failure of the change.

**Done when** the runbook's proofs are run URLs with their jobs' conclusions in the pull request's description, and
the handoff names what the owner still has to provide.
