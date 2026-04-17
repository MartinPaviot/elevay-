# ROX-GAP-3 — Plays Builder UI

## User Story

As a founder, I want to create and edit sales playbooks ("plays") from the settings page so I can codify my sales process and have the agent follow it consistently across all deals.

## Background

Rox's "Plays" feature packages top-performing sales strategies into repeatable templates. Elevay already has the `customSkillTemplates` table (Sprint 2) but no UI to create/edit templates. The data model is ready — this spec is about the settings page.

## Acceptance Criteria

### AC1: List plays
GIVEN the user navigates to `/settings/plays`
WHEN the page loads
THEN they see a list of existing plays with: name, category, version, active status
AND an "Add play" button

### AC2: Create a play
GIVEN the user clicks "Add play"
WHEN they fill in: name, category (dropdown: qualification/discovery/proposal/objection/closing/re_engage), description, guidelines (markdown), optional trigger, optional examples
AND click Save
THEN the play is stored in `customSkillTemplates`
AND appears in the list

### AC3: Edit a play
GIVEN the user clicks on an existing play
WHEN they modify any field and click Save
THEN the play's `version` increments by 1
AND `updatedAt` is set to now

### AC4: Toggle active/inactive
GIVEN a play exists
WHEN the user toggles the active switch
THEN `isActive` flips
AND inactive plays are not used by the agent

### AC5: Delete a play
GIVEN a play exists
WHEN the user clicks Delete and confirms
THEN the play is removed from the DB

### AC6: Agent uses plays
GIVEN a custom play exists with category "proposal" and `isActive = true`
WHEN the user asks the agent to "draft a proposal" via chat
THEN the agent loads the play's guidelines and examples as context for the generation
AND the response follows the play's structure

## Edge Cases

- No plays exist → empty state with explanation and "Add your first play" CTA
- Play name collision → unique constraint on (tenantId, slug)
- Very long guidelines (>5000 chars) → accepted, no truncation
