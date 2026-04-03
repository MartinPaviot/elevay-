/**
 * Ensure pgvector index exists on embeddings table.
 * Called on app startup or via API. Safe to run multiple times.
 *
 * Uses HNSW index (not IVFFlat) because:
 * - HNSW gives exact-quality results without tuning probes
 * - IVFFlat with default probes=1 misses ~90% of rows (root cause of 18% recall)
 * - HNSW works well at any dataset size and doesn't need retraining
 */
import postgres from "postgres";

export async function ensureVectorIndex(): Promise<void> {
  const sql = postgres(process.env.DATABASE_URL!);

  try {
    // Ensure the embeddings table exists with proper schema
    await sql`
      CREATE TABLE IF NOT EXISTS embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding vector(1536) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, entity_type, entity_id)
      )
    `;

    // Check if the old IVFFlat index exists and replace with HNSW
    const ivfflatIndex = await sql`
      SELECT indexdef FROM pg_indexes
      WHERE indexname = 'embeddings_embedding_idx'
    `;

    if (ivfflatIndex.length > 0) {
      const def = ivfflatIndex[0].indexdef as string;
      if (def.includes("ivfflat")) {
        // Drop the IVFFlat index — it causes terrible recall with default probes=1
        await sql`DROP INDEX IF EXISTS embeddings_embedding_idx`;
        console.log("Dropped IVFFlat index (caused low recall)");
      }
    }

    // Create HNSW index if it doesn't exist
    const hnswExists = await sql`
      SELECT 1 FROM pg_indexes
      WHERE indexname = 'embeddings_embedding_idx'
    `;

    if (hnswExists.length === 0) {
      await sql`
        CREATE INDEX embeddings_embedding_idx
        ON embeddings
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
      `;
      console.log("Created HNSW index on embeddings (m=16, ef_construction=64)");
    }

    // Ensure tenant_id index exists for filtered searches
    const tenantIndexExists = await sql`
      SELECT 1 FROM pg_indexes
      WHERE indexname = 'embeddings_tenant_id_idx'
    `;

    if (tenantIndexExists.length === 0) {
      await sql`
        CREATE INDEX embeddings_tenant_id_idx ON embeddings (tenant_id)
      `;
      console.log("Created tenant_id index on embeddings");
    }

    // Ensure unique constraint includes tenant_id (multi-tenancy safety)
    // If old constraint exists without tenant_id, migrate it
    const oldConstraint = await sql`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'embeddings'::regclass
        AND contype = 'u'
        AND conname = 'embeddings_entity_type_entity_id_key'
    `;
    if (oldConstraint.length > 0) {
      // Check if it's the old 2-column constraint
      const colCount = await sql`
        SELECT array_length(conkey, 1) as cols
        FROM pg_constraint
        WHERE conname = 'embeddings_entity_type_entity_id_key'
      `;
      if (colCount[0]?.cols === 2) {
        await sql`ALTER TABLE embeddings DROP CONSTRAINT embeddings_entity_type_entity_id_key`;
        await sql`ALTER TABLE embeddings ADD CONSTRAINT embeddings_tenant_entity_unique UNIQUE (tenant_id, entity_type, entity_id)`;
        console.log("Migrated unique constraint to include tenant_id");
      }
    }
  } catch (error) {
    // Don't crash if index creation fails — it's an optimization
    console.warn("Vector index setup:", error instanceof Error ? error.message : error);
  } finally {
    await sql.end();
  }
}
