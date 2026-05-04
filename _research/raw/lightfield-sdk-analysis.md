# Lightfield SDK Analysis (v0.6.0-alpha)

Package: `lightfield@0.6.0-alpha`
Generated from OpenAPI spec by Stainless
Repository: github:Lightfld/lightfield-typescript
License: Apache-2.0
API Version Header: `Lightfield-Version: 2026-03-01`

---

## 1. Client Configuration

### ClientOptions
```ts
interface ClientOptions {
  apiKey: string;                                    // REQUIRED
  baseURL?: string | null;                           // Default: process.env['LIGHTFIELD_BASE_URL'] ?? 'https://api.lightfield.app'
  timeout?: number;                                  // Default: 60000 (1 minute)
  fetchOptions?: MergedRequestInit;                  // Additional fetch() options
  fetch?: Fetch;                                     // Custom fetch implementation
  maxRetries?: number;                               // Default: 2
  defaultHeaders?: HeadersLike;
  defaultQuery?: Record<string, string | undefined>;
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'off';  // Default: 'warn'
  logger?: Logger;                                   // Default: globalThis.console
}
```

### Authentication
- Bearer token: `Authorization: Bearer ${apiKey}`
- Environment variable: `LIGHTFIELD_BASE_URL` for base URL override
- Environment variable: `LIGHTFIELD_LOG` for log level

### Default Headers Sent
- `Accept: application/json`
- `User-Agent: Lightfield/JS ${VERSION}`
- `Lightfield-Version: 2026-03-01`
- `X-Stainless-Retry-Count: N`
- `X-Stainless-Timeout: N` (seconds)
- Platform headers (OS, arch, runtime)

---

## 2. Resource Classes (API Client Methods)

### 2.1 Account (`client.account`)
"Accounts represent companies or organizations in Lightfield."

| Method | HTTP | Endpoint | Scope | Rate Category |
|--------|------|----------|-------|---------------|
| `create(body)` | POST | `/v1/accounts` | `accounts:create` | Write |
| `retrieve(id)` | GET | `/v1/accounts/${id}` | `accounts:read` | Read |
| `update(id, body)` | POST | `/v1/accounts/${id}` | `accounts:update` | Write |
| `list(query?)` | GET | `/v1/accounts` | `accounts:read` | Search |
| `definitions()` | GET | `/v1/accounts/definitions` | `accounts:read` | Read |

**Create behavior:**
- `$name` required
- `$website` triggers background enrichment
- `$howTheyMakeMoney`, `$accountStatus` are READ-ONLY
- `$opportunity`, `$task`, `$note` relationships are READ-ONLY
- Supports `Idempotency-Key` header

**Known system fields (from README examples):**
- `$name` (string) - required
- `$website` (URL array)
- `$industry` (MULTI_SELECT - option IDs)
- `$headcount` (SINGLE_SELECT - option ID)
- `$linkedIn` (SOCIAL_HANDLE)
- `$primaryAddress` (ADDRESS)
- `$howTheyMakeMoney` (read-only)
- `$accountStatus` (read-only)

### 2.2 Contact (`client.contact`)
"Contacts represent individual people in Lightfield."

| Method | HTTP | Endpoint | Scope | Rate Category |
|--------|------|----------|-------|---------------|
| `create(body)` | POST | `/v1/contacts` | `contacts:create` | Write |
| `retrieve(id)` | GET | `/v1/contacts/${id}` | `contacts:read` | Read |
| `update(id, body)` | POST | `/v1/contacts/${id}` | `contacts:update` | Write |
| `list(query?)` | GET | `/v1/contacts` | `contacts:read` | Search |
| `definitions()` | GET | `/v1/contacts/definitions` | `contacts:read` | Read |

**Create behavior:**
- Auto-enriches in background after creation
- `$name` is `{ firstName, lastName }` (FULL_NAME), NOT a plain string
- `$email` (EMAIL)
- `$account` relationship available
- Supports `Idempotency-Key` header

### 2.3 Opportunity (`client.opportunity`)
"Opportunities represent potential deals or sales in Lightfield."

| Method | HTTP | Endpoint | Scope | Rate Category |
|--------|------|----------|-------|---------------|
| `create(body)` | POST | `/v1/opportunities` | `opportunities:create` | Write |
| `retrieve(id)` | GET | `/v1/opportunities/${id}` | `opportunities:read` | Read |
| `update(id, body)` | POST | `/v1/opportunities/${id}` | `opportunities:update` | Write |
| `list(query?)` | GET | `/v1/opportunities` | `opportunities:read` | Search |
| `definitions()` | GET | `/v1/opportunities/definitions` | `opportunities:read` | Read |

