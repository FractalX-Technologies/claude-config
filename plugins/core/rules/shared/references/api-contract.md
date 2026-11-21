---
paths:
  - "**/openapi*.yaml"
  - "**/openapi*.yml"
  - "**/openapi*.json"
  - "**/api/**"
  - "**/Endpoints/**"
  - "**/Controllers/**"
  - "**/data/models/**"
  - "**/data/repositories/**"
---

# API contract

## Who talks to whom

- Mobile apps → the BFF → the API. The BFF composes data for screens and wraps responses in the envelope the mobile
  `BaseRepository` expects (`{statusCode, data}`; errors as `{errorCode, errorMessage, errorDetails, statusCode}`).
- Web and desktop clients may call the API directly, with no envelope.
- The API never shapes a response for one screen. That's the BFF's job.

## OpenAPI is the source of truth

- The OpenAPI file **is** the contract: not the handlers, not a Postman collection.
- The spec and the code change in the same commit.
- Clients generate their types from it when they can. A field not in the spec doesn't exist.
- Docs readable by callers: a `summary` of a few words, a one-sentence `description`. The reasoning goes in a `#`
  comment next to it.

## Responses

The body **is** the resource, with no wrapper.

## Errors

```json
{ "code": "USER_DEACTIVATED", "message": "This account has been deactivated.", "details": { "since": "2026-09-01T10:00:00Z" } }
```

- **`code` is the contract.** Clients decide on it, never on the status alone or on `message`.
- Codes are permanent: adding one is fine, changing what one means is breaking.
- `message` reaches logs and developer tools, never a user screen. It never contains SQL, a stack trace, an internal id
  or personal data.
- `details` is structured data, never a formatted string.
- The HTTP status is still correct. The code → status mapping lives in one file.
- An unknown code → a generic message on the client.

## Pagination

`GET /v1/users?page=2&pageSize=50` returns the items plus the headers `x-page`, `x-page-size` and `x-total-count`.
Mobile reads exactly these lowercase names: renaming one breaks pagination with no compile error. The BFF forwards
them. `pageSize` has a server maximum.

## Versioning

- `/v1/…` in the path from day one.
- Within a version only additions: new optional fields, endpoints, error codes. Never remove a field, narrow a type,
  make an optional field required or change a meaning.
- Removing something → `/v2`, and `/v1` stays until no released client uses it.
- New DTO field: optional first; remove the old one a release later.

## Formats

- Timestamps: RFC 3339 in UTC (`2026-09-01T10:00:00Z`).
- Durations: integer milliseconds, with the unit in the name (`timeoutMs`).
- Ids: opaque; clients never read meaning into them.
- Money: integer minor units + ISO 4217 code (`{"amountMinor": 4250, "currency": "AED"}`). Never a float.
- Enums: lowercase snake_case, and clients tolerate an unknown value.
