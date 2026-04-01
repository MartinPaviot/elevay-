# UI-REDESIGN Tasks

## T1: Design tokens in globals.css
- Replace hardcoded hex values with CSS custom properties
- Add full token set from our-design-system.md
- Verify: Body bg/text use new tokens
- Commit: "ui: add design tokens to globals.css"

## T2: Dashboard layout (sidebar + header)
- Rebuild sidebar: 240px, new nav item styling, section headers
- Match Lightfield's nav patterns: 32px items, 6px radius, transparency hover
- Add resize handle concept (CSS only)
- Verify: Navigation works, active states correct, all pages accessible
- Commit: "ui: rebuild sidebar and dashboard layout"

## T3: Chat page
- Rebuild message bubbles: user at 15px/right/subtle bg, AI at 15px/left/no bg
- Add "LeadSens" label with sparkle icon for AI messages
- Restyle input bar: bottom-fixed, 15px font, minimal border
- Restyle suggestion buttons
- Verify: Messages render, streaming works, email composer opens
- Commit: "ui: rebuild chat page"

## T4: Accounts page
- Rebuild data table: 40px rows, sub-pixel borders, dense headers
- Add auto-colored industry badges (hash-based)
- Restyle score display (letter grade + heat)
- Restyle signal badges and popovers
- Add filter bar component
- Verify: All columns render, search works, enrichment actions work
- Commit: "ui: rebuild accounts page"

## T5: Account detail page
- Convert to slide-over panel (right side)
- Property key-value layout
- Link back to table view
- Verify: All fields display, scoped chat works
- Commit: "ui: rebuild account detail as slide-over"

## T6: Contacts page
- Same table rebuild as accounts (T4 patterns)
- Auto-colored badges for job titles
- Verify: CSV import, enrichment, row navigation work
- Commit: "ui: rebuild contacts page"

## T7: Opportunities (kanban)
- Restyle columns: 260px, stage dot colors from design system
- Restyle deal cards: sub-pixel borders, risk indicators
- Restyle analytics panel
- Verify: Deal creation, analytics toggle, all stages render
- Commit: "ui: rebuild opportunities kanban"

## T8: Dashboard/home page
- Restyle greeting, priorities, insights sections
- Apply card and badge tokens
- Restyle chat bar at bottom
- Verify: Data loads, priorities display, meetings show
- Commit: "ui: rebuild dashboard page"

## T9: Tasks, Meetings, Notes pages
- Apply consistent table/list styling
- Group headers in brand color
- Empty states with helpful text
- Verify: CRUD operations work on each
- Commit: "ui: rebuild tasks, meetings, notes pages"

## T10: Settings pages
- Restyle settings layout sidebar
- Restyle form inputs, toggles, dropdowns
- Apply page title (24px/-0.3px) and description tokens
- Verify: All settings save correctly
- Commit: "ui: rebuild settings pages"

## T11: Sequences page + detail
- Restyle card list
- Apply status badges
- Verify: Sequence creation, step editing work
- Commit: "ui: rebuild sequences pages"

## T12: Shared components
- EmailComposer: restyle as slide-over panel
- ScopedChat: match main chat styling
- Loading skeletons: shimmer animation
- Verify: Both components render in all contexts
- Commit: "ui: rebuild shared components"