**Create behavior:**
- `$name` (string) AND `$stage` (SINGLE_SELECT) AND `$account` relationship ALL REQUIRED
- Auto-generates opportunity summary in background
- `$opportunityStatus` is READ-ONLY
- `$task`, `$note` relationships are READ-ONLY
- Supports `Idempotency-Key` header

**Known system fields:**
- `$name` (string) - required
- `$stage` (SINGLE_SELECT, option ID or label) - required
- `$opportunityStatus` (read-only)

**Known relationships:**
- `$account` (required on create)
- `$owner`
- `$champion`

### 2.4 Task (`client.task`)
"Tasks represent action items in Lightfield."

| Method | HTTP | Endpoint | Scope | Rate Category |
|--------|------|----------|-------|---------------|
| `create(body)` | POST | `/v1/tasks` | `tasks:create` | Write |
| `retrieve(id)` | GET | `/v1/tasks/${id}` | `tasks:read` | Read |
| `update(id, body)` | POST | `/v1/tasks/${id}` | `tasks:update` | Write |
| `list(query?)` | GET | `/v1/tasks` | `tasks:read` | Search |
| `definitions()` | GET | `/v1/tasks/definitions` | `tasks:read` | Read |

**Create behavior:**
- `$title` (string) AND `$status` (string) AND `$assignedTo` relationship ALL REQUIRED
- `$createdBy` defaults to authenticated user if omitted
- `$note` relationship is READ-ONLY
- Tasks only support documented system fields (no custom fields)

**System fields (typed explicitly -- no dynamic fields):**
```ts
TaskCreateParams.Fields {
  $title: string;           // REQUIRED
  $status: string;          // REQUIRED: 'TODO' | 'IN_PROGRESS' | 'COMPLETE' | 'CANCELLED'
  $description?: string;    // Markdown
  $dueAt?: string;          // ISO 8601 datetime
}
```

### 2.5 Meeting (`client.meeting`)
"Meetings represent synced or manually created interactions in Lightfield."

| Method | HTTP | Endpoint | Scope | Rate Category |
|--------|------|----------|-------|---------------|
| `create(body)` | POST | `/v1/meetings` | `meetings:create` | Write |
| `retrieve(id)` | GET | `/v1/meetings/${id}` | `meetings:read` | Read |
| `update(id, body)` | POST | `/v1/meetings/${id}` | `meetings:update` | Write |
| `list(query?)` | GET | `/v1/meetings` | `meetings:read` | Search |

**Create behavior:**
- Only past meetings supported (no future meetings)
- `$title`, `$startDate`, `$endDate` ALL REQUIRED
- Only `$transcript` relationship writable on create
- Response is privacy-aware with `accessLevel` field
- `autoCreateRecords` option to auto-create accounts/contacts for external attendees

**System fields (typed explicitly):**
```ts
MeetingCreateParams.Fields {
  $title: string;                                    // REQUIRED
  $startDate: string;                                // REQUIRED, ISO 8601, must be past
  $endDate: string;                                  // REQUIRED, ISO 8601, must be past
  $attendeeEmails?: Array<string>;
  $description?: string;
  $meetingUrl?: string;
  $organizerEmail?: string;                          // single email
  $privacySetting?: 'FULL' | 'METADATA';
}
```

**Update restrictions:**
- Only `fields.$privacySetting` and `relationships.$transcript.replace` writable
- Cannot clear/remove transcript

**Meeting-specific response fields:**
- `accessLevel: 'FULL' | 'METADATA'` (read-only)
- `objectType: 'meeting'` (literal)

### 2.6 Note (`client.note`)
"Notes represent free-form text records in Lightfield."

| Method | HTTP | Endpoint | Scope | Rate Category |
|--------|------|----------|-------|---------------|
| `create(body)` | POST | `/v1/notes` | `notes:create` | Write |
| `retrieve(id)` | GET | `/v1/notes/${id}` | `notes:read` | Read |
| `update(id, body)` | POST | `/v1/notes/${id}` | `notes:update` | Write |
| `list(query?)` | GET | `/v1/notes` | `notes:read` | Search |

**System fields:**
```ts
NoteCreateParams.Fields {
  $title: string;      // REQUIRED
  $content?: string;   // Markdown
}
```

