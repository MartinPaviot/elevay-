# Context Graph Architecture: State of the Art (April 2026)

Research compiled from 25+ sources (papers, implementations, production systems).
Covers knowledge graphs for AI agents, self-correcting memory, graph+vector hybrids,
and context window optimization for CRM/GTM use cases.

---

## 1. What Is a Context Graph?

A **context graph** is a knowledge graph specifically engineered for AI agent consumption.
It differs from a traditional knowledge graph in several critical ways:

| Aspect | Knowledge Graph | Context Graph |
|--------|-----------------|---------------|
| Purpose | Comprehensive storage | AI model consumption |
| Scale | Millions of entities | 10-100s per query (subgraph extraction) |
| Optimization | Query performance | Token efficiency, relevance scoring |
| Confidence | Assumed or absent | Scored and tracked per edge |
| Scope | Domain-wide | Query-specific dynamic extraction |
| Temporal | Often absent | Bi-temporal validity tracking |

Foundation Capital defines it as: **"A living record of decision traces stitched across
entities and time, where precedent becomes searchable."**

The critical insight: systems of record store outcomes; systems of agents must capture
*reasoning*. A traditional CRM logs "Deal closed at 40% discount." A context graph
records "VP Sarah approved 40% discount because customer committed to 3-year contract
and became reference customer, meeting strategic partnership criteria despite violating
standard pricing policy."

Three essential layers:
1. **Entity Foundation** -- typed nodes (Person, Company, Deal, Email, Meeting)
2. **Temporal Layer** -- what was true *when*, with validity windows
3. **Decision Trace Instrumentation** -- why decisions were made, with provenance

---

## 2. Production Systems and Their Architectures

### 2.1 Zep / Graphiti (State of the Art for Agent Memory)

**Paper:** "Zep: A Temporal Knowledge Graph Architecture for Agent Memory" (Jan 2025)
**Open source:** github.com/getzep/graphiti
**Performance:** 94.8% on DMR benchmark (vs 93.4% MemGPT), P95 latency 300ms

#### Data Model: Tripartite Graph

```
G = (N, E, phi) with three subgraphs:

1. Episode Subgraph (G_e)
   - Raw input storage (messages, structured data)
   - Each episode has: actor, timestamp (t_ref), content
   - Episode types: text, json

2. Semantic Entity Subgraph (G_s)
   - Extracted entity nodes (N_s): name, summary, 1024-dim embedding
   - Semantic edges (E_s): relation_type (ALL_CAPS like WORKS_FOR, LOVES)
   - Each edge has: fact description, temporal fields, embedding

3. Community Subgraph (G_c)
   - Clusters of strongly connected entities
   - Community names, summaries, key terms
   - Built via label propagation algorithm
```

#### Bi-Temporal Model (The Key Innovation)

Every edge carries FOUR timestamps:
```
Timeline T  (event timeline -- when facts actually occurred):
  - t_valid:   when the fact became true in the real world
  - t_invalid: when the fact stopped being true

Timeline T' (transaction timeline -- when data was ingested):
  - t'_created: when the edge was added to the graph
  - t'_expired: when the edge was superseded in the graph
```

This enables queries like "What did we know about this contact on March 15?"
and "When did we learn that this deal was at risk?"

#### Ingestion Pipeline (7 Steps)

