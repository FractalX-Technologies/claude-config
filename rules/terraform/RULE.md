---
paths:
  - "**/*.tf"
  - "**/*.tfvars"
  - "**/.terraform.lock.hcl"
---

# Terraform

Infrastructure on Azure with Terraform, all in the **platform IaC repo**: one root per project, its state and values
per environment, and the modules beside it. App repos hold no Terraform: the platform sets an app's settings on its
container.

## Never break these

1. **Nothing is applied from a laptop.** A pull request gets a read-only plan; the merge applies dev; prd is applied by
   a deliberate run on `main`. The only manual steps are the bootstrap (once) and seeding a new project's empty state.
2. Read the plan before merging, and call out every destroy or replace with its reason.
3. Environments differ in values, not in code: one root per project, with `backend/<env>.hcl` and `env/<env>.tfvars`.
   A change lands in dev first, then prd.
4. No secret value in code, `tfvars` or state. Non-secret settings are container env vars; a real secret is a Key
   Vault reference by name, and write-only arguments (`*_wo`) are used where the provider has them.
5. State is remote (Azure Storage, Entra ID auth, one container per environment). Never local state, never hand
   edits: use `import`, `moved` and `removed` blocks.
6. Versions are pinned: Terraform and providers exactly, `.terraform.lock.hcl` committed. Modules live in `modules/`,
   sourced by path; once a second repo needs one, it moves to a modules repo, pinned by tag (`?ref=vX.Y.Z`).
7. CI signs in to Azure with OIDC, never with a client secret. Pull request plans use a read-only identity and take no
   state lock. Each environment has its own apply identity, limited to its own subscription and state container.
8. A service identity gets roles on named resources, never Contributor on a resource group: it could read secrets and
   rewrite apps.
9. `terraform fmt -check` and `terraform validate` are clean: run them locally after `terraform init -backend=false`,
   which only downloads the providers. The pull request's plan is the test against Azure.
10. The portal is for reading. A change made there is drift the next apply reverts: write it in code, with an `import`
    block for anything created there.

## More detail

| File | Explains | Loads with |
|---|---|---|
| [`code.md`](references/code.md) | files, providers, modules, variables, names and tags, lifecycle, app settings, security | Terraform code |
| [`workflow.md`](references/workflow.md) | how a change ships, a new project, drift, locks, the pull request checklist | Terraform code |

`code-terraform` covers Terraform depth. If a skill and a rule disagree, the rule wins: say so.