**Relationships on create:**
- `$account` (single ID or array)
- `$opportunity` (single ID or array)
- Author auto-set to API key owner

**Update relationships:**
- `$account` and `$opportunity` support `add` or `remove` operations (no `replace`)

### 2.7 List (`client.list`)
"Lists are curated collections of accounts, contacts, or opportunities."

| Method | HTTP | Endpoint | Scope | Rate Category |
|--------|------|----------|-------|---------------|
| `create(body)` | POST | `/v1/lists` | `lists:create` | Write |
| `retrieve(id)` | GET | `/v1/lists/${id}` | `lists:read` | Read |
| `update(id, body)` | POST | `/v1/lists/${id}` | `lists:update` | Write |
| `list(query?)` | GET | `/v1/lists` | `lists:read` | Search |
| `listAccounts(listID, query?)` | GET | `/v1/lists/${listID}/accounts` | `lists:read` + `accounts:read` | Search |
| `listContacts(listID, query?)` | GET | `/v1/lists/${listID}/contacts` | `lists:read` + `contacts:read` | Search |
| `listOpportunities(listID, query?)` | GET | `/v1/lists/${listID}/opportunities` | `lists:read` + `opportunities:read` | Search |

**Create params:**
```ts
ListCreateParams.Fields {
  $name: string;                                      // REQUIRED
  $objectType: 'account' | 'contact' | 'opportunity'; // REQUIRED
}
// Relationships (discriminated by objectType):
{ $accounts: string | Array<string> }    // for account lists
{ $contacts: string | Array<string> }    // for contact lists
{ $opportunities: string | Array<string> } // for opportunity lists
```

**List response shape (simpler than other entities):**
```ts
{
  id: string;
  createdAt: string;
  fields: { [key: string]: { value, valueType } };
  httpLink: string | null;
  // NOTE: no relationships, no updatedAt, no externalId
}
```

### 2.8 Member (`client.member`)
"Members represent users in your Lightfield workspace."

| Method | HTTP | Endpoint | Scope | Rate Category |
|--------|------|----------|-------|---------------|
| `retrieve(id)` | GET | `/v1/members/${id}` | `members:read` | Read |
| `list(query?)` | GET | `/v1/members` | `members:read` | Search |

**READ-ONLY -- no create/update/delete.**

**Member fields (strongly typed, not dynamic):**
```ts
{
  $email: { value: string; valueType: 'EMAIL' };
  $name: { value: { firstName?: string; lastName?: string }; valueType: 'FULL_NAME' };
  $profileImage: { value: string | null; valueType: 'URL' };
  $role: { value: string; valueType: 'TEXT' };
}
```

### 2.9 WorkflowRun (`client.workflowRun`)
"Workflow runs represent executions of automated workflows."

| Method | HTTP | Endpoint | Scope | Rate Category |
|--------|------|----------|-------|---------------|
| `status(runID)` | GET | `/v1/workflowRun/${runID}/status` | (undocumented) | (undocumented) |

**Response:**
```ts
WorkflowRunStatusResponse {
  status: string;  // 'running' | 'completed' | 'failed' etc.
}
```

### 2.10 File (`client.file`)
"Files are used to upload documents via presigned URLs."

| Method | HTTP | Endpoint | Scope | Rate Category |
|--------|------|----------|-------|---------------|
| `create(body)` | POST | `/v1/files` | `files:create` | Write |
| `retrieve(id)` | GET | `/v1/files/${id}` | `files:read` | Read |
| `list(query?)` | GET | `/v1/files` | `files:read` | Search |
| `cancel(id)` | POST | `/v1/files/${id}/cancel` | `files:create` | Write |
| `complete(id, body)` | POST | `/v1/files/${id}/complete` | `files:create` | Write |
| `url(id)` | GET | `/v1/files/${id}/url` | `files:read` | Read |

**Upload flow:**
1. `create()` --> returns `uploadUrl` + `uploadHeaders`
2. PUT/upload file bytes to `uploadUrl` with `uploadHeaders`
3. `complete()` --> finalizes (optional `md5` hex digest for checksum)

**Create params:**
```ts
FileCreateParams {
  filename: string;           // REQUIRED
  mimeType: string;           // REQUIRED
  sizeBytes: number;          // REQUIRED, max 512 MB
  purpose?: 'meeting_transcript' | 'knowledge_user' | 'knowledge_workspace';
}
```