```
Episode Input
    |
    v
Step 1: ENTITY EXTRACTION
    - Process current message + n=4 prior messages for context
    - Auto-extract speaker as entity
    - Apply reflection technique to minimize hallucination
    - Generate entity summaries
    |
    v
Step 2: ENTITY RESOLUTION
    - Embed entity names (1024-dim vectors)
    - Cosine similarity search against existing entities
    - Full-text search on names/summaries
    - LLM with resolution prompt to identify duplicates
    - Merge if duplicate found (update name + summary)
    |
    v
Step 3: FACT EXTRACTION
    - Extract relationships between entities
    - Generate relation_type (ALL_CAPS: WORKS_FOR, MANAGES, etc.)
    - Create detailed fact descriptions
    - Consider temporal aspects from content
    |
    v
Step 4: FACT RESOLUTION (Deduplication)
    - Generate embeddings for new facts
    - Dedup constrained to same entity pairs
    - LLM comparison against semantically related edges
    - Identify contradictions and exact duplicates
    |
    v
Step 5: TEMPORAL EXTRACTION
    - Extract absolute timestamps ("born June 23, 1912")
    - Resolve relative times ("two weeks ago") using t_ref
    - Set t_valid and t_invalid based on temporal markers
    - ISO 8601 format
    |
    v
Step 6: EDGE INVALIDATION (Self-Correction)
    - Compare new edges against semantically related existing edges
    - Identify temporally overlapping contradictions
    - Set t_invalid of old edge = t_valid of new edge
    - NEW INFORMATION ALWAYS WINS (prioritizes recency)
    - Old edges retained (not deleted) for history
    |
    v
Step 7: COMMUNITY DETECTION
    - Label propagation algorithm
    - New entities: assign to community of plurality of neighbors
    - Update community summaries iteratively
    - Periodic complete refreshes
```

#### Search/Retrieval: Three-Stage Pipeline

```
f(query) = construct( rerank( search(query) ) )

STAGE 1 -- SEARCH (three parallel methods):
  a) Cosine Similarity (phi_cos): semantic embedding search
  b) BM25 Full-Text (phi_bm25): keyword matching via Lucene
  c) Breadth-First Search (phi_bfs): n-hop graph traversal from seed nodes

  Each captures different similarity:
  - Full-text: word-level matches
  - Cosine: semantic meaning
  - BFS: contextual/structural relationships

STAGE 2 -- RERANKING (multiple strategies):
  - Reciprocal Rank Fusion (RRF)
  - Maximal Marginal Relevance (MMR) -- diversity
  - Episode-mentions reranker (frequency-based)
  - Node distance reranker (graph distance from centroid)
  - Cross-encoder LLMs (highest quality, highest cost)

STAGE 3 -- CONTEXT CONSTRUCTION:
  - Format nodes/edges into context string
  - Include temporal validity ranges
  - Separate FACTS and ENTITIES sections
  - Template: "FACT (Date range: from X - to Y)"
```

**Critical performance detail:** No LLM calls during retrieval. Sub-second latency
comes from pre-computed embeddings + index lookups + graph traversal only.

#### Implementation Stack
- Storage: Neo4j (also supports FalkorDB, Kuzu, Amazon Neptune)
- Embeddings: BGE-m3 (BAAI), 1024 dimensions
- LLM (construction): gpt-4o-mini or gpt-4o
- Indexing: Lucene (via Neo4j) for BM25
- Python 3.10+, async/await throughout

---

### 2.2 Mem0 (Production Graph Memory Layer)

**Paper:** "Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory" (2025)
**Performance:** 68.4% accuracy on LOCOMO, 2.59s P95 latency

#### Architecture: Dual-Store (Vector + Graph)

```
                   memory.add(messages)
                         |
                         v
               +-------------------+
               | EXTRACTION PHASE  |
               | (LLM-powered)     |
               +-------------------+
               |                   |
               v                   v
     +-----------------+  +------------------+
     | Vector Store    |  | Graph Store      |
     | (embeddings)    |  | (nodes + edges)  |
     | Qdrant/Pinecone |  | Neo4j/Memgraph   |
     | /Weaviate/etc   |  | /Neptune/Kuzu    |
     +-----------------+  +------------------+
               |                   |
               v                   v
     +-----------------+  +------------------+
     | Similarity      |  | Relationship     |
     | Search          |  | Traversal        |
     +-----------------+  +------------------+
               |                   |
               v                   v
         +-----------------------------+
         | MERGED RESULTS              |
         | (vector ranking primary,    |
         |  graph enrichment secondary)|
         +-----------------------------+
```

