"use node";

import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server.js";
import { stripe } from "./stripe.js";

// ============================================================================
// VALIDATOR HELPERS (legacy-shaped return types for backward compatibility)
// ============================================================================

const customerReturnValidator = v.union(
  v.object({
    stripeCustomerId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    metadata: v.optional(v.any()),
    userId: v.optional(v.string()),
  }),
  v.null(),
);

const subscriptionShape = v.object({
  stripeSubscriptionId: v.string(),
  stripeCustomerId: v.string(),
  status: v.string(),
  currentPeriodEnd: v.number(),
  cancelAtPeriodEnd: v.boolean(),
  cancelAt: v.optional(v.number()),
  quantity: v.optional(v.number()),
  priceId: v.string(),
  metadata: v.optional(v.any()),
  orgId: v.optional(v.string()),
  userId: v.optional(v.string()),
});

const subscriptionReturnValidator = v.union(subscriptionShape, v.null());

const paymentShape = v.object({
  stripePaymentIntentId: v.string(),
  stripeCustomerId: v.optional(v.string()),
  amount: v.number(),
  currency: v.string(),
  status: v.string(),
  created: v.number(),
  metadata: v.optional(v.any()),
  orgId: v.optional(v.string()),
  userId: v.optional(v.string()),
});

const paymentReturnValidator = v.union(paymentShape, v.null());

const invoiceShape = v.object({
  stripeInvoiceId: v.string(),
  stripeCustomerId: v.string(),
  stripeSubscriptionId: v.optional(v.string()),
  status: v.string(),
  amountDue: v.number(),
  amountPaid: v.number(),
  created: v.number(),
  orgId: v.optional(v.string()),
  userId: v.optional(v.string()),
});

const invoiceReturnValidator = v.union(invoiceShape, v.null());

const checkoutSessionShape = v.object({
  stripeCheckoutSessionId: v.string(),
  stripeCustomerId: v.optional(v.string()),
  status: v.string(),
  mode: v.string(),
  metadata: v.optional(v.any()),
});

const checkoutSessionReturnValidator = v.union(
  checkoutSessionShape,
  v.null(),
);

function mapCustomerDoc(doc: {
  customerId: string;
  entityId?: string;
  stripe?: { email?: string | null; name?: string | null; metadata?: Record<string, string | number | null> | null };
} | null) {
  if (!doc) return null;
  const metadata = (doc.stripe?.metadata ?? {}) as Record<string, string>;
  return {
    stripeCustomerId: doc.customerId,
    email: doc.stripe?.email ?? undefined,
    name: doc.stripe?.name ?? undefined,
    metadata: doc.stripe?.metadata ?? undefined,
    userId: doc.entityId ?? metadata?.userId,
  };
}

function mapSubscriptionDoc(doc: {
  subscriptionId: string | null;
  customerId: string;
  stripe?: any;
} | null) {
  if (!doc || !doc.subscriptionId) return null;
  const s = doc.stripe;
  const item = s?.items?.data?.[0];
  const metadata = (s?.metadata ?? {}) as Record<string, string>;
  return {
    stripeSubscriptionId: doc.subscriptionId,
    stripeCustomerId: doc.customerId,
    status: (s?.status as string) ?? "unknown",
    currentPeriodEnd: (item?.current_period_end as number) ?? 0,
    cancelAtPeriodEnd: Boolean(s?.cancel_at_period_end),
    cancelAt: (s?.cancel_at as number) ?? undefined,
    quantity: (item?.quantity as number) ?? undefined,
    priceId: (item?.price?.id as string) ?? "",
    metadata: s?.metadata,
    orgId: metadata?.orgId,
    userId: metadata?.userId,
  };
}

function mapPaymentDoc(doc: {
  paymentIntentId: string;
  stripe?: { customer?: string | null; amount?: number; currency?: string | null; status?: string; created?: number; metadata?: Record<string, string | number | null> | null };
} | null) {
  if (!doc) return null;
  const metadata = (doc.stripe?.metadata ?? {}) as Record<string, string>;
  return {
    stripePaymentIntentId: doc.paymentIntentId,
    stripeCustomerId: doc.stripe?.customer ?? undefined,
    amount: doc.stripe?.amount ?? 0,
    currency: (doc.stripe?.currency as string) ?? "",
    status: (doc.stripe?.status as string) ?? "",
    created: (doc.stripe?.created as number) ?? 0,
    metadata: doc.stripe?.metadata,
    orgId: metadata?.orgId,
    userId: metadata?.userId,
  };
}

