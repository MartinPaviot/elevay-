/**
 * Connection-graph persistence (_specs/CONNECTION-GRAPH).
 *
 * Thin Drizzle wrappers — the only place the feature touches the DB. The
 * LOGIC they feed (resolution, overlay, warm-path) is pure and unit-tested
 * elsewhere; these wrappers mirror proven query patterns and are covered
 * by tsc + the gated Inngest job that calls them. DORMANT: reached only
 * via the flag-gated, unregistered job and the gated API route.
 *
 * Every query is tenant- AND owner-scoped (the graph is personal).
 */

import { db } from "@/db";
import {
  companies,
  connectionEdges,
  linkedinAccounts,
  warmPaths,
} from "@/db/schema";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import type { CompanyCandidate, ConnectionEdge, NetworkDistance } from "./types";
import type { AccountWarmPath } from "./build-warm-paths";

/** Candidate companies for in-run resolution. Integration note: for large
 * tenants, build a domain/name index from this once per run rather than a
 * linear find per relation. */
export async function loadCompanyCandidates(
  tenantId: string,
): Promise<CompanyCandidate[]> {
  return db
    .select({ id: companies.id, name: companies.name, domain: companies.domain })
    .from(companies)
    .where(eq(companies.tenantId, tenantId));
}

/** The connected LinkedIn account for an owner (the job's entry point). */
export async function getConnectedAccount(ownerUserId: string) {
  const [row] = await db
    .select()
    .from(linkedinAccounts)
    .where(eq(linkedinAccounts.userId, ownerUserId))
    .limit(1);
  return row ?? null;
}

/** Upsert a batch of edges, keyed on (owner_user_id, person_external_id). */
export async function upsertConnectionEdges(
  edges: ConnectionEdge[],
  linkedinAccountId: string,
): Promise<void> {
  if (edges.length === 0) return;
  await db
    .insert(connectionEdges)
    .values(
      edges.map((e) => ({
        tenantId: e.tenantId,
        ownerUserId: e.ownerUserId,
        linkedinAccountId,
        personExternalId: e.personExternalId,
        personName: e.personName,
        personHeadline: e.personHeadline,
        rawCompanyName: e.rawCompanyName,
        rawCompanyDomain: e.rawCompanyDomain,
        resolvedCompanyId: e.resolvedCompanyId,
        networkDistance: e.networkDistance,
        sharedConnectionsCount: e.sharedConnectionsCount,
        source: e.source,
      })),
    )
    .onConflictDoUpdate({
      target: [connectionEdges.ownerUserId, connectionEdges.personExternalId],
      set: {
        personName: sql`excluded.person_name`,
        personHeadline: sql`excluded.person_headline`,
        rawCompanyName: sql`excluded.raw_company_name`,
        rawCompanyDomain: sql`excluded.raw_company_domain`,
        resolvedCompanyId: sql`excluded.resolved_company_id`,
        networkDistance: sql`excluded.network_distance`,
        sharedConnectionsCount: sql`excluded.shared_connections_count`,
        updatedAt: new Date(),
      },
    });
}

/** Persist the ingestion resume cursor + last-synced stamp. */
export async function saveAccountCursor(
  linkedinAccountId: string,
  cursor: string | null,
): Promise<void> {
  await db
    .update(linkedinAccounts)
    .set({ syncCursor: cursor, lastSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(linkedinAccounts.id, linkedinAccountId));
}

/** Load an owner's edges as domain objects (for warm-path rebuild). */
export async function loadOwnerEdges(
  ownerUserId: string,
  tenantId: string,
): Promise<ConnectionEdge[]> {
  const rows = await db
    .select()
    .from(connectionEdges)
    .where(
      and(
        eq(connectionEdges.ownerUserId, ownerUserId),
        eq(connectionEdges.tenantId, tenantId),
      ),
    );
  return rows.map((r) => ({
    ownerUserId: r.ownerUserId,
    tenantId: r.tenantId,
    personExternalId: r.personExternalId,
    personName: r.personName,
    personHeadline: r.personHeadline,
    rawCompanyName: r.rawCompanyName,
    rawCompanyDomain: r.rawCompanyDomain,
    resolvedCompanyId: r.resolvedCompanyId,
    networkDistance: r.networkDistance as NetworkDistance,
    sharedConnectionsCount: r.sharedConnectionsCount,
    source: r.source,
  }));
}

export interface WarmAssetRow {
  personExternalId: string;
  personName: string;
  personHeadline: string | null;
  companyId: string;
  companyName: string;
  fitScore: number;
  icpId: string | null;
}

/** The "you're connected to N people at ICP accounts" overlay, read from
 * the DB: first-degree edges joined to ICP-fit companies (score mirrors
 * the primary-ICP fit). Ranked by fit. */
export async function getIcpOverlay(
  ownerUserId: string,
  tenantId: string,
  minFit = 0.5,
): Promise<WarmAssetRow[]> {
  const rows = await db
    .select({
      personExternalId: connectionEdges.personExternalId,
      personName: connectionEdges.personName,
      personHeadline: connectionEdges.personHeadline,
      companyId: companies.id,
      companyName: companies.name,
      score: companies.score,
      primaryIcpId: sql<string | null>`${companies.properties}->>'primaryIcpId'`,
    })
    .from(connectionEdges)
    .innerJoin(companies, eq(connectionEdges.resolvedCompanyId, companies.id))
    .where(
      and(
        eq(connectionEdges.ownerUserId, ownerUserId),
        eq(connectionEdges.tenantId, tenantId),
        eq(connectionEdges.networkDistance, "first"),
        isNotNull(connectionEdges.resolvedCompanyId),
        gte(companies.score, minFit * 100),
      ),
    )
    .orderBy(sql`${companies.score} desc nulls last`);

  return rows.map((r) => ({
    personExternalId: r.personExternalId,
    personName: r.personName,
    personHeadline: r.personHeadline,
    companyId: r.companyId,
    companyName: r.companyName,
    fitScore: (r.score ?? 0) / 100,
    icpId: r.primaryIcpId ?? null,
  }));
}

/** Materialise (owner, account) insider warm paths. */
export async function upsertWarmPaths(
  tenantId: string,
  ownerUserId: string,
  paths: AccountWarmPath[],
): Promise<void> {
  if (paths.length === 0) return;
  await db
    .insert(warmPaths)
    .values(
      paths.map((p) => ({
        tenantId,
        ownerUserId,
        companyId: p.companyId,
        kind: p.warmPath.kind,
        strength: p.warmPath.strength,
        connectorCount: p.warmPath.connectors.length,
        evidence: {
          connectors: p.warmPath.connectors.map((c) => ({
            personExternalId: c.personExternalId,
            personName: c.personName,
          })),
        },
      })),
    )
    .onConflictDoUpdate({
      target: [warmPaths.ownerUserId, warmPaths.companyId],
      set: {
        kind: sql`excluded.kind`,
        strength: sql`excluded.strength`,
        connectorCount: sql`excluded.connector_count`,
        evidence: sql`excluded.evidence`,
        computedAt: new Date(),
      },
    });
}