#### Key Design Decisions:
- **Async memory writes**: Memory extraction never blocks response generation
- **Multi-scope model**: user_id, agent_id, run_id, app_id for isolation
- **Graph edges do NOT reorder vector results** -- enrichment only
- **Conflict detection**: LLM flags contradictions before writes
- **Threshold filtering**: 0.75 confidence minimum to prevent noisy edges

#### Three Memory Types:
1. **Episodic**: What happened (conversations, events)
2. **Semantic**: What is true (facts, preferences, attributes)
3. **Procedural**: How to do things (learned workflows, tool patterns)

---

### 2.3 Microsoft GraphRAG

**Paper:** Microsoft Research (2024)
**Open source:** github.com/microsoft/graphrag

#### Architecture: Hierarchical Community Summarization

```
INDEXING PHASE:
  Documents
    -> Text segmentation
    -> Entity + relationship extraction (LLM)
    -> Graph construction
    -> Community detection (Leiden algorithm)
    -> Hierarchical clustering (multi-level)
    -> Community report generation (LLM summarizes each community)

QUERY PHASE:
  Query
    -> Local Search: entity-centric, specific facts
    -> Global Search: community reports, thematic understanding
    -> DRIFT Search: dynamic, iterative refinement
    -> Dynamic Community Selection (2025 optimization)
```

**Key difference from Graphiti:** GraphRAG requires batch recomputation when new
data arrives. Graphiti does incremental updates. GraphRAG is optimized for
document corpus analysis; Graphiti is optimized for real-time agent memory.

**Cost:** Original GraphRAG had $33K indexing cost for large datasets.
Dynamic community selection and DRIFT search reduced this significantly.

---

### 2.4 LightRAG (Lightweight Graph RAG)

**Paper:** EMNLP 2025, "LightRAG: Simple and Fast Retrieval-Augmented Generation"
**Open source:** github.com/HKUDS/LightRAG

#### Architecture: Dual-Level Retrieval

```
INDEXING:
  Text chunks
    -> Entity + Relationship extraction (LLM)
    -> Profiling: generate key-value pairs for each entity/relation
    -> Deduplication: merge identical entities across chunks
    -> Result: Graph D = (V, E) with embeddings

RETRIEVAL (dual-level):
  Query
    -> LLM extracts local keywords + global keywords
    -> LOCAL: match keywords to entities, retrieve direct relationships
    -> GLOBAL: match keywords to relationships, retrieve thematic connections
    -> HIGH-ORDER ENRICHMENT: 1-hop neighbor expansion
    -> Combine both levels for comprehensive context
```

**Performance vs GraphRAG:**
- **Token efficiency:** <100 tokens per query vs 610,000 for GraphRAG
- **API calls:** 1 call vs hundreds
- **Latency:** ~80ms vs seconds-to-tens-of-seconds
- **Incremental updates:** Union operations (no rebuild) vs full hierarchy rebuild

---

### 2.5 ConVer-G / Graph-Native Cognitive Memory (2025-2026)

**Paper:** "Graph-Native Cognitive Memory for AI Agents" (arxiv 2603.17244)

#### Architecture: Formal Belief Revision

Grounded in AGM belief revision theory. Key innovations:

```
DUAL-STORE MODEL:
  Working Memory: Redis (<5ms latency, session buffers)
  Long-Term Memory: Neo4j property graph (immutable revisions + mutable tags)

REVISION MODEL:
  - Each memory Item contains ordered, immutable revision snapshots
  - Tags = mutable pointers (like Git refs pointing to commits)
  - Revision creates new snapshot + Supersedes edge to prior
  - Contraction removes tags (marks deprecated, excluded from retrieval)

TYPED EDGE ONTOLOGY:
  - Depends_On: validity dependency (if target invalidates, source unreliable)
  - Derived_From: evidential provenance
  - Supersedes: belief revision chain
  - Referenced: associative mention
  - Contains: bundle membership
  - Created_From: generative lineage

CONTRADICTION PREVENTION:
  - Retrieval surface B_retr is a strict subset of full graph
  - Only tag-referenced, non-deprecated revisions are searchable
  - Superseded revisions exist in graph (audit trail) but excluded from search
  - Agent cannot access conflicting beliefs simultaneously

IMPACT ANALYSIS:
  - AnalyzeImpact traversal: find all downstream conclusions dependent on
    a revised belief
  - Automatic flagging of conclusions requiring re-evaluation
  - Cascading invalidation through Depends_On edges
```

