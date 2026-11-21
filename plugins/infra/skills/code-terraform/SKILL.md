---
name: code-terraform
description: Use when implementing infrastructure as code with Terraform on Azure (azurerm). Invoke for module development (create reusable modules, manage module versioning), state management (migrate backends, import existing resources, resolve state conflicts), provider configuration, multi-environment workflows, and infrastructure testing.
metadata:
  version: "1.0.0"
  domain: infrastructure
  triggers: Terraform, infrastructure as code, IaC, terraform module, terraform state, AWS provider, Azure provider, GCP provider, terraform plan, terraform apply
  role: specialist
  scope: implementation
  output-format: code
---

# Terraform Engineer

The Terraform rules are the baseline. Infrastructure is Azure (azurerm), all in the platform IaC repo: one root per
project, values per environment; app repos hold no Terraform. **Nothing is applied from a laptop**: a pull request
gets a plan, the merge applies dev, and prd is applied by a deliberate run on `main`, so step 7 below hands off the
plan. No secret value is read or written by
Terraform. **Where this and a rule disagree, the rule wins and you say so out loud.**

Senior Terraform engineer specializing in infrastructure as code on Azure, with expertise in modular design, state management, and production-grade patterns.

## Core Workflow

1. **Analyze infrastructure** — Review requirements, existing code, cloud platforms
2. **Design modules** — Create composable, validated modules with clear interfaces
3. **Implement state** — Configure remote backends with locking and encryption
4. **Secure infrastructure** — Apply security policies, least privilege, encryption
5. **Validate** — Run `terraform fmt` and `terraform validate`, then `tflint`; if any errors are reported, fix them and re-run until all checks pass cleanly before proceeding
6. **Plan and review** — Run `terraform plan -out=tfplan` and extract a summarized plan highlighting creates, updates, deletes, and especially any destructive actions (recreations or deletions); if the plan fails, see error recovery below
7. **Hand off the plan** — Present the plan summary, calling out every destructive action. The apply is the pipeline's (dev on merge, prd by a run on `main`), never `terraform apply` from a local shell

### Error Recovery

**Validation failures (step 5):** Fix reported errors → re-run `terraform validate` → repeat until clean. For `tflint` warnings, address rule violations before proceeding.

**Plan failures (step 6):**
- *State drift* — Diagnose with `terraform plan -refresh-only`. The state is shared, so a fix is an `import` / `removed` block that the pipeline applies, never a local `terraform refresh`, `state rm` or `import`.
- *Provider auth errors* — Verify credentials, environment variables, and provider configuration blocks; re-run `terraform init` if provider plugins are stale, then re-plan.
- *Dependency / ordering errors* — Add explicit `depends_on` references or restructure module outputs to resolve unknown values, then re-plan.

After any fix, return to step 5 to re-validate before re-running the plan.

## Reference Guide

Load detailed guidance based on context:

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Modules | `references/module-patterns.md` | Creating modules, inputs/outputs, versioning |
| State | `references/state-management.md` | Remote backends, locking, workspaces, migrations |
| Providers | `references/providers.md` | AWS/Azure/GCP configuration, authentication |
| Testing | `references/testing.md` | terraform plan, terratest, policy as code |
| Best Practices | `references/best-practices.md` | DRY patterns, naming, security, cost tracking |

## Constraints

### MUST DO
- Use semantic versioning and pin provider versions
- Enable remote state with locking and encryption
- Validate inputs with validation blocks
- Use consistent naming conventions and tag all resources
- Document module interfaces
- Run `terraform fmt` and `terraform validate`

### MUST NOT DO
- Store secrets in plain text or hardcode environment-specific values
- Use local state for production or skip state locking
- Mix provider versions without constraints
- Create circular module dependencies or skip input validation
- Commit `.terraform` directories

## Code Examples

### Minimal Module Structure

**`main.tf`**
```hcl
resource "azurerm_resource_group" "this" {
  name     = var.name
  location = var.location
  tags     = var.tags
}
```

**`variables.tf`**
```hcl
variable "name" {
  description = "Resource group name, built from the platform naming pattern"
  type        = string

  validation {
    condition     = length(var.name) <= 90
    error_message = "name must be at most 90 characters."
  }
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "tags" {
  description = "Platform tags applied to every resource"
  type        = map(string)
}
```

**`outputs.tf`**
```hcl
output "id" {
  description = "ID of the resource group"
  value       = azurerm_resource_group.this.id
}
```

### Remote Backend Configuration (Azure Storage)

```hcl
terraform {
  backend "azurerm" {
    use_azuread_auth = true   # Entra ID, never the storage account key
    use_oidc         = true   # CI signs in with OIDC
    # resource_group_name, storage_account_name, container_name and key come from the pipeline (-backend-config)
  }
}
```

### Provider Version Pinning

```hcl
terraform {
  required_version = ">= 1.11"   # write-only arguments need 1.11+

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "4.52.0"       # pinned; a major upgrade is its own change
    }
  }
}
```

Commit `.terraform.lock.hcl`.

## Output Format

When implementing Terraform solutions, provide: module structure (`main.tf`, `variables.tf`, `outputs.tf`), backend and provider configuration, example usage with tfvars, and a brief explanation of design decisions.