**File response:**
```ts
{
  id: string;
  completedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  // Only on create:
  uploadHeaders: { [key: string]: string };
  uploadUrl: string;
}
```

**Download URL response:**
```ts
FileURLResponse {
  expiresAt: string;
  url: string;        // temporary download URL
}
```

---

## 3. Shared Type System

### 3.1 Entity Response Shape (Account, Contact, Opportunity, Task, Note)
All CRM entities share this base shape:
```ts
{
  id: string;
  createdAt: string;                                    // ISO 8601
  updatedAt: string | null;                             // ISO 8601
  externalId?: string | null;
  httpLink: string | null;                              // Web app URL
  fields: { [key: string]: FieldValue };
  relationships: { [key: string]: RelationshipValue };
}
```

### 3.2 FieldValue
```ts
interface FieldValue {
  value: string | number | boolean | Array<string> | Address | FullName | null;
  valueType: ValueType;
}
```

### 3.3 ValueType Enum (14 types)
```ts
type ValueType =
  | 'ADDRESS'
  | 'CHECKBOX'
  | 'CURRENCY'
  | 'DATETIME'
  | 'EMAIL'
  | 'FULL_NAME'
  | 'MARKDOWN'
  | 'MULTI_SELECT'
  | 'NUMBER'
  | 'SINGLE_SELECT'
  | 'SOCIAL_HANDLE'
  | 'TELEPHONE'
  | 'TEXT'
  | 'URL';
```

### 3.4 Address
```ts
interface Address {
  street?: string | null;
  street2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;      // ISO 3166-1 alpha-2
  latitude?: number | null;
  longitude?: number | null;
}
```

### 3.5 FullName
```ts
interface FullName {
  firstName?: string | null;
  lastName?: string | null;
}
```

### 3.6 RelationshipValue (on responses)
```ts
interface RelationshipValue {
  cardinality: string;        // 'has_one' | 'has_many'
  objectType: string;         // 'account' | 'contact' | 'opportunity' etc.
  values: Array<string>;      // Entity IDs
}
```

### 3.7 Relationship Operations (on update)
```ts
interface RelationshipOperation {
  add?: string | Array<string>;
  remove?: string | Array<string>;
  replace?: string | Array<string>;
}
```

### 3.8 Definitions Response Shape (Account, Contact, Opportunity, Task)
```ts
{
  objectType: string;
  fieldDefinitions: { [key: string]: FieldDefinition };
  relationshipDefinitions: { [key: string]: RelationshipDefinition };
}
```

### 3.9 FieldDefinition
```ts
interface FieldDefinition {
  id?: string;
  label: string;
  description: string | null;
  valueType: ValueType;
  readOnly?: boolean;           // true for AI-generated fields
  typeConfiguration: {
    currency?: string;          // ISO 4217
    handleService?: 'TWITTER' | 'LINKEDIN' | 'FACEBOOK' | 'INSTAGRAM';
    multipleValues?: boolean;
    unique?: boolean;
    options?: Array<{
      id: string;
      label: string;
      description?: string | null;
    }>;
  };
}
```

### 3.10 RelationshipDefinition
```ts
interface RelationshipDefinition {
  id?: string;
  label: string;
  description: string | null;
  cardinality: 'HAS_ONE' | 'HAS_MANY';
  objectType: string;
}
```

### 3.11 List Response Shape (pagination wrapper)
```ts
interface ListResponse<T> {
  data: Array<T>;
  object: string;           // always "list"
  totalCount: number;
}
```

---

## 4. Pagination

All list endpoints use offset-based pagination:
```ts
interface PaginationParams {
  limit?: number;   // Default: 25, Maximum: 25
  offset?: number;  // Default: 0
}
```

Response includes `totalCount` for computing total pages.
Page size is HARD CAPPED at 25 -- no way to request more per page.

---

## 5. Filtering

List endpoints for accounts, contacts, and opportunities support `$field` query parameters for filtering.
Documented at `/using-the-api/list-endpoints/#filtering` but not explicitly typed in the SDK
(uses generic `query` params).

---

## 6. Rate Limiting

Three rate limit categories referenced:
- **Read** -- single entity retrieval, definitions
- **Write** -- create, update, cancel, complete
- **Search** -- list endpoints

Specific rate limits not documented in SDK. Server returns:
- `429` status code with `RateLimitError`
- `x-should-retry` header (non-standard)
- `retry-after-ms` header (non-standard, milliseconds)
- `retry-after` header (standard, seconds or HTTP date)