**Key formal guarantee:** 100% AGM compliance across 49 automated test scenarios.
The system provably satisfies belief revision postulates (Success, Consistency,
Extensionality, Relevance).

---

## 3. Self-Correction Mechanisms

The field has converged on several patterns for knowledge self-correction:

### 3.1 Temporal Invalidation (Zep/Graphiti approach)
```
When new fact F_new contradicts existing fact F_old:
  1. Embed F_new, search for semantically related existing edges
  2. LLM compares F_new against candidates (same entity pairs)
  3. If contradiction detected AND temporal windows overlap:
     - Set F_old.t_invalid = F_new.t_valid
     - F_old remains in graph (historical record)
     - F_new becomes the current truth
  4. New information always wins (recency bias)
```

### 3.2 Belief Revision (ConVer-G approach)
```
When new evidence contradicts existing belief B:
  1. Create new revision r^(k+1) with updated content
  2. Add Supersedes edge: r^(k+1) -> r^(k)
  3. Move tag pointer to r^(k+1)
  4. r^(k) excluded from retrieval surface (but preserved)
  5. AnalyzeImpact traversal finds all Depends_On chains
  6. Downstream conclusions flagged for re-evaluation
```

### 3.3 Conflict Detection Patterns
```
PATTERN-BASED (PaTeCon, NeurIPS 2024):
  - Mine temporal constraints from graph patterns automatically
  - No human expert needed
  - Pruning strategy for speed

EMBEDDING-BASED (TeCre):
  - Sequence vectorization of predicate relations
  - Temporal constraints: time-disjoint, time-precedence, time-mutually-exclusive
  - Link prediction to complete missing entities

CONSTRAINT-BASED (TeCoRe):
  - Allen's interval algebra for temporal constraints
  - Compute conflict-free temporal knowledge graphs
  - Formal conflict resolution

AGENT-DRIVEN (Self-Evolving KG):
  - Agents evaluate new facts before integration
  - Cross-source verification
  - Confidence scoring per relationship
  - Recursive exploration deepens connections
```

### 3.4 Plan-on-Graph (PoG, NeurIPS 2024)
Self-correcting adaptive planning on knowledge graphs:
- LLM plans traversal path on KG
- Executes plan, evaluates results
- If results inadequate, revises plan and re-traverses
- Iterative refinement until answer quality threshold met

---

## 4. Vector + Graph Hybrid Architectures

The field has converged on hybrid as the production standard. Key pattern:

### 4.1 HybridRAG Architecture
```
PARALLEL RETRIEVAL:
  Query
    |
    +-> Vector DB (embedding similarity)
    |     Returns: top-K semantically similar chunks/facts
    |
    +-> Graph DB (structural traversal)
    |     Returns: connected entities, multi-hop paths
    |
    v
  FUSION LAYER
    - Reciprocal Rank Fusion (RRF)
    - Reranking (cross-encoder or LLM-based)
    - Deduplication
    |
    v
  CONTEXT ASSEMBLY
    - Token budget aware
    - Relevance scored
    - Provenance tracked
```

**Performance:** HybridRAG outperforms both VectorRAG and GraphRAG individually
at both retrieval and generation stages.

