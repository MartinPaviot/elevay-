# 15 — proposals (`/proposals`) — audit d'hydratation

**Verdict global : H1 (fidèle).** The /proposals page is a faithfully data-hydrated workspace. Every data-bearing element traces to a real, tenant-scoped source: the template list and detail (proposalTemplates with eq(tenantId)+isNull(deletedAt) under withAuthRLS), the deal picker (deals leftJoin companies with eq(deals.tenantId)), and the filled-proposal components/confidence/citations (buildProposalFill drawing the real deal/company/contact info base, with grounding-based trust signals and citations to real interactions). Loading states ('Working…', 'Drafting…', 'Searching…'), written empty states ('No templates yet', 'No deals yet', 'No components detected'), and API error reasons are all handled. The only deviation from the Home-page bar is that element-level errors degrade through a single shared notice banner rather than each lane degrading independently in place — a minor H2-flavored nuance, not a defect, so the page lands at H1 overall.

Entrée : `app/apps/web/src/app/(dashboard)/proposals/page.tsx`.

## Éléments

| Élément | file:line | Source (file:line) | État | Tenant | Loading | Empty | Error | Fresh | Note |
|---------|-----------|--------------------|------|--------|---------|-------|-------|-------|------|
| Page header title/subtitle | proposals/page.tsx:551-556 | static (chrome label) | H0 | n/a | none | n/a | n/a | static | faithful — pure chrome, correctly static |
| Template list (rows: name + status pill) | proposals/page.tsx:594-613 | GET /api/proposals/templates → proposalTemplates, eq(tenantId)+isNull(deletedAt) (api/proposals/templates/route.ts:136-155) | H1 | yes | none | handled | silent | once | real tenant-scoped; written empty state line 589-593; status mapped via STATUS_LABEL |
| Template list empty state | proposals/page.tsx:589-593 | derived from templates.length (loadList, page.tsx:126-132) | H1 | yes | none | handled | n/a | once | faithful — written empty copy when no templates |
| Selected template header (name · originalFileName · status) | proposals/page.tsx:627-633 | GET /api/proposals/templates/[id] (api/proposals/templates/[id]/route.ts:10-39), eq(tenantId) | H1 | yes | none | handled | global | once | real tenant-scoped detail; 404 handled to notice banner |
| Detected component-map rows (kind/label/dataKey/confidence) | proposals/page.tsx:644-699 | template.componentMap from detectComponents LLM (templates/route.ts:104-116); DATA_KEYS from lib/proposals/component-map | H1 | yes | none | handled | global | once | real detected map; no-components empty state line 635-639; editable client-side then persisted via PATCH |
| Component count ('N components') | proposals/page.tsx:711-713 | draft.components.length (derived) | H1 | yes | n/a | handled | n/a | once | faithful — derived from real map |
| Deal picker results (name · company · stage) | proposals/page.tsx:755-772 | GET /api/opportunities?pageSize=20&search= → deals leftJoin companies, eq(deals.tenantId) (api/opportunities/route.ts:25-156) | H1 | yes | spinner | handled | silent | poll | real tenant-scoped deal search; debounced; 'Searching…' loading (745-749) + 'No matching deals.'/'No deals yet.' empty (750-754); transient error leaves prior results |
| Filled proposal components (content textarea + label/kind) | proposals/page.tsx:820-857 | POST /api/proposals/templates/[id]/fill → buildProposalFill(tenantId) drawing real deal/company/contact (lib/proposals/fill.ts:13-71) | H1 | yes | spinner | handled | global | once | real grounded per-deal content; 'Drafting…' loading; deal_not_found/template_not_mapped/missing_model errors → notice; abstains rather than fabricate |
| Confidence pill (high/medium/low) | proposals/page.tsx:826-832 | FilledComponent.confidence from fill grading (lib/proposals/grade.ts via fill.ts) | H1 | yes | n/a | handled | global | once | faithful — real grounding confidence color-coded |
| 'needs input' / 'unsupported' badges | proposals/page.tsx:833-849 | FilledComponent.abstained / unsupported + supportRatio from fill engine | H1 | yes | n/a | handled | global | once | faithful — real trust signals from grounding ratio |
| Citation chips | proposals/page.tsx:858-871 | FilledComponent.citations from collectCitableSources (lib/proposals/sources.ts via fill.ts) | H1 | yes | n/a | handled | global | once | faithful — real cited tenant interactions/fields; self-hides when none |
| Unmapped-sections notice | proposals/page.tsx:815-819 | filled.unmappedSections from fill result | H1 | yes | n/a | handled | global | once | faithful — derived, self-hides when empty |
| Notice banner (errors/success) | proposals/page.tsx:574-581 | setNotice from all fetch error branches (page.tsx:200-214, 254-262, 299-306, 336-353, 371-374) | H1 | n/a | n/a | n/a | global | once | faithful — surfaces real API error reasons; this is the page's shared error channel (global, not per-element) |

## Pires défauts

1. Error degradation is centralized into one shared notice banner (proposals/page.tsx:574-581) rather than per-element independent degradation as on Home — a panel that 500s blanks the region while the banner shows a generic message.
2. Template list GET failure is swallowed: loadList only sets templates on res.ok (proposals/page.tsx:126-132) with no error/loading state, so a 500 silently yields the 'No templates yet' empty state (false-empty), proposals/page.tsx:589-593.
3. No skeleton/loading state for the initial template list or template-detail fetch (proposals/page.tsx:138-154); first paint shows the empty-state copy until data resolves, which can read as a false empty on slow loads.
