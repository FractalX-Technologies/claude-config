---
paths:
  - "**/*.controller.ts"
  - "**/*.service.ts"
  - "**/*.module.ts"
  - "**/*.dto.ts"
---

# NestJS

Backends on NestJS serve every client of the product: mobile, web and desktop. How to write the code is in the
`code-nestjs` skill; this file holds what the clients depend on.

## Never break these

1. Business logic lives here, in services, never in a client ([thin UI](../shared/RULE.md)). The response says what a
   screen shows (items, sections, their order, what is allowed), so a change ships with a deploy instead of a store
   review.
2. Responses follow the [API contract](../shared/references/api-contract.md): values go out raw for the client to
   format, and a version only grows, because app versions already in the stores keep calling it.
