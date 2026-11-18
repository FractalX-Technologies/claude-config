---
paths:
  - "**/auth0*/**"
  - "**/auth0*.tf"
---

# Auth0 in Terraform

One tenant for every app, in the platform IaC repo, with the `auth0/auth0` provider. An app repo holds none of it.

## Where it lives

- The tenant is a root of its own (`projects/auth0`). It is production's tenant, so the root has `prd` alone: pull
  requests plan it, and only the deliberate run on `main` applies it.
- An app is one call of the tenant's app module per environment, in a file of its own in that root (`<app>.tf`): its
  API (RS256) and its applications. Names say the environment unless it is production.
- The root owns what is the tenant's: its flags, Attack Protection, the connections and which applications each one
  is enabled for.
- An app's domain, audience and client ids are not secrets: the platform sets them on the app's container
  ([code.md](code.md) § App settings), and a client names them in its build settings. A native app has no secret.

## The credential: a client secret

Auth0 has no OIDC for CI, and Private Key JWT takes its Enterprise plan. Terraform signs in with a client secret: the
one exception to "CI never signs in with a client secret".

- Two machine-to-machine applications, never one:
  - **plan**: Management API permissions that only read. Its secret is a repo secret (and a Dependabot one), because
    a pull request's plan runs code nobody reviewed yet.
  - **apply**: the permissions the root's resources need. Its secret lives in production's environment alone, and the
    workflow hands it to the tenant's own run and to no other step.
- Neither gets `read:client_keys`, `read:client_credentials` or any permission about users: with one of them the
  provider writes every application's secret, or people's data, into state.
- The repo's bootstrap script creates both, sets their permissions and moves each secret from Auth0 to GitHub without
  printing it. Change an application or a permission there, never in the dashboard. Rotation is the same script.
- A new kind of resource needs its permissions in that script first: without them its plan fails with 403.
- A test pins which job and step may name each secret.

## Changing safely

- `prevent_destroy` on a connection (deleting it deletes its users) and on Attack Protection.
- Removing an application: a `removed { lifecycle { destroy = false } }` block for its `auth0_client_credentials`.
  Destroying them takes a permission the apply application must not have.
- The provider keeps an API's signing secret in state even when the API signs with RS256: state stays private, and a
  test pins RS256.

## By hand

- Creating the tenant, its admins and its subscription. The bootstrap script runs as an admin signed in to the
  Auth0 CLI.
- What Terraform didn't create (the tenant's default application and connections) is not managed: delete it in the
  dashboard, or bring it in with an `import` block.
