/**
 * Benji's Store - Stripe Integration
 *
 * Uses @raideno/convex-stripe directly: stripe init in stripeInit.ts,
 * HTTP routes in http.ts (stripe.addHttpRoutes), and this file for app actions/queries.
 */

import { action, query } from "./_generated/server";
import { api } from "./_generated/api";
import { stripe } from "./stripeInit";
import { v } from "convex/values";

function getAppUrl(): string {
  const url = process.env.APP_URL;
  if (!url) {
    throw new Error(
      "APP_URL environment variable is not set. Add it in your Convex dashboard.",
    );
  }
  return url;
}

// ============================================================================
// CUSTOMER MANAGEMENT
// ============================================================================

export const getOrCreateCustomer = action({
  args: {},
  returns: v.object({
    customerId: v.string(),
    isNew: v.boolean(),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const customer = await stripe.customers.create(ctx, {
      entityId: identity.subject,
      email: identity.email ?? undefined,
      name: identity.name ?? undefined,
    });
    return { customerId: customer.customerId, isNew: true };
  },
});

// ============================================================================
// CHECKOUT SESSIONS
// ============================================================================

export const createSubscriptionCheckout = action({
  args: {
    priceId: v.string(),
    quantity: v.optional(v.number()),
  },
  returns: v.object({
    sessionId: v.string(),
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const session = await stripe.subscribe(ctx, {
      entityId: identity.subject,
      priceId: args.priceId,
      mode: "subscription",
      success_url: `${getAppUrl()}/?success=true`,
      cancel_url: `${getAppUrl()}/?canceled=true`,
      subscription_data: { metadata: { userId: identity.subject } },
    });
    return { sessionId: session.id, url: session.url };
  },
});

export const createTeamSubscriptionCheckout = action({
  args: {
    priceId: v.string(),
    orgId: v.string(),
    quantity: v.optional(v.number()),
  },
  returns: v.object({
    sessionId: v.string(),
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const session = await stripe.subscribe(ctx, {
      entityId: identity.subject,
      priceId: args.priceId,
      mode: "subscription",
      success_url: `${getAppUrl()}/?success=true&org=${args.orgId}`,
      cancel_url: `${getAppUrl()}/?canceled=true`,
      subscription_data: {
        metadata: { userId: identity.subject, orgId: args.orgId },
      },
    });
    return { sessionId: session.id, url: session.url };
  },
});

export const createPaymentCheckout = action({
  args: {
    priceId: v.string(),
  },
  returns: v.object({
    sessionId: v.string(),
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const session = await stripe.pay(ctx, {
      entityId: identity.subject,
      referenceId: `payment-${identity.subject}-${Date.now()}`,
      mode: "payment",
      line_items: [{ price: args.priceId, quantity: 1 }],
      success_url: `${getAppUrl()}/?success=true`,
      cancel_url: `${getAppUrl()}/?canceled=true`,
      metadata: { userId: identity.subject },
    });
    return { sessionId: session.id, url: session.url };
  },
});

// ============================================================================
// SEAT-BASED PRICING
// ============================================================================

export const updateSeats = action({
  args: {
    subscriptionId: v.string(),
    seatCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const subscription = await stripe.client.subscriptions.retrieve(
      args.subscriptionId,
    );
    const item = subscription.items?.data?.[0];
    if (!item) throw new Error("Subscription has no items");

    const metadata = subscription.metadata as Record<string, string> | null;
    if (metadata?.userId !== identity.subject) {
      throw new Error("Subscription not found or access denied");
    }

    await stripe.client.subscriptionItems.update(item.id, {
      quantity: args.seatCount,
    });
    return null;
  },
});

// ============================================================================
// ORGANIZATION-BASED LOOKUPS
// ============================================================================

export const getOrgSubscription = query({
  args: { orgId: v.string() },
  returns: v.union(
    v.object({
      stripeSubscriptionId: v.string(),
      stripeCustomerId: v.string(),
      status: v.string(),
      priceId: v.string(),
      quantity: v.optional(v.number()),
      currentPeriodEnd: v.number(),
      cancelAtPeriodEnd: v.boolean(),
      metadata: v.optional(v.any()),
      userId: v.optional(v.string()),
      orgId: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const subs = await ctx.db.query("stripeSubscriptions").collect();
    const sub = subs.find(
      (s) => (s.stripe?.metadata as Record<string, string> | undefined)?.orgId === args.orgId,
    );
    if (!sub?.subscriptionId) return null;
    const s = sub.stripe as any;
    const item = s?.items?.data?.[0];
    return {
      stripeSubscriptionId: sub.subscriptionId,
      stripeCustomerId: sub.customerId,
      status: s?.status ?? "",
      priceId: item?.price?.id ?? "",
      quantity: item?.quantity,
      currentPeriodEnd: (item?.current_period_end as number) ?? 0,
      cancelAtPeriodEnd: Boolean(s?.cancel_at_period_end),
      metadata: s?.metadata,
      userId: (s?.metadata as Record<string, string> | undefined)?.userId,
      orgId: args.orgId,
    };
  },
});

export const getOrgPayments = query({
  args: { orgId: v.string() },
  returns: v.array(
    v.object({
      stripePaymentIntentId: v.string(),
      stripeCustomerId: v.optional(v.string()),
      amount: v.number(),
      currency: v.string(),
      status: v.string(),
      created: v.number(),
      metadata: v.optional(v.any()),
      userId: v.optional(v.string()),
      orgId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const all = await ctx.db.query("stripePaymentIntents").collect();
    return all
      .filter(
        (p) => (p.stripe?.metadata as Record<string, string> | undefined)?.orgId === args.orgId,
      )
      .map((p) => ({
        stripePaymentIntentId: p.paymentIntentId,
        stripeCustomerId: p.stripe?.customer ?? undefined,
        amount: (p.stripe?.amount as number) ?? 0,
        currency: (p.stripe?.currency as string) ?? "",
        status: (p.stripe?.status as string) ?? "",
        created: (p.stripe?.created as number) ?? 0,
        metadata: p.stripe?.metadata,
        userId: (p.stripe?.metadata as Record<string, string> | undefined)?.userId,
        orgId: args.orgId,
      }));
  },
});

export const getOrgInvoices = query({
  args: { orgId: v.string() },
  returns: v.array(
    v.object({
      stripeInvoiceId: v.string(),
      stripeCustomerId: v.string(),
      stripeSubscriptionId: v.optional(v.string()),
      status: v.string(),
      amountDue: v.number(),
      amountPaid: v.number(),
      created: v.number(),
      orgId: v.optional(v.string()),
      userId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const subs = await ctx.db.query("stripeSubscriptions").collect();
    const orgSubIds = new Set(
      subs
        .filter(
          (s) => (s.stripe?.metadata as Record<string, string> | undefined)?.orgId === args.orgId,
        )
        .map((s) => s.subscriptionId),
    );
    const all = await ctx.db.query("stripeInvoices").collect();
    const getSubId = (i: (typeof all)[number]) =>
      (i.stripe as { subscription?: string } | undefined)?.subscription;
    return all
      .filter((i) => {
        const subId = getSubId(i);
        return subId ? orgSubIds.has(subId) : false;
      })
      .map((i) => ({
        stripeInvoiceId: i.invoiceId,
        stripeCustomerId: (i.stripe?.customer as string) ?? "",
        stripeSubscriptionId: getSubId(i) ?? undefined,
        status: (i.stripe?.status as string) ?? "",
        amountDue: (i.stripe?.amount_due as number) ?? 0,
        amountPaid: (i.stripe?.amount_paid as number) ?? 0,
        created: (i.stripe?.created as number) ?? 0,
        orgId: args.orgId,
        userId: undefined as string | undefined,
      }));
  },
});

export const linkSubscriptionToOrg = action({
  args: {
    subscriptionId: v.string(),
    orgId: v.string(),
    userId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await stripe.client.subscriptions.update(args.subscriptionId, {
      metadata: {
        orgId: args.orgId,
        userId: args.userId,
        linkedAt: new Date().toISOString(),
      },
    });
    return null;
  },
});

// ============================================================================
// SUBSCRIPTION QUERIES
// ============================================================================

export const getSubscriptionInfo = query({
  args: { subscriptionId: v.string() },
  returns: v.union(
    v.object({
      stripeSubscriptionId: v.string(),
      stripeCustomerId: v.string(),
      status: v.string(),
      priceId: v.string(),
      quantity: v.optional(v.number()),
      currentPeriodEnd: v.number(),
      cancelAtPeriodEnd: v.boolean(),
      metadata: v.optional(v.any()),
      userId: v.optional(v.string()),
      orgId: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("stripeSubscriptions")
      .withIndex("byStripeId", (q) => q.eq("subscriptionId", args.subscriptionId))
      .unique();
    if (!sub?.subscriptionId) return null;
    const s = sub.stripe as any;
    const item = s?.items?.data?.[0];
    const metadata = (s?.metadata ?? {}) as Record<string, string>;
    return {
      stripeSubscriptionId: sub.subscriptionId,
      stripeCustomerId: sub.customerId,
      status: s?.status ?? "",
      priceId: item?.price?.id ?? "",
      quantity: item?.quantity,
      currentPeriodEnd: (item?.current_period_end as number) ?? 0,
      cancelAtPeriodEnd: Boolean(s?.cancel_at_period_end),
      metadata: s?.metadata,
      userId: metadata?.userId,
      orgId: metadata?.orgId,
    };
  },
});

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

export const cancelSubscription = action({
  args: {
    subscriptionId: v.string(),
    immediately: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const sub = await ctx.runQuery(api.stripe.getSubscriptionInfo, {
      subscriptionId: args.subscriptionId,
    });
    if (!sub || sub.userId !== identity.subject) {
      throw new Error("Subscription not found or access denied");
    }

    if (args.immediately) {
      await stripe.client.subscriptions.cancel(args.subscriptionId);
    } else {
      await stripe.client.subscriptions.update(args.subscriptionId, {
        cancel_at_period_end: true,
      });
    }
    return null;
  },
});

export const reactivateSubscription = action({
  args: { subscriptionId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const sub = await ctx.runQuery(api.stripe.getSubscriptionInfo, {
      subscriptionId: args.subscriptionId,
    });
    if (!sub || sub.userId !== identity.subject) {
      throw new Error("Subscription not found or access denied");
    }
    if (!sub.cancelAtPeriodEnd) {
      throw new Error("Subscription is not set to cancel");
    }

    await stripe.client.subscriptions.update(args.subscriptionId, {
      cancel_at_period_end: false,
    });
    return null;
  },
});

// ============================================================================
// CUSTOMER PORTAL
// ============================================================================

export const getCustomerPortalUrl = action({
  args: {},
  returns: v.union(v.object({ url: v.string() }), v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const session = await stripe.portal(ctx, {
      entityId: identity.subject,
      return_url: `${getAppUrl()}/`,
    });
    return session.url ? { url: session.url } : null;
  },
});

// ============================================================================
// CUSTOMER DATA
// ============================================================================

export const getCustomerData = query({
  args: { customerId: v.string() },
  returns: v.object({
    customer: v.union(
      v.object({
        stripeCustomerId: v.string(),
        email: v.optional(v.string()),
        name: v.optional(v.string()),
        metadata: v.optional(v.any()),
      }),
      v.null(),
    ),
    subscriptions: v.array(
      v.object({
        stripeSubscriptionId: v.string(),
        stripeCustomerId: v.string(),
        status: v.string(),
        priceId: v.string(),
        quantity: v.optional(v.number()),
        currentPeriodEnd: v.number(),
        cancelAtPeriodEnd: v.boolean(),
        metadata: v.optional(v.any()),
        userId: v.optional(v.string()),
        orgId: v.optional(v.string()),
      }),
    ),
    invoices: v.array(
      v.object({
        stripeInvoiceId: v.string(),
        stripeCustomerId: v.string(),
        stripeSubscriptionId: v.optional(v.string()),
        status: v.string(),
        amountDue: v.number(),
        amountPaid: v.number(),
        created: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("stripeCustomers")
      .withIndex("byStripeId", (q) => q.eq("customerId", args.customerId))
      .unique();
    const subscriptions = await ctx.db
      .query("stripeSubscriptions")
      .withIndex("byCustomerId", (q) => q.eq("customerId", args.customerId))
      .collect();
    const invoices = await ctx.db.query("stripeInvoices").collect();
    const filteredInvoices = invoices.filter(
      (i) => i.stripe?.customer === args.customerId,
    );

    return {
      customer: customer
        ? {
            stripeCustomerId: customer.customerId,
            email: customer.stripe?.email ?? undefined,
            name: customer.stripe?.name ?? undefined,
            metadata: customer.stripe?.metadata,
          }
        : null,
      subscriptions: subscriptions.map((s) => {
        const st = s.stripe as any;
        const item = st?.items?.data?.[0];
        const metadata = (st?.metadata ?? {}) as Record<string, string>;
        return {
          stripeSubscriptionId: s.subscriptionId ?? "",
          stripeCustomerId: s.customerId,
          status: st?.status ?? "",
          priceId: item?.price?.id ?? "",
          quantity: item?.quantity,
          currentPeriodEnd: (item?.current_period_end as number) ?? 0,
          cancelAtPeriodEnd: Boolean(st?.cancel_at_period_end),
          metadata: st?.metadata,
          userId: metadata?.userId,
          orgId: metadata?.orgId,
        };
      }),
      invoices: filteredInvoices.map((i) => ({
        stripeInvoiceId: i.invoiceId,
        stripeCustomerId: (i.stripe?.customer as string) ?? "",
        stripeSubscriptionId: (i.stripe as { subscription?: string })
          ?.subscription ?? undefined,
        status: (i.stripe?.status as string) ?? "",
        amountDue: (i.stripe?.amount_due as number) ?? 0,
        amountPaid: (i.stripe?.amount_paid as number) ?? 0,
        created: (i.stripe?.created as number) ?? 0,
      })),
    };
  },
});

// ============================================================================
// USER-SPECIFIC QUERIES
// ============================================================================

export const getUserSubscriptions = query({
  args: {},
  returns: v.array(
    v.object({
      stripeSubscriptionId: v.string(),
      stripeCustomerId: v.string(),
      status: v.string(),
      priceId: v.string(),
      quantity: v.optional(v.number()),
      currentPeriodEnd: v.number(),
      cancelAtPeriodEnd: v.boolean(),
      metadata: v.optional(v.any()),
      userId: v.optional(v.string()),
      orgId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const customer = await ctx.db
      .query("stripeCustomers")
      .withIndex("byEntityId", (q) => q.eq("entityId", identity.subject))
      .first();
    if (!customer) return [];

    const subs = await ctx.db
      .query("stripeSubscriptions")
      .withIndex("byCustomerId", (q) => q.eq("customerId", customer.customerId))
      .collect();
    return subs.map((s) => {
      const st = s.stripe as any;
      const item = st?.items?.data?.[0];
      const metadata = (st?.metadata ?? {}) as Record<string, string>;
      return {
        stripeSubscriptionId: s.subscriptionId ?? "",
        stripeCustomerId: s.customerId,
        status: st?.status ?? "",
        priceId: item?.price?.id ?? "",
        quantity: item?.quantity,
        currentPeriodEnd: (item?.current_period_end as number) ?? 0,
        cancelAtPeriodEnd: Boolean(st?.cancel_at_period_end),
        metadata: st?.metadata,
        userId: metadata?.userId,
        orgId: metadata?.orgId,
      };
    });
  },
});

export const getUserPayments = query({
  args: {},
  returns: v.array(
    v.object({
      stripePaymentIntentId: v.string(),
      stripeCustomerId: v.optional(v.string()),
      amount: v.number(),
      currency: v.string(),
      status: v.string(),
      created: v.number(),
      metadata: v.optional(v.any()),
      userId: v.optional(v.string()),
      orgId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const customer = await ctx.db
      .query("stripeCustomers")
      .withIndex("byEntityId", (q) => q.eq("entityId", identity.subject))
      .first();
    if (!customer) return [];

    const all = await ctx.db.query("stripePaymentIntents").collect();
    const filtered = all.filter(
      (p) => p.stripe?.customer === customer.customerId,
    );
    return filtered.map((p) => ({
      stripePaymentIntentId: p.paymentIntentId,
      stripeCustomerId: p.stripe?.customer ?? undefined,
      amount: (p.stripe?.amount as number) ?? 0,
      currency: (p.stripe?.currency as string) ?? "",
      status: (p.stripe?.status as string) ?? "",
      created: (p.stripe?.created as number) ?? 0,
      metadata: p.stripe?.metadata,
      userId: (p.stripe?.metadata as Record<string, string> | undefined)?.userId,
      orgId: (p.stripe?.metadata as Record<string, string> | undefined)?.orgId,
    }));
  },
});

export const getFailedPaymentSubscriptions = query({
  args: {},
  returns: v.array(
    v.object({
      stripeSubscriptionId: v.string(),
      stripeCustomerId: v.string(),
      status: v.string(),
      currentPeriodEnd: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const customer = await ctx.db
      .query("stripeCustomers")
      .withIndex("byEntityId", (q) => q.eq("entityId", identity.subject))
      .first();
    if (!customer) return [];

    const subs = await ctx.db
      .query("stripeSubscriptions")
      .withIndex("byCustomerId", (q) => q.eq("customerId", customer.customerId))
      .collect();
    return subs
      .filter((s) => {
        const status = (s.stripe as any)?.status;
        return status === "past_due" || status === "unpaid";
      })
      .map((s) => {
        const st = s.stripe as any;
        const item = st?.items?.data?.[0];
        return {
          stripeSubscriptionId: s.subscriptionId ?? "",
          stripeCustomerId: s.customerId,
          status: (st?.status as string) ?? "",
          currentPeriodEnd: (item?.current_period_end as number) ?? 0,
        };
      });
  },
});
