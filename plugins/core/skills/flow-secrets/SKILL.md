---
name: flow-secrets
description: Run an app with its secrets from Infisical - ask which of the repo's environments, check the session, start it through the repo's own command, and never print a value. Use before starting, building or signing an app in a repo with `.infisical.yaml` at its root ("run the app", "start the backend", "start it in dev", "with the prod keys"), when a start stops on a missing key or session ("no Infisical session", "infisical login", "a variable is missing"), or when asked to wire a repo to Infisical or lay out its project ("set up Infisical", "create the folders").
---

# Secrets from Infisical

A repo is **wired** when `.infisical.yaml` sits at its root. Its keys then live in Infisical, one set per
environment, and reach an app only as its process starts. Nothing is copied into a file, and no value is ever
shown. Every repo whose apps run with secrets in more than one environment must be wired (CLAUDE.md › Secrets).

## Steps

1. **Read the repo's set-up**: its secrets runbook (`docs/runbooks/secrets.md`), or what
   `git grep -n -i infisical -- '*.md' '*.json' '*.sh'` names. The environments, the folder of each app and the
   command that starts it are the repo's: never guess a name. Done when you can name the repo's environments, the
   one it starts with by default, the command for each, and what production's keys change (what they spend, post
   or send for real).
2. **Ask which environment**, once per task, unless the user's message already names it. `AskUserQuestion`, in the
   same call as the task's other questions: one option per environment the repo names, the one with the least reach
   first and recommended (no keys where the repo offers it, else development), and production's description saying
   what it changes. Done when the user named one. Production is never the default and never assumed from an
   earlier task.
3. **Check the session**, for that environment, with a run of nothing:

   ```bash
   infisical secrets-manager run --silent --project-config-dir <repo root> --env <env> --path <folder> -- true < /dev/null
   ```

   Exit 0: signed in, and this person reads that environment. Any other exit, stop and say which case:
   - `command -v infisical` finds nothing → the CLI is missing: installing it is a machine install, the user's to
     approve (CLAUDE.md › Installs).
   - "No valid login session" → the user signs in: `! infisical login --domain <the address .infisical.yaml names>`.
     It opens a browser and is theirs to do.
   - "Could not fetch secrets" → the name is wrong, or this person may not read that environment. Access is the
     project owner's to give: never try another environment in its place.

   Done when the run exits 0, or the user holds the one command or the one person that fixes it.
4. **Start it through the repo's command**, as its runbook writes it, with the environment the user named. The
   user's own apps keep running: another port and configuration (CLAUDE.md › My machine). Done when the app answers
   its health check and the reply says whose keys it ran with.
5. **Answer a question about a key by its shape**: whether a name is there, how long its value is, never the value.
   The whole line, `jq` included:

   ```bash
   infisical secrets-manager secrets get --env <env> --path <folder> -o json --silent | jq -r '.[].secretKey'
   ```

   Done when the answer holds names, counts or lengths alone.

## What a wired repo holds

Check these before trusting a repo's set-up, and build them when wiring one. A repo with environments and no
`.infisical.yaml` isn't wired: say so before running its app, and wire it as a task of its own. It starts once
the owner has made the repo's project in Infisical, with its environments, and named its id: the values are
theirs to type there.

- `.infisical.yaml` at the root: the project and Infisical's address. An id, no secret.
- The project's environments, folders and key names follow [the layout](references/layout.md): read it before
  creating any of them or adding a secret.
- One command per app that takes the environment by name, starts with the least reach by default, and can run
  with no keys at all, for a machine with no account.
- Settings that are no secret, in a versioned file the app loads as it stands: a clone starts with nothing copied.
  A switch that turns something real on (posting, charging, sending) is never Infisical's: shared, one person's
  choice would act from every machine.
- A guard for whatever production's keys could break from a laptop, in the command itself and under test.
- A runbook: where each secret lives, who reads what, the commands, how to add one.
- A test with a stand-in for the CLI: no account, no network.

## Never

- A command that prints values: `infisical export`, `infisical user get token`, `secrets` or `secrets get` with no
  `jq` narrowing it to names, a run of `env` or `printenv`. The `protect-secrets` hook refuses them.
- `infisical login` or `logout` yourself: the session is the person's, and a logout deletes it.
- Writing a secret (`secrets set`, `delete`): a value typed as an argument stays in the shell's history. The owner
  types it on Infisical's page. A value that doesn't exist yet is left out, never a placeholder.
- A `.env` written from Infisical "to make it work": the repo's command is the way in.
- Production's keys without the user naming production in this task, or past the repo's guard.