---

## 7. Retry Behavior

- Default: 2 retries
- Retried status codes: 408, 409, 429, >= 500
- Retried on connection errors and timeouts
- Exponential backoff: 0.5s initial, 8s max, 25% jitter
- Respects `x-should-retry`, `retry-after-ms`, `retry-after` headers

---

## 8. Error Classes

```ts
LightfieldError extends Error                              // Base
  APIError<TStatus, THeaders, TError> extends LightfieldError
    BadRequestError extends APIError<400>                   // 400
    AuthenticationError extends APIError<401>                // 401
    PermissionDeniedError extends APIError<403>              // 403
    NotFoundError extends APIError<404>                      // 404
    ConflictError extends APIError<409>                      // 409
    UnprocessableEntityError extends APIError<422>           // 422
    RateLimitError extends APIError<429>                     // 429
    InternalServerError extends APIError<number>             // >= 500
    APIUserAbortError extends APIError<undefined>            // User abort
    APIConnectionError extends APIError<undefined>           // Connection failure
      APIConnectionTimeoutError extends APIConnectionError   // Timeout
```

---

## 9. Scopes (Authorization Permissions)

Scopes follow `{resource}:{action}` pattern:
- `accounts:create`, `accounts:read`, `accounts:update`
- `contacts:create`, `contacts:read`, `contacts:update`
- `opportunities:create`, `opportunities:read`, `opportunities:update`
- `tasks:create`, `tasks:read`, `tasks:update`
- `meetings:create`, `meetings:read`, `meetings:update`
- `notes:create`, `notes:read`, `notes:update`
- `lists:create`, `lists:read`, `lists:update`
- `members:read`
- `files:create`, `files:read`

---

## 10. Custom Fields Handling

- System fields prefixed with `$` (e.g., `$name`, `$email`, `$website`)
- Custom attributes use bare slugs (e.g., `tier`, `renewalDate`)
- Dynamic field map: `fields: { [key: string]: value }`
- Custom fields discovered via `definitions()` endpoint
- SINGLE_SELECT and MULTI_SELECT accept option ID or label string
- Each entity type can define its own custom fields and relationships

---

## 11. ID Prefixes (from README examples)

- Accounts: `acc_` (e.g., `acc_cm4stu901uvw234`)
- Contacts: `con_` (e.g., `con_cm2ghi789jkl012`)
- Opportunities: `opp_` (e.g., `opp_cm9uvw890xyz123`)
- Members: `mem_` (e.g., `mem_cm1abc123def456`)
- Options: `opt_` (e.g., `opt_01j0x6q3m9v2p4t7k8n5r1s2u`)

---

## 12. Idempotency

Supported on all write endpoints via `Idempotency-Key` header.
SDK generates default idempotency key: `stainless-node-retry-${uuid4()}`
(applied automatically for non-GET requests when idempotencyHeader is set).

---

## 13. File Upload Purposes

```ts
type FilePurpose = 'meeting_transcript' | 'knowledge_user' | 'knowledge_workspace';
```

- `meeting_transcript`: attach as meeting transcript via `$transcript` relationship
- `knowledge_user`: add to authenticated user's Knowledge base for AI assistant
- `knowledge_workspace`: add to workspace Knowledge base for AI assistant

---

## 14. Complete Endpoint Map

