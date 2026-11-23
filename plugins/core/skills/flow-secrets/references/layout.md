# Project layout in Infisical

Read before creating a project, an environment or a folder, or before adding a secret to a wired repo. A project
made before this layout keeps its names where changing them would break a config, and its runbook says which.

## Projects

- One project per repo, named as the repo. Imports and references work inside one project only, so a repo never
  spreads over two.
- A value several repos use (a store account, a signing certificate's password) lives once, in a shared project of
  the organization. Each repo's pipeline reads it from there; it is never copied into each repo's project, where
  the copies drift.

## Environments

- Infisical's own slugs: `dev`, `prod`, and `staging` only where a real staging deployment exists. A slug is in every
  config and pipeline: never rename one in use.
- Every environment holds the same folders and the same keys. A key that exists in only one (a dev-only login
  bypass) says so in its comment.

## Folders: one per consumer

A folder is what one process reads, named after it, lowercase kebab-case. It is also the unit of access: a
pipeline's or a tool's identity is granted one folder, never the project.

| Folder | Holds | Read by |
|---|---|---|
| `/web`, `/api`, `/<service>` | what that app reads at runtime, named as the repo's folder for it | the app, locally and in its host |
| `/mobile` | keys a mobile build needs (a maps key) | the build. Nothing in a binary is secret |
| `/functions` | serverless functions whose platform keeps its own secrets | the platform, through a sync |
| `/db` | the database password and connection strings for migrations and ops scripts | the scripts |
| `/release` | signing keys, store credentials, symbol upload tokens; in `prod` only | the release pipeline |
| `/shared` | a value two folders need (a backend URL) | imported by those folders |
| `/<tool>` | a bot or tool that runs with less reach than a person | that tool's own identity |

- A folder exists only once something reads it. ✗ `/stripe`, `/secrets`, `/misc`: a vendor or a bag is not a
  consumer, and its access cannot be scoped.
- A value has one home. A second folder that needs it imports the folder or references the key
  (`${prod.shared.API_URL}`); a pasted copy drifts.

## Keys

- Named exactly as the code reads them (`STRIPE_SECRET_KEY`), the same name in every environment. ✗ `PROD_STRIPE_KEY`:
  the environment is the slug's job.
- Each key's comment says where the value comes from and how to rotate it (the dashboard page, the command).
- Configuration that is no secret (a bundle id, an org slug, a feature switch) stays in the repo, not here.

## Who reads and who writes

- Developers read `dev`. `prod` is read by the owner and by machine identities, each scoped to one folder and one
  environment, signed in with OIDC from CI rather than a long-lived token.
- A platform that holds its own copy (hosting, serverless functions, CI, a key vault) gets it from Infisical through
  a Secret Sync or the repo's push script. Infisical is the source: a value typed only on the platform is a value
  that is lost.
- Folders and environments carry no value: an agent may create them, by this layout. Values are typed by the owner
  on Infisical's page (`SKILL.md` › Never).