function mapInvoiceDoc(
  doc: {
    invoiceId: string;
    stripe?: Record<string, unknown> & {
      customer?: string;
      subscription?: string | null;
      status?: string;
      amount_due?: number;
      amount_paid?: number;
      created?: number;
    };
  } | null,
  subscriptionMetadata?: { orgId?: string; userId?: string },
) {
  if (!doc) return null;
  return {
    stripeInvoiceId: doc.invoiceId,
    stripeCustomerId: (doc.stripe?.customer as string) ?? "",
    stripeSubscriptionId: (doc.stripe?.subscription as string) ?? undefined,
    status: (doc.stripe?.status as string) ?? "",
    amountDue: (doc.stripe?.amount_due as number) ?? 0,
    amountPaid: (doc.stripe?.amount_paid as number) ?? 0,
    created: (doc.stripe?.created as number) ?? 0,
    orgId: subscriptionMetadata?.orgId,
    userId: subscriptionMetadata?.userId,
  };
}

function mapCheckoutSessionDoc(
  doc: {
    checkoutSessionId: string;
    stripe?: {
      customer?: string | null;
      status?: string | null;
      mode?: string;
      metadata?: Record<string, string | number | null> | null;
    };
  } | null,
) {
  if (!doc) return null;
  return {
    stripeCheckoutSessionId: doc.checkoutSessionId,
    stripeCustomerId: doc.stripe?.customer ?? undefined,
    status: doc.stripe?.status ?? "",
    mode: (doc.stripe?.mode as string) ?? "payment",
    metadata: doc.stripe?.metadata ?? undefined,
  };
}

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * Get a customer by their Stripe customer ID.
 */
export const getCustomer = query({
  args: { stripeCustomerId: v.string() },
  returns: customerReturnValidator,
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("stripeCustomers")
      .withIndex("byStripeId", (q) => q.eq("customerId", args.stripeCustomerId))
      .unique();
    return mapCustomerDoc(customer);
  },
});

/**
 * Get a customer by their email address.
 */
export const getCustomerByEmail = query({
  args: { email: v.string() },
  returns: customerReturnValidator,
  handler: async (ctx, args) => {
    const all = await ctx.db.query("stripeCustomers").collect();
    const customer = all.find((c) => c.stripe?.email === args.email) ?? null;
    return mapCustomerDoc(customer);
  },
});

/**
 * Get a customer by their user ID (entityId).
 */
export const getCustomerByUserId = query({
  args: { userId: v.string() },
  returns: customerReturnValidator,
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("stripeCustomers")
      .withIndex("byEntityId", (q) => q.eq("entityId", args.userId))
      .first();
    return mapCustomerDoc(customer);
  },
});

/**
 * Get a subscription by its Stripe subscription ID.
 */
export const getSubscription = query({
  args: { stripeSubscriptionId: v.string() },
  returns: subscriptionReturnValidator,
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("stripeSubscriptions")
      .withIndex("byStripeId", (q) =>
        q.eq("subscriptionId", args.stripeSubscriptionId),
      )
      .unique();
    return mapSubscriptionDoc(subscription);
  },
});

/**
 * List all subscriptions for a customer.
 */
export const listSubscriptions = query({
  args: { stripeCustomerId: v.string() },
  returns: v.array(subscriptionShape),
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("stripeSubscriptions")
      .withIndex("byCustomerId", (q) =>
        q.eq("customerId", args.stripeCustomerId),
      )
      .collect();
    return subscriptions
      .map((s) => mapSubscriptionDoc(s))
      .filter((x): x is NonNullable<ReturnType<typeof mapSubscriptionDoc>> => x != null);
  },
});

/**
 * Get a subscription by organization ID (via metadata).
 */
