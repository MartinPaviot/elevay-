# Lightfield API Documentation — Complete Dump

> Crawled from https://docs.lightfield.app on 2026-05-04
> API is in beta. Methods, parameters, and response schemas may change.

---

## Table of Contents

1. [Overview & Authentication](#overview--authentication)
2. [API Versioning](#api-versioning)
3. [Rate Limits](#rate-limits)
4. [Idempotency](#idempotency)
5. [Error Handling](#error-handling)
6. [Scopes](#scopes)
7. [Fields and Relationships](#fields-and-relationships)
8. [List Endpoints (Pagination & Filtering)](#list-endpoints-pagination--filtering)
9. [Auth Resource](#auth-resource)
10. [Account Resource](#account-resource)
11. [Contact Resource](#contact-resource)
12. [Opportunity Resource](#opportunity-resource)
13. [Task Resource](#task-resource)
14. [Note Resource](#note-resource)
15. [Meeting Resource](#meeting-resource)
16. [List Resource](#list-resource)
17. [File Resource](#file-resource)
18. [Member Resource](#member-resource)
19. [MCP Server](#mcp-server)
20. [SDKs & CLI](#sdks--cli)
21. [Workflows](#workflows)
22. [Workflow Recipes](#workflow-recipes)

---

## Overview & Authentication

**Base URL:** `https://api.lightfield.app`

**API Version:** Beta (2026-03-01)

**Authentication:** Bearer token via `Authorization` header.
- Format: `Authorization: Bearer sk_lf_...`
- API keys created at: https://crm.lightfield.app/crm/settings/api-keys (admin access required)
- During key creation, select appropriate scopes for the integration

**Required Headers (all requests):**
- `Authorization: Bearer YOUR_API_KEY`
- `Lightfield-Version: 2026-03-01`
- `Content-Type: application/json` (for POST requests)

**Web App URL:** https://crm.lightfield.app

---

## API Versioning

- Version is specified via the `Lightfield-Version` header
- Current version: `2026-03-01`
- Required on every request
- Missing or malformed version header returns a 400 error with code `version_header`

---

## Rate Limits

All request categories share uniform limits during early launch:

| Category | Limit |
|----------|-------|
| Write (Create, Update) | 25 requests per second |
| Read (Retrieve, Definitions) | 25 requests per second |
| Search (List) | 25 requests per second |

**Response Headers:**
- `X-RateLimit-Limit` — Maximum requests allowed per second (bucket capacity)
- `X-RateLimit-Remaining` — Requests remaining in current window
- `X-RateLimit-Reset` — Unix timestamp (seconds) when bucket fully replenishes

**When Exceeded:** HTTP 429 Too Many Requests with `Retry-After` header (seconds).

**Best Practices:**
- Exponential backoff with escalating delays
- Monitor `X-RateLimit-Remaining` to self-throttle
- Cache responses for stable data

---

## Idempotency

Include an `Idempotency-Key` header (up to 255 characters) on any POST request.

**Behavior:**
- Second request with same key returns cached response from original
- Keys are scoped to organization + operation type
- Keys expire after 24 hours
- Failed original requests will be re-attempted (not cached)

**Supported Operations:**
- Create: `POST /v1/{entityType}`
- Update: `POST /v1/{entityType}/{id}`

**Error Cases:**
- Concurrent duplicate keys: HTTP 409 Conflict ("operation already in progress")
- Key > 255 chars: HTTP 400 Bad Request
- Different payload with same key: Returns original cached response (NOT the new payload)

**Recommendations:** Use UUIDs or unique request identifiers. Always reuse the original key for retries.

---

## Error Handling

### Error Response Structure

```json
{
  "error": {
    "type": "bad_request",
    "message": "Human-readable explanation",
    "code": "parameter_missing",
    "param": "fields.$name"
  }
}
```

- `type` (string): Machine-readable error classification
- `message` (string): Human-readable explanation
- `code` (string, optional): Finer-grained identifier (400/422 responses)
- `param` (string, optional): Request location tied to the error

### HTTP Status Codes

| Status | Type | Trigger |
|--------|------|---------|
| 400 | bad_request | Invalid parameters, fields, or relationships |
| 401 | unauthorized | Missing or invalid API credentials |
| 403 | forbidden | Valid credentials lack required scopes |
| 404 | not_found | Resource or entity type doesn't exist |
| 409 | conflict | Duplicates, locks, concurrent updates |
| 415 | unsupported_media_type | Request body isn't JSON |
| 422 | unprocessable_content | Valid JSON fails business validation |
| 429 | too_many_requests | Rate limit exceeded |
| 500 | internal_server_error | Server-side failure |
| 503 | service_unavailable | Temporary outage |

### Error Codes (400 responses)

| Code | Description |
|------|-------------|
| `referenced_resource_missing` | Referenced resource ID doesn't exist |
| `relationship_entity_missing` | Relationship contains non-existent IDs |
| `relationship_entity_inactive` | Relationship references deleted entities |
| `unknown_field` | Undefined field for the object type |
| `unknown_relationship` | Undefined relationship for the object type |
| `invalid_configuration` | Misconfigured field or relationship |
| `idempotency_key_too_long` | Header exceeds 255 characters |
| `invalid_type` | Field value has incorrect data type |
| `parameter_missing` | Required parameter absent |
| `version_header` | Missing or malformed version header |

---

## Scopes

28 available scopes organized by object type:

| Object Type | Scopes |
|-------------|--------|
| Accounts | `accounts:create`, `accounts:update`, `accounts:read` |
| Contacts | `contacts:create`, `contacts:update`, `contacts:read` |
| Opportunities | `opportunities:create`, `opportunities:update`, `opportunities:read` |
| Meetings | `meetings:create`, `meetings:update`, `meetings:read` |
| Tasks | `tasks:create`, `tasks:update`, `tasks:read` |
| Notes | `notes:create`, `notes:update`, `notes:read` |
| Lists | `lists:create`, `lists:update`, `lists:read` |
| Files | `files:create` (create, complete, cancel uploads), `files:read` (read files + signed download URLs) |
| Members | `members:read` |

Best practice: Grant minimum necessary permissions.

---

## Fields and Relationships

### Concept
Fields store data on an object (name, email, deal value). Relationships link objects together.

### Key Conventions
- System-defined: `$` prefix (e.g., `$name`, `$stage`)
- Custom: no prefix (bare slugs)

### Definitions Endpoint
`GET /v1/{objectType}/definitions` — returns complete schema for any object type.

### Field Definition Properties
- `id`: Unique identifier (or null)
- `slug`: Internal identifier
- `label`: Human-readable name
- `description`: Optional
- `valueType`: Data type
- `system`: Boolean (built-in vs custom)
- `readOnly`: Present when non-writable
- `typeConfiguration`: Type-specific settings

### Relationship Definition Properties
- `id`, `slug`, `label`, `description`, `system`
- `cardinality`: HAS_ONE or HAS_MANY
- `objectType`: Related entity type

### 14 Value Types

| Type | Description | Write Format |
|------|-------------|-------------|
| TEXT | Plain text | String |
| NUMBER | Up to 2 decimal places | Number |
| CHECKBOX | Boolean or null | Boolean |
| CURRENCY | Amount with currency code | Number (code in typeConfiguration) |
| DATETIME | ISO 8601 with timezone offset | String |
| EMAIL | Single or array | String or string[] |
| TELEPHONE | Phone numbers (E.164) | String[] |
| URL | Single or multiple URLs | String or string[] |
| ADDRESS | Structured object | `{street, street2, city, state, postalCode, country, latitude, longitude}` |
| FULL_NAME | Name object | `{firstName, lastName}` |
| SOCIAL_HANDLE | Profile URL | String (platform in typeConfiguration) |
| SINGLE_SELECT | Option ID | String (opt_ prefix) |
| MULTI_SELECT | Option IDs | String[] |
| READONLY_MARKDOWN | AI-generated markdown | Non-writable |

### Address Object
All fields optional: `street`, `street2`, `city`, `state`, `postalCode`, `country` (ISO 3166-1 alpha-2), `latitude`, `longitude`.

### Telephone Format
- With `+` prefix: Validated as E.164 international
- Without `+`: US validation first, then 7-15 digit local
- Extensions: `;ext=` notation, normalizes various formats

### Social Handle Format
Platform specification in typeConfiguration: TWITTER, LINKEDIN, FACEBOOK, INSTAGRAM.
Accepts platform-specific URL formats. Pass `null` to clear.

### Select Options
- `id`: opt_ prefixed
- `label`: Display text
- `description`: Optional
- Org-specific; always read from definitions endpoint, never hardcode

### Type Configuration
- CURRENCY: `currency` (ISO 4217 code)
- EMAIL, TELEPHONE, URL: `unique`, `multipleValues`
- SOCIAL_HANDLE: `handleService` (platform)
- SELECT types: `options` array

### ID Prefixes

| Entity | Prefix |
|--------|--------|
| Accounts | acc_ |
| Contacts | con_ |
| Opportunities | opp_ |
| Members | mem_ |
| Field definitions | ad_ |
| Relationship definitions | rd_ |
| Select options | opt_ |
| Attribute values | av_ |
| Relationship values | rv_ |

---

## List Endpoints (Pagination & Filtering)

### Pagination

| Parameter | Description |
|-----------|-------------|
| `offset` | Number of records to skip |
| `limit` | Max records to return (1-25, default 25) |

When returned records < limit, no more records exist. Do not store specific limit/offset values; results become stale.

Data comes from a search index (may not reflect most recent changes). Use Retrieve for current records.

### Filtering Syntax

Format: `$fieldName[operator]=value` (URL-encoded via `--data-urlencode`)

**Operators by data type:**

| Data Type | equal | Comparison (lt/gt/lte/gte) | startsWith | contains |
|-----------|-------|---------------------------|-----------|----------|
| NUMBER, CURRENCY, DATETIME | yes | yes | no | no |
| TEXT, FULL_NAME, SOCIAL_HANDLE, ADDRESS | yes | no | yes | no |
| CHECKBOX, SINGLE_SELECT | yes | no | no | no |
| EMAIL, TELEPHONE, URL | no | no | no | yes |
| MULTI_SELECT, MARKDOWN | Not supported | | | |

**Negation:** Prefix operator with `-` (e.g., `-equal`)

**Default operator:** `equal` or `contains` depending on type.

### Filter Examples

```
# Exact name match
$name[equals]=lightfield

# Email contains
$email[contains]=example@lightfield.app

# Multiple filters (AND logic)
$headcount[equal]=10001+&icp-score[lessThan]=6

# Date range
$lastInteractionAt[greaterThanOrEqual]=2026-03-01T00:00:00.000Z

# Complex query
$doNotContact[equal]=false&$instagram[startsWith]=&$title[startsWith]=Chief&$name[-equal]=Alice Bob
```

Empty string on `startsWith` finds records where field is set but not empty.

Relationship filtering is NOT yet supported.

---

## Auth Resource

### Validate API Key
```
GET /v1/auth/validate
```

**Scope:** None required
**Rate Limit:** Read

**Response (AuthValidateResponse):**
```json
{
  "active": true,
  "scopes": ["accounts:read", "contacts:create"],
  "subjectType": "user",
  "tokenType": "api_key"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `active` | boolean | Always true on success |
| `scopes` | string[] | Granted scopes (empty = full access) |
| `subjectType` | string | "user" or "workspace" |
| `tokenType` | string | Always "api_key" |

---

## Account Resource

### Get Account Field Definitions
```
GET /v1/accounts/definitions
Scope: accounts:read | Rate Limit: Read
```

**Response (AccountDefinitionsResponse):**
- `fieldDefinitions`: Map of field keys to definition objects
- `objectType`: "account"
- `relationshipDefinitions`: Map of relationship keys to definition objects

### Create Account
```
POST /v1/accounts
Scope: accounts:create | Rate Limit: Write | Idempotency: Yes
```

**Request Body:**
```json
{
  "fields": {
    "$name": "Acme Corp",
    "$website": ["https://acme.com"],
    "$facebook": "acmecorp",
    "$headcount": "10001+",
    "$industry": ["Technology", "SaaS"],
    "$instagram": "acmecorp",
    "$lastFundingType": "Series B",
    "$linkedIn": "acme-corp",
    "$twitter": "acmecorp",
    "$primaryAddress": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "postalCode": "94105",
      "country": "US"
    },
    "custom-field-slug": "custom value"
  },
  "relationships": {
    "$contact": "con_abc123",
    "$owner": ["mem_xyz789"],
    "custom-rel": "acc_other"
  }
}
```

**Required:** `$name`
**Read-only fields:** `$howTheyMakeMoney`, `$accountStatus`
**Read-only relationships:** `$opportunity`, `$task`, `$note`
**Note:** Providing `$website` triggers automatic background enrichment.
**Anti-dupe:** Use find-or-create pattern (list filter before create).

**Response (AccountCreateResponse):**
```json
{
  "id": "acc_abc123",
  "createdAt": "2026-05-04T10:00:00.000Z",
  "updatedAt": null,
  "externalId": null,
  "httpLink": "https://crm.lightfield.app/crm/accounts/acc_abc123",
  "fields": {
    "$name": { "value": "Acme Corp", "valueType": "TEXT" },
    "$website": { "value": ["https://acme.com"], "valueType": "URL" }
  },
  "relationships": {
    "$contact": { "cardinality": "has_many", "objectType": "contact", "values": ["con_abc123"] },
    "$owner": { "cardinality": "has_many", "objectType": "member", "values": ["mem_xyz789"] }
  }
}
```

### Update Account
```
POST /v1/accounts/{id}
Scope: accounts:update | Rate Limit: Write | Idempotency: Yes
```

**Path Parameters:** `id` (string) - Account ID

**Request Body:** Same field structure as Create (only included fields modified).

**Relationship Operations:**
```json
{
  "relationships": {
    "$contact": {
      "add": "con_new",
      "remove": "con_old",
      "replace": ["con_only_these"]
    }
  }
}
```

Each relationship supports `add`, `remove`, or `replace` (string or string[]).

### Retrieve Account
```
GET /v1/accounts/{id}
Scope: accounts:read | Rate Limit: Read
```

**Path Parameters:** `id` (string)
**Response:** AccountRetrieveResponse (same structure as create response)

### List Accounts
```
GET /v1/accounts
Scope: accounts:read | Rate Limit: Search
```

**Query Parameters:**
- `limit` (number, default 25, max 25)
- `offset` (number, default 0)
- Filter parameters: `$fieldName[operator]=value`

**Response (AccountListResponse):**
```json
{
  "object": "list",
  "totalCount": 42,
  "data": [ /* array of account objects */ ]
}
```

### Example cURL
```bash
curl "https://api.lightfield.app/v1/accounts?limit=1" \
  -H "Authorization: Bearer sk_lf_..." \
  -H "Lightfield-Version: 2026-03-01"
```

---

## Contact Resource

### Get Contact Definitions
```
GET /v1/contacts/definitions
Scope: contacts:read | Rate Limit: Read
```

Response: ContactDefinitionsResponse (same structure as account definitions)

### Create Contact
```
POST /v1/contacts
Scope: contacts:create | Rate Limit: Write | Idempotency: Yes
```

**Request Body:**
```json
{
  "fields": {
    "$email": ["alice@example.com", "alice@company.com"],
    "$name": { "firstName": "Alice", "lastName": "Smith" },
    "$profilePhotoUrl": "https://example.com/photo.jpg",
    "custom-field": "value"
  },
  "relationships": {
    "$account": "acc_abc123"
  }
}
```

**Notes:**
- `$email` is multi-value (array of strings)
- `$name` is a FullName object with firstName/lastName
- Triggers automatic background enrichment
- Use find-or-create pattern to avoid duplicates

### Update Contact
```
POST /v1/contacts/{id}
Scope: contacts:update | Rate Limit: Write | Idempotency: Yes
```

**Relationship Operations:** Same add/remove/replace pattern as accounts.

### Retrieve Contact
```
GET /v1/contacts/{id}
Scope: contacts:read | Rate Limit: Read
```

### List Contacts
```
GET /v1/contacts
Scope: contacts:read | Rate Limit: Search
```

Query parameters: `limit`, `offset`, filter parameters.

---

## Opportunity Resource

### Get Opportunity Definitions
```
GET /v1/opportunities/definitions
Scope: opportunities:read | Rate Limit: Read
```

### Create Opportunity
```
POST /v1/opportunities
Scope: opportunities:create | Rate Limit: Write | Idempotency: Yes
```

**Request Body:**
```json
{
  "fields": {
    "$name": "Enterprise Deal",
    "$stage": "opt_stage_id_or_label"
  },
  "relationships": {
    "$account": "acc_abc123",
    "$champion": "con_xyz",
    "$createdBy": "mem_abc",
    "$evaluator": "con_eval",
    "$owner": "mem_owner"
  }
}
```

**Required Fields:** `$name`, `$stage`
**Required Relationships:** `$account`
**Optional Relationships:** `$champion`, `$createdBy`, `$evaluator`, `$owner`
**Read-only:** `$opportunityStatus`
**Note:** System auto-generates opportunity summary in background.

### Update Opportunity
```
POST /v1/opportunities/{id}
Scope: opportunities:update | Rate Limit: Write | Idempotency: Yes
```

**Writable fields:** `$name`, `$stage`, custom fields
**Read-only fields:** `$opportunityStatus`
**Read-only relationships:** `$task`, `$note`
**Writable relationships:** `$champion`, `$evaluator`, `$owner` (add/remove/replace)

### Retrieve Opportunity
```
GET /v1/opportunities/{id}
Scope: opportunities:read | Rate Limit: Read
```

### List Opportunities
```
GET /v1/opportunities
Scope: opportunities:read | Rate Limit: Search
```

---

## Task Resource

### Get Task Definitions
```
GET /v1/tasks/definitions
Scope: tasks:read | Rate Limit: Read
```

### Create Task
```
POST /v1/tasks
Scope: tasks:create | Rate Limit: Write | Idempotency: Yes
```

**Request Body:**
```json
{
  "fields": {
    "$title": "Follow up with prospect",
    "$status": "TODO",
    "$description": "## Meeting Notes\n\nDiscuss pricing.",
    "$dueAt": "2026-05-10T09:00:00.000Z"
  },
  "relationships": {
    "$assignedTo": "mem_abc123",
    "$account": "acc_xyz",
    "$opportunity": "opp_deal",
    "$createdBy": "mem_creator"
  }
}
```

**Required Fields:** `$title`, `$status`
**Required Relationships:** `$assignedTo`
**Status Values:** `TODO`, `IN_PROGRESS`, `COMPLETE`, `CANCELLED`
**Description:** Markdown formatted
**Optional Relationships:** `$account`, `$opportunity`, `$createdBy` (defaults to API key owner)

### Update Task
```
POST /v1/tasks/{id}
Scope: tasks:update | Rate Limit: Write | Idempotency: Yes
```

**Writable Fields:** `$title`, `$status`, `$description`, `$dueAt`
**Relationship Operations:** `$account`, `$assignedTo`, `$opportunity` — add/remove/replace

### Retrieve Task
```
GET /v1/tasks/{id}
Scope: tasks:read | Rate Limit: Read
```

### List Tasks
```
GET /v1/tasks
Scope: tasks:read | Rate Limit: Search
```

---

## Note Resource

**No definitions endpoint for notes.**

### Create Note
```
POST /v1/notes
Scope: notes:create | Rate Limit: Write
```

**Request Body:**
```json
{
  "fields": {
    "$title": "Call Summary",
    "$content": "## Key Points\n\n- Budget approved\n- Timeline Q3"
  },
  "relationships": {
    "$account": "acc_abc123",
    "$opportunity": "opp_deal"
  }
}
```

**Required Fields:** `$title`
**Optional Fields:** `$content` (markdown)
**Optional Relationships:** `$account`, `$opportunity`
**Note:** Author automatically set to API key owner.

### Update Note
```
POST /v1/notes/{id}
Scope: notes:update | Rate Limit: Write
```

**Writable Fields:** `$title`, `$content`
**Relationship Operations:** `$account`, `$opportunity` — add/remove only (no replace)

### Retrieve Note
```
GET /v1/notes/{id}
Scope: notes:read | Rate Limit: Read
```

### List Notes
```
GET /v1/notes
Scope: notes:read | Rate Limit: Search
```

---

## Meeting Resource

### Create Meeting
```
POST /v1/meetings
Scope: meetings:create | Rate Limit: Write | Idempotency: Yes
```

**IMPORTANT: Only supports creation of meetings in the PAST.**

**Request Body:**
```json
{
  "fields": {
    "$title": "Discovery Call",
    "$startDate": "2026-05-03T14:00:00.000Z",
    "$endDate": "2026-05-03T14:30:00.000Z",
    "$description": "Initial discovery with prospect",
    "$attendeeEmails": ["prospect@company.com", "alice@ourco.com"],
    "$organizerEmail": "alice@ourco.com",
    "$meetingUrl": "https://meet.google.com/abc-def-ghi",
    "$privacySetting": "FULL"
  },
  "autoCreateRecords": true,
  "relationships": {
    "$transcript": "file_transcript_id"
  }
}
```

**Required Fields:** `$title`, `$startDate`, `$endDate` (all in past, ISO 8601)
**Optional Fields:** `$description`, `$attendeeEmails`, `$organizerEmail`, `$meetingUrl`, `$privacySetting`
**Privacy Settings:** `FULL` or `METADATA`
**`autoCreateRecords`:** Boolean; auto-creates account/contact records for external attendees
**Transcript:** Only one file per meeting

**Response includes:**
- `accessLevel`: `FULL` or `METADATA` (caller's resolved access)
- `objectType`: Always `"meeting"`

### Update Meeting
```
POST /v1/meetings/{id}
Scope: meetings:update | Rate Limit: Write | Idempotency: Yes
```

**Writable fields:** `$privacySetting` only
**Writable relationships:** `$transcript` (replace only)

### Retrieve Meeting
```
GET /v1/meetings/{id}
Scope: meetings:read | Rate Limit: Read
```

Fields and transcript visibility are redacted based on caller-specific privacy resolution.

**Response includes:** `accessLevel` (FULL or METADATA)

### List Meetings
```
GET /v1/meetings
Scope: meetings:read | Rate Limit: Search
```

Privacy filtering applied per caller.

---

## List Resource

### Create List
```
POST /v1/lists
Scope: lists:create | Rate Limit: Write | Idempotency: Yes
```

**Request Body:**
```json
{
  "fields": {
    "$name": "Enterprise Targets",
    "$objectType": "account"
  },
  "relationships": {
    "$accounts": ["acc_123", "acc_456"]
  }
}
```

**Required Fields:** `$name`, `$objectType`
**Object Type Values:** `account`, `contact`, `opportunity`
**Relationships (match objectType):**
- `$accounts` (for account lists)
- `$contacts` (for contact lists)
- `$opportunities` (for opportunity lists)

### Update List
```
POST /v1/lists/{id}
Scope: lists:update | Rate Limit: Write | Idempotency: Yes
```

**Writable Fields:** `$name`
**Relationship Operations:** `$accounts`, `$contacts`, or `$opportunities` — add/remove

### Retrieve List
```
GET /v1/lists/{id}
Scope: lists:read | Rate Limit: Read
```

**Response:** `id`, `createdAt`, `fields`, `httpLink` (no relationships in response)

### List All Lists
```
GET /v1/lists
Scope: lists:read | Rate Limit: Search
```

### List Accounts in a List
```
GET /v1/lists/{listId}/accounts
Scopes: lists:read + accounts:read | Rate Limit: Search
```

Returns paginated account objects belonging to the list.

### List Contacts in a List
```
GET /v1/lists/{listId}/contacts
Scopes: lists:read + contacts:read | Rate Limit: Search
```

### List Opportunities in a List
```
GET /v1/lists/{listId}/opportunities
Scopes: lists:read + opportunities:read | Rate Limit: Search
```

---

## File Resource

### Create Upload Session
```
POST /v1/files
Scope: files:create | Rate Limit: Write
```

**Request Body:**
```json
{
  "filename": "meeting-transcript.txt",
  "mimeType": "text/plain",
  "sizeBytes": 4096,
  "purpose": "meeting_transcript"
}
```

**Required:** `filename`, `mimeType`, `sizeBytes`
**Max File Size:** 512 MB
**Purpose Values (optional):**
- `meeting_transcript` — attach as meeting transcript
- `knowledge_user` — add to authenticated user's Knowledge
- `knowledge_workspace` — add to workspace Knowledge

**Response (FileCreateResponse):**
```json
{
  "id": "file_abc123",
  "status": "PENDING",
  "uploadUrl": "https://storage.example.com/upload/...",
  "uploadHeaders": { "Content-Type": "text/plain" },
  "filename": "meeting-transcript.txt",
  "mimeType": "text/plain",
  "sizeBytes": 4096,
  "createdAt": "2026-05-04T10:00:00.000Z",
  "completedAt": null,
  "expiresAt": "2026-05-04T11:00:00.000Z"
}
```

**Upload Flow:**
1. Create upload session (this endpoint)
2. PUT file bytes to `uploadUrl` with `uploadHeaders`
3. Complete upload via `POST /v1/files/{id}/complete`

### Complete Upload
```
POST /v1/files/{id}/complete
Scope: files:create | Rate Limit: Write
```

**Request Body (optional):**
```json
{
  "md5": "d41d8cd98f00b204e9800998ecf8427e"
}
```

MD5 hex digest for optional checksum validation.

**Response:** File object with `status: "COMPLETED"`

### Retrieve File
```
GET /v1/files/{id}
Scope: files:read | Rate Limit: Read
```

**File Status Values:** `PENDING`, `COMPLETED`, `CANCELLED`, `EXPIRED`

### List Files
```
GET /v1/files
Scope: files:read | Rate Limit: Search
```

### Get Download URL
```
GET /v1/files/{id}/url
Scope: files:read | Rate Limit: Read
```

Only available for files with `COMPLETED` status.

**Response:**
```json
{
  "url": "https://storage.example.com/download/...",
  "expiresAt": "2026-05-04T11:00:00.000Z"
}
```

### Cancel Upload
```
POST /v1/files/{id}/cancel
Scope: files:create | Rate Limit: Write
```

Only files with `PENDING` status can be cancelled. Transitions to `CANCELLED`.

---

## Member Resource

Read-only. No create/update/delete endpoints.

### Retrieve Member
```
GET /v1/members/{id}
Scope: members:read | Rate Limit: Read
```

**Response fields:**
- `$email`: Member email
- `$name`: FullName object
- `$profileImage`: Profile photo URL
- `$role`: Member role

### List Members
```
GET /v1/members
Scope: members:read | Rate Limit: Search
```

---

## MCP Server

**Server URL:** `https://mcp.lightfield.app/mcp`
**Transport:** Streamable HTTP with OAuth 2.1 authentication

### Setup for Claude Web/Desktop (claude.ai)

1. **Org Owner:** Settings > Connectors > Add custom connector > URL: `https://mcp.lightfield.app/mcp`
2. **Members:** Settings > Connectors > Find Lightfield > Connect > Complete OAuth

### Setup for Claude Code

```bash
claude mcp add --transport http lightfield https://mcp.lightfield.app/mcp
```

Then run `/mcp` in Claude Code, select lightfield, complete OAuth.

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `get_current_user` | Get user identity (name, email, role) |
| `search_lightfield_api_docs` | Browse API endpoints and resources |
| `get_lightfield_api_details` | Get detailed endpoint documentation |
| `read_from_lightfield` | Retrieve workspace data |
| `write_to_lightfield` | Create or modify workspace records |

### Compatible Clients
Any MCP client supporting Streamable HTTP with OAuth 2.1.

---

## SDKs & CLI

### Python SDK

```bash
pip install lightfield
```

```python
from lightfield import Lightfield

client = Lightfield(api_key="sk_lf_...")
accounts = client.account.list(limit=1)

# Resource pattern: client.{resource}.{method}(params)
# Typed exceptions:
#   lightfield.AuthenticationError (401)
#   lightfield.PermissionDeniedError (403)
```

### TypeScript SDK

```bash
npm install lightfield
```

```typescript
import Lightfield from "lightfield";

const client = new Lightfield({ apiKey: "sk_lf_..." });
const accounts = await client.account.list({ limit: 1 });

// Typed exceptions:
//   Lightfield.AuthenticationError (401)
//   Lightfield.PermissionDeniedError (403)
```

Run with: `npx tsx quickstart.ts`

### Go SDK

Requires Go 1.22+.

```bash
go get -u github.com/Lightfld/lightfield-go
```

```go
import (
  "github.com/Lightfld/lightfield-go"
  "github.com/Lightfld/lightfield-go/option"
)

client := githubcomlightfldlightfieldgo.NewClient(
  option.WithAPIKey("sk_lf_..."),
)
accounts, err := client.Account.List(context.TODO(), githubcomlightfldlightfieldgo.AccountListParams{
  Limit: githubcomlightfldlightfieldgo.Int(1),
})

// Typed errors via errors.As with *githubcomlightfldlightfieldgo.Error
```

### CLI

**Install (macOS Homebrew):**
```bash
brew install Lightfld/lightfield/lightfield
```

**Install (Go):**
```bash
go install github.com/Lightfld/lightfield-cli/cmd/lightfield@latest
```

**Set API key:**
```bash
export LIGHTFIELD_API_KEY="sk_lf_..."
```

**Command format:** `lightfield [resource] [command] [flags]`

**Examples:**
```bash
# List accounts
lightfield account list --limit 1

# Create account
lightfield account create --fields '{"$name": "Acme Corp", "$website": ["https://acme.com"]}'

# Debug mode with JSON output
lightfield account list --limit 1 --debug --format json
```

**Global Flags:**

| Flag | Purpose |
|------|---------|
| `--api-key` | API key (overrides env var) |
| `--base-url` | Custom API base URL |
| `--format` | Output: auto, json, jsonl, pretty, raw, yaml |
| `--debug` | Debug logging with HTTP details |
| `--help` | Show help |

**Limitation:** CLI lacks list filtering; use HTTP API or SDKs for filters.

---

## Workflows

### Overview
Workflows replace brittle conditional automation logic with AI agent steps. Each workflow has one trigger followed by sequential steps.

### Trigger Types

#### Webhook Trigger
- Accepts HTTP POST from external services
- Full JSON body available to downstream steps
- Generated URL per workflow

#### Object Lifecycle Trigger
- Fires on create or update of: Contact, Account, Opportunity, Meeting, Task, Note
- Field-level watching for update triggers
- Output includes full object + `_diff` (before/after for updates)
- `{{trigger._diff.fieldName.before}}` / `{{trigger._diff.fieldName.after}}`

#### Scheduled Trigger
- Daily (by time), Weekly (by day+time), Monthly (by day+time), Advanced (cron)
- IANA timezone-aware with DST handling

#### Manual Trigger
- Click "Run" in UI
- Optional JSON payload input

### Step Types

#### Object Operations
- Create contact/account/opportunity/task/note
- Create or update contact/account (upsert)
- Find object (with filter operators: IS, IS_NOT, CONTAINS, DOES_NOT_CONTAIN, IS_ANY_OF, IS_NONE_OF, comparison operators)

#### HTTP Request
- Methods: GET, POST, PUT, PATCH, DELETE
- Custom headers and JSON body with template variables
- Response available: `{{step.statusCode}}`, `{{step.body.field}}`, `{{step.headers.header}}`
- SSRF protection: only public HTTPS endpoints

#### Agent Request (Claude-powered)
- Prompt-driven AI step with MCP tool access
- Enableable capabilities: entity creation, entity updates, code execution (Python/bash sandboxed), web search
- Always available: record access, search, list, task & note management
- Connected MCP servers: Granola, Salesforce, Slack, Airtable

#### Sleep Action
- Pause for specified duration (ms, s, min, h, days)

#### Log Action
- Record messages with resolved template variables

### Data Flow

**Execution Context:**
- `input`: Trigger payload
- `output`: Map of step outputs keyed by step ID

**Template Syntax:**
- `{{nodeId}}` — entire step output
- `{{nodeId.field}}` — specific field
- `{{nodeId.nested.field}}` — nested access
- `{{trigger.field}}` — trigger output
- `{{trigger._diff.fieldName.before}}` / `.after`

**Execution Order:** Sequential. Each step awaits previous completion. Step failure skips subsequent steps and marks workflow failed.

### Workflow Lifecycle

| Status | Description |
|--------|-------------|
| Draft | Under editing; triggers inactive |
| Active | Published; triggers fire; edits create new versions |
| Deactivated | Paused; triggers stop; reactivation available |

Immutable version snapshots. Running executions pinned to start version.

### Execution Engine

- Durable execution engine for millions of events/day
- Slow work (external calls, AI) separated from fast work (state, scheduling)
- Step timeout: 60s for AI, 30s for external API calls

### Reliability Guarantees

- **Event preservation:** Trigger events captured atomically
- **No duplication:** Scoped idempotency keys on every event and write
- **Concurrent safety:** Compare-and-swap concurrency control
- **Active editing:** Immutable version snapshots; running executions pinned
- **Auto-recovery:** Transient failures (502/503/504) retry with exponential backoff

### Error Handling

- **Transient** (timeouts, 502/503/504): Auto-retry with exponential backoff
- **Permanent** (config errors, template errors): Immediate termination, skip subsequent steps
- Structured error codes with metadata

### Observability

- Trace ID per execution spanning full lifecycle
- Step-level events with timestamps and metadata

---

## Workflow Recipes

### 1. Stripe Webhook Ingestion
**Pattern:** Webhook in -> AI interprets -> record writes
Processes Stripe webhooks through AI agent to create/update Contacts, Accounts, Opportunities.

### 2. Kondo LinkedIn DM Sync
**Pattern:** Webhook in -> AI interprets -> contact enrichment
Ingests LinkedIn DMs from Kondo, fuzzy-matches contacts, creates notes, identifies buying signals.

### 3. Daily Granola Meeting Digest
**Pattern:** Scheduled -> AI with MCP tools -> record enrichment
Daily pull of Granola meeting notes via MCP, extracts attendees, creates notes/tasks, updates opportunities.

### 4. Granola Transcript Sync
**Pattern:** Scheduled -> AI with Granola MCP -> transcript upsert
Matches Granola meetings to CRM meetings by attendee email, title, time; syncs transcripts.

### 5. Record Created -> External Sync
**Pattern:** Object lifecycle -> HTTP request out
Pushes new opportunities to external systems. Variants: Slack notifications, multi-system routing, AI-based conditional routing.

---

## Complete Endpoint Reference Table

| Method | Path | Scope | Rate Limit | Idempotent |
|--------|------|-------|-----------|------------|
| GET | /v1/auth/validate | none | Read | N/A |
| GET | /v1/accounts/definitions | accounts:read | Read | N/A |
| POST | /v1/accounts | accounts:create | Write | Yes |
| POST | /v1/accounts/{id} | accounts:update | Write | Yes |
| GET | /v1/accounts/{id} | accounts:read | Read | N/A |
| GET | /v1/accounts | accounts:read | Search | N/A |
| GET | /v1/contacts/definitions | contacts:read | Read | N/A |
| POST | /v1/contacts | contacts:create | Write | Yes |
| POST | /v1/contacts/{id} | contacts:update | Write | Yes |
| GET | /v1/contacts/{id} | contacts:read | Read | N/A |
| GET | /v1/contacts | contacts:read | Search | N/A |
| GET | /v1/opportunities/definitions | opportunities:read | Read | N/A |
| POST | /v1/opportunities | opportunities:create | Write | Yes |
| POST | /v1/opportunities/{id} | opportunities:update | Write | Yes |
| GET | /v1/opportunities/{id} | opportunities:read | Read | N/A |
| GET | /v1/opportunities | opportunities:read | Search | N/A |
| GET | /v1/tasks/definitions | tasks:read | Read | N/A |
| POST | /v1/tasks | tasks:create | Write | Yes |
| POST | /v1/tasks/{id} | tasks:update | Write | Yes |
| GET | /v1/tasks/{id} | tasks:read | Read | N/A |
| GET | /v1/tasks | tasks:read | Search | N/A |
| POST | /v1/notes | notes:create | Write | N/A |
| POST | /v1/notes/{id} | notes:update | Write | N/A |
| GET | /v1/notes/{id} | notes:read | Read | N/A |
| GET | /v1/notes | notes:read | Search | N/A |
| POST | /v1/meetings | meetings:create | Write | Yes |
| POST | /v1/meetings/{id} | meetings:update | Write | Yes |
| GET | /v1/meetings/{id} | meetings:read | Read | N/A |
| GET | /v1/meetings | meetings:read | Search | N/A |
| POST | /v1/lists | lists:create | Write | Yes |
| POST | /v1/lists/{id} | lists:update | Write | Yes |
| GET | /v1/lists/{id} | lists:read | Read | N/A |
| GET | /v1/lists | lists:read | Search | N/A |
| GET | /v1/lists/{listId}/accounts | lists:read + accounts:read | Search | N/A |
| GET | /v1/lists/{listId}/contacts | lists:read + contacts:read | Search | N/A |
| GET | /v1/lists/{listId}/opportunities | lists:read + opportunities:read | Search | N/A |
| POST | /v1/files | files:create | Write | N/A |
| POST | /v1/files/{id}/complete | files:create | Write | N/A |
| POST | /v1/files/{id}/cancel | files:create | Write | N/A |
| GET | /v1/files/{id} | files:read | Read | N/A |
| GET | /v1/files | files:read | Search | N/A |
| GET | /v1/files/{id}/url | files:read | Read | N/A |
| GET | /v1/members/{id} | members:read | Read | N/A |
| GET | /v1/members | members:read | Search | N/A |

**Total: 44 endpoints across 9 resources + auth**

---

## What Is NOT Documented

Based on thorough crawling of docs.lightfield.app:

1. **No webhook/event subscription API** — Lightfield does not expose webhook registration via API. Webhooks are configured within Workflows only.
2. **No activity/audit log API** — No endpoints for reading activity feeds or audit logs.
3. **No custom field CRUD API** — Custom fields appear to be managed via the UI only; the API reads definitions but cannot create/modify field schemas.
4. **No delete endpoints** — No DELETE method documented for any resource.
5. **No API versioning page** — The version `2026-03-01` is referenced everywhere but no versioning policy page exists.
6. **No workflow run API** — While mentioned in navigation, the workflow-run resource returned 404 (may not be publicly documented yet).
7. **No bulk operations API** — No batch create/update endpoints documented.
8. **No search/query endpoint** — Full-text search appears to be via list filtering only.
