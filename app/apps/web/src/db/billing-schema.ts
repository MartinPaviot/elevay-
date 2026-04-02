import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { tenants } from "./schema";

// === ENUMS ===

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
]);

export const usageEventTypeEnum = pgEnum("usage_event_type", [
  "api_call",
  "email_sent",
  "contact_enriched",
  "ai_query",
]);

// === BILLING TABLES ===

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    stripePriceId: text("stripe_price_id"),
    status: subscriptionStatusEnum("status").default("trialing"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
    trialStart: timestamp("trial_start", { withTimezone: true }),
    trialEnd: timestamp("trial_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("subscriptions_tenant_id_idx").on(table.tenantId),
    index("subscriptions_stripe_customer_idx").on(table.stripeCustomerId),
    index("subscriptions_stripe_sub_idx").on(table.stripeSubscriptionId),
  ]
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: text("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    eventType: usageEventTypeEnum("event_type").notNull(),
    count: integer("count").notNull().default(1),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("usage_events_tenant_id_idx").on(table.tenantId),
    index("usage_events_type_idx").on(table.eventType),
    index("usage_events_created_idx").on(table.createdAt),
  ]
);