### 4.2 The Standard Production Stack (2026)
```
VECTOR LAYER:
  - Embedding model: text-embedding-3-small or BGE-m3
  - Vector DB: Qdrant, Pinecone, Weaviate, PGVector, or Milvus
  - Search: cosine similarity with threshold filtering
  - Purpose: semantic recall (find similar things)

GRAPH LAYER:
  - Graph DB: Neo4j, FalkorDB, Kuzu, or Neptune
  - Query: Cypher or traversal API
  - Purpose: structural reasoning (find connected things)

KEYWORD LAYER:
  - BM25 via Lucene/Elasticsearch/OpenSearch
  - Purpose: exact term matching (catch what embeddings miss)

FUSION:
  - RRF or learned fusion weights
  - Optional cross-encoder reranking
  - Token budget enforcement
```

---

## 5. Context Window Optimization

How to select the most relevant context from a large graph:

### 5.1 Query-Driven Subgraph Extraction
```
1. ENTRY POINT MATCHING
   - Embed the query
   - Match against node/edge embeddings (vector similarity)
   - Match against node names/properties (BM25/keyword)
   - Result: seed nodes (starting points)

2. NEIGHBOR EXPANSION
   - BFS from seed nodes (1-3 hops)
   - Priority by: recency, edge weight, relevance score
   - Collect subgraph of connected context

3. COMMUNITY CONTEXT
   - Identify which communities seed nodes belong to
   - Include community summaries for broader context

4. TOKEN BUDGET ENFORCEMENT
   - Score each retrieved element by relevance
   - Sort by score descending
   - Fill context window up to token limit
   - Include provenance metadata for citations
```

### 5.2 TrustGraph Context Graph Approach
```
- Max-entities constraint: limit retrieved nodes
- Graph-depth constraint: limit traversal hops (2-4)
- Relevance-threshold: minimum score to include
- Hierarchical summarization: compress deep subgraphs
- Temporal ordering: recent facts weighted higher
- Community detection: extract semantic clusters
```

**Result:** 70% token reduction while preserving essential information.

### 5.3 Four Context Engineering Strategies
```
1. WRITE context: persist to scratchpad/memory (reduce re-retrieval)
2. SELECT context: pull from graph/vector/keyword stores on demand
3. COMPRESS context: summarize, deduplicate, elide low-value content
4. ISOLATE context: scope by user_id, agent_id, task type
```

---

## 6. CRM-Specific Entity Schema

For a GTM/CRM context graph, the entity schema should model:

### 6.1 Core Entity Types (Nodes)
```
Person          -- contacts, leads, decision-makers
  properties: name, title, email, phone, linkedin_url, summary

Company         -- accounts, organizations
  properties: name, domain, industry, size, funding, summary

Deal            -- opportunities, pipeline items
  properties: name, stage, value, probability, close_date, summary

Email           -- email messages (episodes)
  properties: subject, from, to, cc, date, thread_id, body_hash

Meeting         -- calendar events (episodes)
  properties: title, date, duration, attendees, summary

Note            -- manual observations
  properties: content, author, date, summary

Task            -- action items
  properties: description, assignee, due_date, status

Sequence        -- outbound cadences
  properties: name, status, step_count

Signal          -- buying signals, intent data
  properties: type, source, strength, date
```

### 6.2 Core Relationship Types (Edges)
```
WORKS_AT            Person -> Company (with title, start_date, end_date)
REPORTS_TO          Person -> Person
KNOWS               Person -> Person (with context: how they met)
INVOLVED_IN         Person -> Deal (with role: champion, blocker, etc.)
SENT                Person -> Email
RECEIVED            Person -> Email
ATTENDED            Person -> Meeting
DISCUSSED           Meeting -> Deal/Company/Topic
MENTIONED_IN        Person/Company -> Email/Meeting/Note
BELONGS_TO          Deal -> Company
NEXT_STEP           Deal -> Task
PART_OF_SEQUENCE    Email -> Sequence
TRIGGERED_BY        Signal -> Event/Email/PageView
SIMILAR_TO          Company -> Company (by ICP match score)
COMPETES_WITH       Company -> Company
```

