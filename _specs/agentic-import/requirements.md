# Agentic Import — Requirements v2

## User Story

**As a** founder switching to Elevay,
**I want to** upload CSV files in chat and have the agent handle the entire import — mapping, dedup, relationship wiring, custom fields — with progress tracking,
**so that** I get a structured CRM without manual data work.

## Context

**Current state**: Smart import at `/api/import/smart/` does LLM column mapping + heuristic fallback, preview/commit 2-step. BUT: no chat integration, no dedup (just onConflictDoNothing), no relationship wiring (contacts not linked to companies), no custom field creation, no progress tracking, row-by-row inserts (slow).

**Lightfield's standard**: Upload in chat, agent maps/deduplicates/wires relationships/proposes custom fields, 90K records/hour, retry-safe, multi-file stitching.

## Acceptance Criteria

### AC-1: CSV upload triggers agent import flow in chat
**GIVEN** the user uploads a CSV in chat (drag-drop or file picker)
**WHEN** the agent receives the file
**THEN** it analyzes structure, proposes entity type + column mapping, shows preview of 5 rows
**AND** asks for confirmation before importing

### AC-2: User can modify mapping via natural language
**GIVEN** the agent proposed mapping "Company → name"
**WHEN** the user says "Map 'Company' to account domain instead"
**THEN** the agent updates the mapping and shows the new preview

### AC-3: Fuzzy deduplication
**GIVEN** the CSV contains "Acme Corp" and the CRM has "Acme Corporation"
**WHEN** the import runs
**THEN** the agent detects the fuzzy match (using entity resolver with embedding similarity > 0.85)
**AND** merges instead of creating a duplicate
**AND** reports "450 created, 23 merged with existing records, 5 skipped"

### AC-4: Relationship wiring
**GIVEN** a contacts CSV with a "Company" or "Company Domain" column
**WHEN** the import runs
**THEN** contacts are automatically linked to matching companies (by domain or name)
**AND** if no matching company exists and enough data is present, a new company is created

### AC-5: Custom field proposal
**GIVEN** the CSV has columns not in the CRM schema (e.g., "ARR", "Tech Stack")
**WHEN** the agent analyzes the file
**THEN** it proposes creating custom attributes for unmapped columns
**AND** the user can approve/reject each proposed field

### AC-6: Progress tracking via long-running tasks
**GIVEN** a CSV with 5000+ records
**WHEN** the import starts
**THEN** a task is created via the agent_tasks system
**AND** the chat shows a TaskProgressCard with real-time SSE updates
**AND** the user can cancel mid-import

### AC-7: Batch INSERT for performance
**GIVEN** a CSV with 10K records
**WHEN** the import runs
**THEN** records are inserted in batches of 200 (not row-by-row)
**AND** the import completes within 2 minutes (>80 records/second)

### AC-8: Retry-safe with import_job_id tagging
**GIVEN** an import was interrupted at row 3000
**WHEN** the user re-uploads or retries
**THEN** already-imported records are detected via content hash
**AND** import resumes from row 3001
**AND** every imported record is tagged with importJobId in properties for rollback

## Edge Cases

- CSV with non-English headers (French, German) → LLM handles natively
- Malformed rows (wrong column count) → skip and log, continue importing valid rows
- File > 10MB → reject with message "Split your file into smaller chunks"
- CSV with mixed entity types → agent asks to clarify or splits automatically
- Duplicate column names in CSV → disambiguate with column index
- CSV delimiter detection (comma, semicolon, tab) → auto-detect from first line