export const getSubscriptionByOrgId = query({
  args: { orgId: v.string() },
  returns: subscriptionReturnValidator,
  handler: async (ctx, args) => {
    const all = await ctx.db.query("stripeSubscriptions").collect();
    const sub = all.find(
      (s) => (s.stripe?.metadata as Record<string, string> | undefined)?.orgId === args.orgId,
    );
    return mapSubscriptionDoc(sub ?? null);
  },
});

/**
 * List all subscriptions for an organization ID.
 */
export const listSubscriptionsByOrgId = query({
  args: { orgId: v.string() },
  returns: v.array(subscriptionShape),
  handler: async (ctx, args) => {
    const all = await ctx.db.query("stripeSubscriptions").collect();
    const filtered = all.filter(
      (s) => (s.stripe?.metadata as Record<string, string> | undefined)?.orgId === args.orgId,
    );
    return filtered
      .map((s) => mapSubscriptionDoc(s))
      .filter((x): x is NonNullable<ReturnType<typeof mapSubscriptionDoc>> => x != null);
  },
});

/**
 * List all subscriptions for a user ID (entityId); two-step via customer.
 */
export const listSubscriptionsByUserId = query({
  args: { userId: v.string() },
  returns: v.array(subscriptionShape),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("stripeCustomers")
      .withIndex("byEntityId", (q) => q.eq("entityId", args.userId))
      .first();
    if (!customer) return [];
    const subscriptions = await ctx.db
      .query("stripeSubscriptions")
      .withIndex("byCustomerId", (q) => q.eq("customerId", customer.customerId))
      .collect();
    return subscriptions
      .map((s) => mapSubscriptionDoc(s))
      .filter((x): x is NonNullable<ReturnType<typeof mapSubscriptionDoc>> => x != null);
  },
});

/**
 * Get a payment by its Stripe payment intent ID.
 */
export const getPayment = query({
  args: { stripePaymentIntentId: v.string() },
  returns: paymentReturnValidator,
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("stripePaymentIntents")
      .withIndex("byStripeId", (q) =>
        q.eq("paymentIntentId", args.stripePaymentIntentId),
      )
      .unique();
    return mapPaymentDoc(payment);
  },
});

/**
 * List payments for a customer.
 */
export const listPayments = query({
  args: { stripeCustomerId: v.string() },
  returns: v.array(paymentShape),
  handler: async (ctx, args) => {
    const all = await ctx.db.query("stripePaymentIntents").collect();
    const filtered = all.filter(
      (p) => p.stripe?.customer === args.stripeCustomerId,
    );
    return filtered
      .map((p) => mapPaymentDoc(p))
      .filter((x): x is NonNullable<ReturnType<typeof mapPaymentDoc>> => x != null);
  },
});

/**
 * List payments for a user ID (via customer lookup and metadata).
 */
export const listPaymentsByUserId = query({
  args: { userId: v.string() },
  returns: v.array(paymentShape),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("stripeCustomers")
      .withIndex("byEntityId", (q) => q.eq("entityId", args.userId))
      .first();
    if (!customer) return [];
    const all = await ctx.db.query("stripePaymentIntents").collect();
    const filtered = all.filter(
      (p) => p.stripe?.customer === customer.customerId,
    );
    return filtered
      .map((p) => mapPaymentDoc(p))
      .filter((x): x is NonNullable<ReturnType<typeof mapPaymentDoc>> => x != null);
  },
});

/**
 * List payments for an organization ID (metadata).
 */
export const listPaymentsByOrgId = query({
  args: { orgId: v.string() },
  returns: v.array(paymentShape),
  handler: async (ctx, args) => {
    const all = await ctx.db.query("stripePaymentIntents").collect();
    const filtered = all.filter(
      (p) => (p.stripe?.metadata as Record<string, string> | undefined)?.orgId === args.orgId,
    );
    return filtered
      .map((p) => mapPaymentDoc(p))
      .filter((x): x is NonNullable<ReturnType<typeof mapPaymentDoc>> => x != null);
  },
});

/**
 * List invoices for a customer.
 */
export const listInvoices = query({
  args: { stripeCustomerId: v.string() },
  returns: v.array(invoiceShape),
  handler: async (ctx, args) => {
    const all = await ctx.db.query("stripeInvoices").collect();
    const filtered = all.filter(
      (i) => i.stripe?.customer === args.stripeCustomerId,
    );
    return filtered
      .map((i) => mapInvoiceDoc(i))
      .filter((x): x is NonNullable<ReturnType<typeof mapInvoiceDoc>> => x != null);
  },
});