### 6.3 Temporal Validity on Every Edge
```
Every relationship edge carries:
  - t_valid:    when this relationship became true
  - t_invalid:  when this relationship stopped being true (null = current)
  - t_created:  when we learned this fact
  - confidence: 0.0-1.0 extraction confidence
  - source_episode_id: provenance link to raw data
```

---

## 7. Recommended Architecture for a Self-Correcting GTM Context Graph

### 7.1 Data Model (Graphiti-inspired, CRM-adapted)

```
THREE SUBGRAPHS:

1. EPISODE LAYER (raw data, immutable)
   - EmailEpisode, MeetingEpisode, NoteEpisode, SignalEpisode
   - Each carries: content, actor, t_ref, source, metadata
   - Never modified after creation

2. SEMANTIC LAYER (extracted knowledge, evolving)
   - Entity nodes: Person, Company, Deal, Task, Signal
   - Relationship edges: typed, with bi-temporal validity
   - Community clusters with summaries
   - Confidence scores on every extraction

3. DECISION LAYER (agent reasoning traces)
   - Decision nodes: scoring, prioritization, sequence selection
   - Rationale edges: why decisions were made
   - Outcome tracking: what happened after the decision
```

### 7.2 Ingestion Pipeline

```
RAW INPUT (email, calendar, call transcript, CRM event, web signal)
  |
  v
EPISODE CREATION
  - Store raw content as immutable episode
  - Assign t_ref, source type, actor
  |
  v
ENTITY EXTRACTION (LLM)
  - Extract persons, companies, deals, topics
  - Generate summaries and embeddings
  - Confidence score each extraction
  |
  v
ENTITY RESOLUTION
  - Embed new entities
  - Search existing entities (cosine + BM25)
  - LLM-assisted dedup: "Is 'John at Acme' the same as 'John Smith, VP at Acme Corp'?"
  - Merge or create new
  |
  v
RELATIONSHIP EXTRACTION (LLM)
  - Extract typed relationships with temporal markers
  - Generate fact descriptions
  |
  v
CONFLICT DETECTION
  - Search for existing edges between same entity pairs
  - Compare new facts against existing facts
  - Classify: DUPLICATE / CONTRADICTION / NEW_INFORMATION / UPDATE
  |
  v
TEMPORAL RESOLUTION
  - DUPLICATE: skip (link to episode for provenance)
  - CONTRADICTION: invalidate old edge (set t_invalid), create new edge
  - UPDATE: create new edge, link old as historical
  - NEW: create edge with t_valid = now
  |
  v
COMMUNITY UPDATE
  - Assign new entities to communities
  - Update community summaries incrementally
  - Periodic full refresh
  |
  v
IMPACT ANALYSIS (optional, for high-value changes)
  - Traverse Depends_On edges from invalidated facts
  - Flag downstream conclusions for review
  - Notify agent of affected deals/scores
```

### 7.3 Retrieval Pipeline (for each agent query)

```
QUERY: "What's the latest on the Acme deal?"
  |
  v
MULTI-STRATEGY SEARCH (parallel):
  a) Semantic: embed query, cosine search against entity/edge embeddings
  b) Keyword: BM25 search against entity names, fact descriptions
  c) Graph: find "Acme" node, BFS 2-3 hops for connected context
  |
  v
FUSION + RERANKING:
  - RRF across all three result sets
  - Temporal boost: recent facts scored higher
  - Relevance filter: drop below threshold
  - MMR for diversity (avoid redundant facts)
  |
  v
CONTEXT ASSEMBLY:
  - Entities section: name, summary, key attributes
  - Facts section: "FACT (valid from X to Y): description"
  - Timeline section: recent episodes in chronological order
  - Token budget enforcement: most relevant first
  |
  v
DELIVER TO LLM with structured format
```

### 7.4 Self-Correction Loop

