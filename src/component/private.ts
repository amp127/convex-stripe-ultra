/**
 * Internal exports for the Stripe component.
 * Used by the host app to register webhook routes that persist events via store.
 */
export { store } from "./stripe.js";

import { v } from "convex/values";
import { internalMutation } from "./_generated/server.js";

/**
 * Test-only: Seeds a customer. Replaces old handleCustomerCreated for unit tests.
 */
export const handleCustomerCreated = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    metadata: v.optional(v.any()),
    entityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stripeCustomers")
      .withIndex("byStripeId", (q) => q.eq("customerId", args.stripeCustomerId))
      .unique();
    const stripe = {
      object: "customer",
      id: args.stripeCustomerId,
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      balance: 0,
      email: args.email ?? null,
      name: args.name ?? null,
      metadata: (args.metadata as Record<string, string>) ?? null,
    };
    if (existing) {
      await ctx.db.patch(existing._id, { stripe });
    } else {
      await ctx.db.insert("stripeCustomers", {
        customerId: args.stripeCustomerId,
        entityId: args.entityId,
        stripe,
        lastSyncedAt: Date.now(),
      });
    }
  },
});

/**
 * Test-only: Seeds a subscription. Replaces old handleSubscriptionCreated for unit tests.
 */
export const handleSubscriptionCreated = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    status: v.string(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    quantity: v.optional(v.number()),
    priceId: v.string(),
    metadata: v.optional(v.any()),
    cancelAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stripeSubscriptions")
      .withIndex("byStripeId", (q) =>
        q.eq("subscriptionId", args.stripeSubscriptionId),
      )
      .unique();
    const periodEnd =
      args.currentPeriodEnd > 1e12
        ? Math.floor(args.currentPeriodEnd / 1000)
        : args.currentPeriodEnd;
    const stripe = {
      object: "subscription",
      id: args.stripeSubscriptionId,
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      status: args.status,
      cancel_at_period_end: args.cancelAtPeriodEnd,
      cancel_at: args.cancelAt ?? null,
      metadata: args.metadata ?? null,
      items: {
        data: [
          {
            current_period_end: periodEnd,
            quantity: args.quantity ?? 1,
            price: { id: args.priceId },
          },
        ],
      },
    };
    if (existing) {
      await ctx.db.patch(existing._id, { stripe });
    } else {
      await ctx.db.insert("stripeSubscriptions", {
        subscriptionId: args.stripeSubscriptionId,
        customerId: args.stripeCustomerId,
        stripe,
        lastSyncedAt: Date.now(),
      });
    }
  },
});

/**
 * Test-only: Seeds/updates a subscription. Replaces old handleSubscriptionUpdated for unit tests.
 */
export const handleSubscriptionUpdated = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    status: v.string(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    quantity: v.optional(v.number()),
    priceId: v.optional(v.string()),
    cancelAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stripeSubscriptions")
      .withIndex("byStripeId", (q) =>
        q.eq("subscriptionId", args.stripeSubscriptionId),
      )
      .unique();
    if (!existing) return;
    const item = (existing.stripe as any)?.items?.data?.[0] ?? {};
    const periodEnd =
      args.currentPeriodEnd > 1e12
        ? Math.floor(args.currentPeriodEnd / 1000)
        : args.currentPeriodEnd;
    const cancelAtVal =
      args.cancelAt != null
        ? args.cancelAt > 1e12
          ? Math.floor(args.cancelAt / 1000)
          : args.cancelAt
        : null;
    const cancelAtPeriodEnd =
      args.cancelAtPeriodEnd ||
      (cancelAtVal != null && cancelAtVal === periodEnd);
    const baseStripe = (existing.stripe as any) ?? {};
    const stripe = {
      ...baseStripe,
      status: args.status,
      cancel_at_period_end: cancelAtPeriodEnd,
      cancel_at: cancelAtVal,
      metadata: args.metadata ?? baseStripe.metadata,
      items: {
        data: [
          {
            ...item,
            current_period_end: periodEnd,
            quantity: args.quantity ?? item?.quantity ?? 1,
            price: { id: args.priceId ?? item?.price?.id ?? "" },
          },
        ],
      },
    };
    await ctx.db.patch(existing._id, { stripe });
  },
});

/**
 * Test-only: Seeds a payment. Replaces old handlePaymentIntentSucceeded for unit tests.
 */
export const handlePaymentIntentSucceeded = internalMutation({
  args: {
    stripePaymentIntentId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    status: v.string(),
    created: v.number(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stripePaymentIntents")
      .withIndex("byStripeId", (q) =>
        q.eq("paymentIntentId", args.stripePaymentIntentId),
      )
      .unique();
    const created =
      args.created > 1e12 ? Math.floor(args.created / 1000) : args.created;
    const stripe = {
      object: "payment_intent",
      id: args.stripePaymentIntentId,
      created,
      livemode: false,
      status: args.status as "succeeded" | "canceled" | "processing",
      amount: args.amount,
      currency: args.currency,
      payment_method_types: ["card"],
      setup_future_usage: null,
      amount_capturable: 0,
      amount_received: args.amount,
      capture_method: "automatic" as const,
      confirmation_method: "automatic" as const,
      excluded_payment_method_types: null,
      customer: args.stripeCustomerId ?? null,
      metadata: (args.metadata as Record<string, string>) ?? null,
    };
    if (existing) {
      await ctx.db.patch(existing._id, {
        stripe: { ...(existing.stripe as object), ...stripe } as typeof existing.stripe,
      });
    } else {
      await ctx.db.insert("stripePaymentIntents", {
        paymentIntentId: args.stripePaymentIntentId,
        stripe: stripe as any,
        lastSyncedAt: Date.now(),
      });
    }
  },
});

/**
 * Test-only: Updates a payment's customer. Replaces old updatePaymentCustomer for unit tests.
 */
export const updatePaymentCustomer = internalMutation({
  args: {
    stripePaymentIntentId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stripePaymentIntents")
      .withIndex("byStripeId", (q) =>
        q.eq("paymentIntentId", args.stripePaymentIntentId),
      )
      .unique();
    if (!existing) return;
    const stripe = existing.stripe as { customer?: string };
    if (stripe?.customer) return;
    await ctx.db.patch(existing._id, {
      stripe: { ...(existing.stripe as object), customer: args.stripeCustomerId } as typeof existing.stripe,
    });
  },
});