/**
 * List invoices for an organization ID (via subscription metadata).
 */
export const listInvoicesByOrgId = query({
  args: { orgId: v.string() },
  returns: v.array(invoiceShape),
  handler: async (ctx, args) => {
    const subs = await ctx.db.query("stripeSubscriptions").collect();
    const bySubId = new Map(
      subs
        .filter(
          (s) => (s.stripe?.metadata as Record<string, string> | undefined)?.orgId === args.orgId,
        )
        .map((s) => [s.subscriptionId, { orgId: args.orgId, userId: undefined as string | undefined }]),
    );
    const all = await ctx.db.query("stripeInvoices").collect();
    const getSubId = (i: (typeof all)[number]) =>
      (i.stripe as { subscription?: string } | undefined)?.subscription;
    const filtered = all.filter((i) => {
      const subId = getSubId(i);
      return subId ? bySubId.has(subId) : false;
    });
    return filtered
      .map((i) =>
        mapInvoiceDoc(i, getSubId(i) ? bySubId.get(getSubId(i)!) : undefined),
      )
      .filter((x): x is NonNullable<ReturnType<typeof mapInvoiceDoc>> => x != null);
  },
});

/**
 * List invoices for a user ID (via customer and subscription metadata).
 */
export const listInvoicesByUserId = query({
  args: { userId: v.string() },
  returns: v.array(invoiceShape),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("stripeCustomers")
      .withIndex("byEntityId", (q) => q.eq("entityId", args.userId))
      .first();
    if (!customer) return [];
    const all = await ctx.db.query("stripeInvoices").collect();
    const filtered = all.filter(
      (i) => i.stripe?.customer === customer.customerId,
    );
    return filtered
      .map((i) => mapInvoiceDoc(i, { userId: args.userId }))
      .filter((x): x is NonNullable<ReturnType<typeof mapInvoiceDoc>> => x != null);
  },
});

/**
 * Get a checkout session by its Stripe checkout session ID.
 */
export const getCheckoutSession = query({
  args: { stripeCheckoutSessionId: v.string() },
  returns: checkoutSessionReturnValidator,
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("stripeCheckoutSessions")
      .withIndex("byStripeId", (q) =>
        q.eq("checkoutSessionId", args.stripeCheckoutSessionId),
      )
      .unique();
    return mapCheckoutSessionDoc(session);
  },
});

/**
 * List checkout sessions for a customer.
 */
export const listCheckoutSessions = query({
  args: { stripeCustomerId: v.string() },
  returns: v.array(checkoutSessionShape),
  handler: async (ctx, args) => {
    const all = await ctx.db.query("stripeCheckoutSessions").collect();
    const filtered = all.filter(
      (s) => s.stripe?.customer === args.stripeCustomerId,
    );
    return filtered
      .map((s) => mapCheckoutSessionDoc(s))
      .filter((x): x is NonNullable<ReturnType<typeof mapCheckoutSessionDoc>> => x != null);
  },
});

// ============================================================================
// PUBLIC MUTATIONS
// ============================================================================

/**
 * Update subscription metadata (orgId/userId and custom metadata) via Stripe API.
 */
export const updateSubscriptionMetadata = action({
  args: {
    stripeSubscriptionId: v.string(),
    metadata: v.any(),
    orgId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const metadata = {
      ...(typeof args.metadata === "object" && args.metadata !== null
        ? args.metadata
        : {}),
      ...(args.orgId !== undefined && { orgId: args.orgId }),
      ...(args.userId !== undefined && { userId: args.userId }),
    };
    await stripe.client.subscriptions.update(args.stripeSubscriptionId, {
      metadata,
    });
    return null;
  },
});

// ============================================================================
// PUBLIC ACTIONS
// ============================================================================

/**
 * Create or get a Stripe customer for the given entity (delegates to package).
 * Returns the Stripe customer ID.
 */
export const createOrUpdateCustomer = action({
  args: {
    entityId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const customer = await stripe.customers.create(ctx, {
      entityId: args.entityId,
      email: args.email,
      name: args.name,
      metadata: args.metadata as Record<string, string> | undefined,
    });
    return customer.customerId;
  },
});