```
CONTINUOUS SELF-CORRECTION:

1. ON INGESTION:
   - Every new episode triggers conflict detection
   - Contradictions auto-invalidate old edges
   - Entity resolution prevents duplicate accumulation

2. ON RETRIEVAL:
   - Stale facts (t_invalid set) excluded from results
   - Confidence-weighted: low-confidence edges deprioritized
   - Temporal ordering: most recent version of each fact preferred

3. PERIODIC MAINTENANCE:
   - Community re-detection (weekly)
   - Embedding re-computation for drifted summaries
   - Orphan detection: entities with no recent episodes
   - Staleness scoring: flag facts not confirmed in N days

4. AGENT-DRIVEN CORRECTION:
   - Agent can explicitly invalidate facts it discovers are wrong
   - Human approval flow for high-impact corrections
   - Every correction creates audit trail (Supersedes edge)

5. FEEDBACK LOOP:
   - Track which retrieved context was actually used by LLM
   - Boost edges that are frequently useful
   - Demote edges that are retrieved but never used
   - Retrain extraction models on correction patterns
```

### 7.5 Technology Stack Recommendation

```
GRAPH DATABASE:     Neo4j (or FalkorDB for lower latency)
  - Cypher for queries
  - APOC for advanced operations
  - Full-text index for BM25
  - Vector index for embeddings (Neo4j 5.11+)

VECTOR STORE:       Built into Neo4j (or separate Qdrant for scale)
  - 1024-dim embeddings
  - HNSW index for fast similarity search

EMBEDDING MODEL:    text-embedding-3-small (OpenAI) or BGE-m3
  - Entity name embeddings
  - Fact description embeddings
  - Query embeddings

LLM (extraction):   gpt-4o-mini (cost-effective for high-volume extraction)
LLM (resolution):   gpt-4o (higher quality for conflict resolution)
LLM (generation):   gpt-4o or Claude (for agent responses)

WORKING MEMORY:     Redis (session-level, <5ms)
ASYNC QUEUE:        BullMQ or similar (for background ingestion)
API LAYER:          tRPC or REST (expose graph operations)
```

---

## 8. Benchmark Reality Check

From LOCOMO benchmark (standardized evaluation):

| Architecture | Accuracy | P95 Latency | Tokens/Query |
|---|---|---|---|
| Full context (send everything) | 72.9% | 17.12s | ~26,000 |
| Mem0g (vector + graph) | 68.4% | 2.59s | ~1,800 |
| Mem0 (vector only) | 66.9% | 1.44s | ~1,800 |
| RAG (basic) | 61.0% | 0.70s | varies |
| OpenAI Memory | 52.9% | -- | -- |

From DMR benchmark (Zep-specific):
| System | Accuracy |
|---|---|
| Zep (Graphiti) | 94.8% |
| MemGPT | 93.4% |

Key insight: **You trade ~6% accuracy for 91% lower tail latency and 90% fewer
tokens** when using selective graph memory vs. full context. This is the right
trade-off for real-time agent systems.

---

## 9. Open Problems (What's Not Solved Yet)

1. **Memory staleness detection**: High-relevance memories become confidently wrong
   over time. No good automated solution for "this fact was true 6 months ago but
   probably isn't anymore."

2. **Cross-session identity resolution**: Matching the same person across different
   communication channels (email vs LinkedIn vs phone) without explicit linking.

3. **Extraction accuracy**: LLM-based entity extraction still produces ~25% noise.
   Threshold filtering helps but loses recall.

4. **Graph growth management**: Without pruning, graphs grow unboundedly. No consensus
   on what to archive vs. keep active.

5. **Evaluation**: LOCOMO measures general recall, not domain-specific quality. CRM
   use cases need bespoke evaluation (did the agent surface the right context for
   THIS deal decision?).

6. **Multi-agent coordination**: When multiple agents write to the same graph,
   conflict resolution becomes a concurrency problem, not just a temporal one.

---

## 10. Key Takeaways for Implementation

1. **Use Graphiti as the reference architecture.** It's the most complete open-source
   implementation of temporal knowledge graphs for agents. Adapt its 7-step ingestion
   pipeline to CRM entities.