| # | Method | HTTP Verb | Path | Rate |
|---|--------|-----------|------|------|
| 1 | account.create | POST | /v1/accounts | Write |
| 2 | account.retrieve | GET | /v1/accounts/{id} | Read |
| 3 | account.update | POST | /v1/accounts/{id} | Write |
| 4 | account.list | GET | /v1/accounts | Search |
| 5 | account.definitions | GET | /v1/accounts/definitions | Read |
| 6 | contact.create | POST | /v1/contacts | Write |
| 7 | contact.retrieve | GET | /v1/contacts/{id} | Read |
| 8 | contact.update | POST | /v1/contacts/{id} | Write |
| 9 | contact.list | GET | /v1/contacts | Search |
| 10 | contact.definitions | GET | /v1/contacts/definitions | Read |
| 11 | opportunity.create | POST | /v1/opportunities | Write |
| 12 | opportunity.retrieve | GET | /v1/opportunities/{id} | Read |
| 13 | opportunity.update | POST | /v1/opportunities/{id} | Write |
| 14 | opportunity.list | GET | /v1/opportunities | Search |
| 15 | opportunity.definitions | GET | /v1/opportunities/definitions | Read |
| 16 | task.create | POST | /v1/tasks | Write |
| 17 | task.retrieve | GET | /v1/tasks/{id} | Read |
| 18 | task.update | POST | /v1/tasks/{id} | Write |
| 19 | task.list | GET | /v1/tasks | Search |
| 20 | task.definitions | GET | /v1/tasks/definitions | Read |
| 21 | meeting.create | POST | /v1/meetings | Write |
| 22 | meeting.retrieve | GET | /v1/meetings/{id} | Read |
| 23 | meeting.update | POST | /v1/meetings/{id} | Write |
| 24 | meeting.list | GET | /v1/meetings | Search |
| 25 | note.create | POST | /v1/notes | Write |
| 26 | note.retrieve | GET | /v1/notes/{id} | Read |
| 27 | note.update | POST | /v1/notes/{id} | Write |
| 28 | note.list | GET | /v1/notes | Search |
| 29 | list.create | POST | /v1/lists | Write |
| 30 | list.retrieve | GET | /v1/lists/{id} | Read |
| 31 | list.update | POST | /v1/lists/{id} | Write |
| 32 | list.list | GET | /v1/lists | Search |
| 33 | list.listAccounts | GET | /v1/lists/{listID}/accounts | Search |
| 34 | list.listContacts | GET | /v1/lists/{listID}/contacts | Search |
| 35 | list.listOpportunities | GET | /v1/lists/{listID}/opportunities | Search |
| 36 | member.retrieve | GET | /v1/members/{id} | Read |
| 37 | member.list | GET | /v1/members | Search |
| 38 | workflowRun.status | GET | /v1/workflowRun/{runID}/status | - |
| 39 | file.create | POST | /v1/files | Write |
| 40 | file.retrieve | GET | /v1/files/{id} | Read |
| 41 | file.list | GET | /v1/files | Search |
| 42 | file.cancel | POST | /v1/files/{id}/cancel | Write |
| 43 | file.complete | POST | /v1/files/{id}/complete | Write |
| 44 | file.url | GET | /v1/files/{id}/url | Read |

**Total: 44 endpoints across 10 resources.**

---

## 15. Key Competitive Intelligence Observations

### What Lightfield HAS that is notable:
1. **Schema-less custom fields** -- dynamic `fields` map supports arbitrary slugs beyond system `$`-prefixed fields
2. **Definitions API** -- schema introspection endpoints for accounts, contacts, opportunities, tasks (not meetings/notes)
3. **Auto-enrichment** -- accounts enrich on `$website`, contacts enrich on create
4. **AI-generated fields** -- `readOnly: true` fields like `$howTheyMakeMoney`, `$accountStatus`, opportunity summaries
5. **Privacy-aware meetings** -- `accessLevel: 'FULL' | 'METADATA'`, redaction per caller
6. **Knowledge base uploads** -- files can be added to user or workspace Knowledge for AI assistant
7. **Auto-create records** -- `autoCreateRecords` on meeting create for external attendees
8. **Lists** -- typed collections (account/contact/opportunity) with member management
9. **Workflow runs** -- async workflow execution status tracking

### What Lightfield is MISSING from the SDK:
1. **No DELETE endpoints** -- cannot delete any entity
2. **No bulk operations** -- no batch create/update/delete
3. **No search/query** -- only basic field filtering via query params, no full-text search
4. **No webhook management** -- no webhook CRUD in SDK
5. **No email/activity** -- no email, call, or activity logging endpoints
6. **No pipeline stages management** -- stages defined via definitions but no CRUD for stages themselves
7. **No import/export** -- no CSV/data import endpoints
8. **No custom field CRUD** -- can read definitions but cannot create/modify custom fields via API
9. **No deal value/forecast** -- opportunity has `$stage` but no explicit `$value`/`$probability` in typed params
10. **Tiny page size** -- hard cap at 25 records per page, painful for data sync
11. **No cursor-based pagination** -- offset-only means large datasets require many sequential requests
12. **No event/changelog** -- no audit trail or change feed endpoint

### Architecture notes:
- Generated by Stainless (OpenAPI SDK generator)
- Zero runtime dependencies
- Supports Node, Deno, Bun, Cloudflare Workers, Vercel Edge
- Both CJS and ESM exports
- Updates use POST (not PATCH) -- idempotent by design
- API versioned via header (`Lightfield-Version: 2026-03-01`), not URL