/**
 * Update subscription quantity (seat-based pricing). Updates Stripe and DB via webhook.
 */
export const updateSubscriptionQuantity = action({
  args: {
    stripeSubscriptionId: v.string(),
    quantity: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const subscription = await stripe.client.subscriptions.retrieve(
      args.stripeSubscriptionId,
    );
    const item = subscription.items?.data?.[0];
    if (!item) {
      throw new Error("Subscription has no items");
    }
    await stripe.client.subscriptionItems.update(item.id, {
      quantity: args.quantity,
    });
    return null;
  },
});

/**
 * Create a Stripe Checkout session for subscription (delegates to package).
 */
export const subscribe = action({
  args: {
    entityId: v.string(),
    priceId: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string(),
    failureUrl: v.optional(v.string()),
    quantity: v.optional(v.number()),
    metadata: v.optional(v.any()),
    subscriptionData: v.optional(v.any()),
  },
  returns: v.object({
    url: v.union(v.string(), v.null()),
    sessionId: v.string(),
  }),
  handler: async (ctx, args) => {
    const session = await stripe.subscribe(ctx, {
      entityId: args.entityId,
      priceId: args.priceId,
      mode: "subscription",
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      failure_url: args.failureUrl,
      metadata: args.metadata as Record<string, string> | undefined,
      subscription_data: args.subscriptionData as Record<string, unknown> | undefined,
    });
    return { url: session.url, sessionId: session.id };
  },
});

/**
 * Create a Stripe Checkout session for one-time payment (delegates to package).
 */
export const pay = action({
  args: {
    entityId: v.string(),
    referenceId: v.string(),
    lineItems: v.array(
      v.object({
        price: v.string(),
        quantity: v.optional(v.number()),
      }),
    ),
    successUrl: v.string(),
    cancelUrl: v.string(),
    failureUrl: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.object({
    url: v.union(v.string(), v.null()),
    sessionId: v.string(),
  }),
  handler: async (ctx, args) => {
    const session = await stripe.pay(ctx, {
      entityId: args.entityId,
      referenceId: args.referenceId,
      mode: "payment",
      line_items: args.lineItems.map((item) => ({
        price: item.price,
        quantity: item.quantity ?? 1,
      })),
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      failure_url: args.failureUrl,
      metadata: args.metadata as Record<string, string> | undefined,
    });
    return { url: session.url, sessionId: session.id };
  },
});

/**
 * Create a Stripe Billing Portal session (delegates to package).
 */
export const portal = action({
  args: {
    entityId: v.string(),
    returnUrl: v.string(),
    failureUrl: v.optional(v.string()),
  },
  returns: v.object({ url: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const session = await stripe.portal(ctx, {
      entityId: args.entityId,
      return_url: args.returnUrl,
      failure_url: args.failureUrl,
    });
    return { url: session.url };
  },
});

/**
 * Create a Stripe Connect account (delegates to package).
 */
export const createConnectAccount = action({
  args: {
    entityId: v.string(),
    email: v.optional(v.string()),
    params: v.optional(v.any()),
  },
  returns: v.object({
    accountId: v.string(),
    _id: v.id("stripeAccounts"),
  }),
  handler: async (ctx, args) => {
    const account = await stripe.accounts.create(ctx, {
      entityId: args.entityId,
      email: args.email,
      ...(args.params as object),
    });
    return { accountId: account.accountId, _id: account._id };
  },
});

/**
 * Create a Stripe Connect Account Link for onboarding (delegates to package).
 */
export const createConnectAccountLink = action({
  args: {
    accountId: v.string(),
    refreshUrl: v.string(),
    returnUrl: v.string(),
    failureUrl: v.optional(v.string()),
    type: v.optional(v.string()),
    params: v.optional(v.any()),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const link = await stripe.accounts.link(ctx, {
      account: args.accountId,
      refresh_url: args.refreshUrl,
      return_url: args.returnUrl,
      failure_url: args.failureUrl,
      type: (args.type as "account_onboarding" | "account_update") ?? "account_onboarding",
      ...(args.params as object),
    });
    return { url: link.url };
  },
});