2. **Bi-temporal tracking is non-negotiable.** Without t_valid/t_invalid, you can't
   do self-correction. Without t_created/t_expired, you can't do audit trails.

3. **Hybrid retrieval is the standard.** Vector + keyword + graph traversal, fused
   with RRF, optionally reranked. No single retrieval method is sufficient.

4. **Async writes, sync reads.** Memory extraction should never block the user-facing
   agent. Writes happen in background; reads must be fast (<500ms P95).

5. **Episodes are immutable provenance.** Raw emails, meeting transcripts, etc. are
   never modified. Extracted knowledge points back to episodes for citation.

6. **Self-correction = temporal invalidation + conflict detection.** When new info
   contradicts old info, invalidate the old edge (don't delete it) and create a new
   edge. The graph retains full history.

7. **Context assembly is the art.** The hard part isn't building the graph -- it's
   selecting the right 1,800 tokens from it for each query. Invest heavily in
   relevance scoring, temporal boosting, and token budget management.

8. **Start with entities that matter for decisions.** Person, Company, Deal, Email,
   Meeting. Don't over-model. Add entity types as use cases demand them.

---

## Sources

- [Zep: Temporal Knowledge Graph Architecture (arxiv)](https://arxiv.org/abs/2501.13956)
- [Graphiti on GitHub](https://github.com/getzep/graphiti)
- [Graphiti Quick Start](https://help.getzep.com/graphiti/getting-started/quick-start)
- [LightRAG: Simple and Fast RAG (arxiv)](https://arxiv.org/abs/2410.05779)
- [LightRAG on GitHub](https://github.com/hkuds/lightrag)
- [Microsoft GraphRAG](https://github.com/microsoft/graphrag)
- [Microsoft GraphRAG Research](https://www.microsoft.com/en-us/research/project/graphrag/)
- [Graph-Native Cognitive Memory (arxiv)](https://arxiv.org/html/2603.17244v1)
- [Mem0 Graph Memory Docs](https://docs.mem0.ai/open-source/features/graph-memory)
- [Mem0 Research Paper (arxiv)](https://arxiv.org/abs/2504.19413)
- [State of AI Agent Memory 2026](https://mem0.ai/blog/state-of-ai-agent-memory-2026)
- [The Context Graph - Foundation Capital](https://rundatarun.io/p/the-context-graph-ais-trillion-dollar)
- [Context Graphs - TrustGraph](https://trustgraph.ai/guides/key-concepts/context-graphs/)
- [Context Engineering - Neo4j](https://neo4j.com/blog/agentic-ai/what-is-context-engineering/)
- [Context Graphs for AI Agents - CloudRaft](https://www.cloudraft.io/blog/context-graph-for-ai-agents)
- [Self-Evolving KGs Using Agentic Systems](https://medium.com/@community_md101/building-self-evolving-knowledge-graphs-using-agentic-systems-48183533592c)
- [Plan-on-Graph (NeurIPS 2024)](https://github.com/liyichen-cly/PoG)
- [HybridRAG (arxiv)](https://arxiv.org/abs/2408.04948)
- [Graph-Based Memory Solutions Compared](https://mem0.ai/blog/graph-memory-solutions-ai-agents)
- [Agent Memory Paper List](https://github.com/Shichun-Liu/Agent-Memory-Paper-List)
- [PaTeCon: Conflict Detection for Temporal KGs (arxiv)](https://arxiv.org/abs/2312.11053)
- [Graphs Meet AI Agents (arxiv)](https://arxiv.org/html/2506.18019v1)
- [FalkorDB: AI Agents Memory Systems](https://www.falkordb.com/blog/ai-agents-memory-systems/)
- [Building Production-Ready Graph Systems 2025](https://medium.com/@claudiubranzan/from-llms-to-knowledge-graphs-building-production-ready-graph-systems-in-2025-2b4aff1ec99a)
- [Context Engineering Guide - Mem0](https://mem0.ai/blog/context-engineering-ai-agents-guide)
