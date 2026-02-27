import type { ActionCtx, RegisterRoutesConfig, StripeEventHandlers } from "./types.js";
import type { ComponentApi } from "../component/_generated/component.js";
import type { HttpRouter } from "convex/server";
import { syncAllTables } from "@raideno/convex-stripe/server";
import { internalConvexStripe } from "@raideno/convex-stripe/server";

export type StripeComponent = ComponentApi;

/**
 * Stripe Component Client
 *
 * Provides methods for managing Stripe customers, subscriptions, payments,
 * and billing portal via the @raideno/convex-stripe package. Webhooks and
 * HTTP routes are registered with stripe.addHttpRoutes(http) from the
 * component's stripe module.
 */

export type { RegisterRoutesConfig, StripeEventHandlers };

export class StripeSubscriptions {
  private _apiKey: string;
  constructor(
    public component: StripeComponent,
    options?: {
      STRIPE_SECRET_KEY?: string;
    },
  ) {
    this._apiKey =
      options?.STRIPE_SECRET_KEY ??
      (process.env.STRIPE_SECRET_KEY ?? "");
  }
  get apiKey() {
    if (!this._apiKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    return this._apiKey;
  }

  /**
   * Update subscription quantity (for seat-based pricing).
   * Delegates to the component action; Stripe and DB stay in sync via webhooks.
   */
  async updateSubscriptionQuantity(
    ctx: ActionCtx,
    args: {
      stripeSubscriptionId: string;
      quantity: number;
    },
  ) {
    await ctx.runAction(this.component.public.updateSubscriptionQuantity, {
      stripeSubscriptionId: args.stripeSubscriptionId,
      quantity: args.quantity,
    });
    return null;
  }

  /**
   * Cancel a subscription either immediately or at period end.
   * Delegates to the component action; Stripe and DB stay in sync via webhooks.
   */
  async cancelSubscription(
    ctx: ActionCtx,
    args: {
      stripeSubscriptionId: string;
      cancelAtPeriodEnd?: boolean;
    },
  ) {
    await ctx.runAction(this.component.public.cancelSubscription, {
      stripeSubscriptionId: args.stripeSubscriptionId,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
    });
    return null;
  }

  /**
   * Reactivate a subscription that was set to cancel at period end.
   * Delegates to the component action.
   */
  async reactivateSubscription(
    ctx: ActionCtx,
    args: { stripeSubscriptionId: string },
  ) {
    await ctx.runAction(this.component.public.reactivateSubscription, {
      stripeSubscriptionId: args.stripeSubscriptionId,
    });
    return null;
  }

  /**
   * Create a Stripe Checkout session for subscription or one-time payment.
   * Uses entityId (e.g. userId or orgId) for customer lookup/creation.
   */
  async createCheckoutSession(
    ctx: ActionCtx,
    args: {
      entityId: string;
      priceId: string;
      mode: "payment" | "subscription" | "setup";
      successUrl: string;
      cancelUrl: string;
      quantity?: number;
      metadata?: Record<string, string>;
      subscriptionMetadata?: Record<string, string>;
      paymentIntentMetadata?: Record<string, string>;
      /** For mode "payment": reference ID (e.g. order ID). */
      referenceId?: string;
    },
  ) {
    if (args.mode === "subscription") {
      const result = await ctx.runAction(this.component.public.subscribe, {
        entityId: args.entityId,
        priceId: args.priceId,
        successUrl: args.successUrl,
        cancelUrl: args.cancelUrl,
        quantity: args.quantity,
        metadata: args.metadata,
        subscriptionData: args.subscriptionMetadata
          ? { metadata: args.subscriptionMetadata }
          : undefined,
      });
      return { sessionId: result.sessionId, url: result.url };
    }
    if (args.mode === "payment") {
      const result = await ctx.runAction(this.component.public.pay, {
        entityId: args.entityId,
        referenceId: args.referenceId ?? args.entityId,
        lineItems: [{ price: args.priceId, quantity: args.quantity ?? 1 }],
        successUrl: args.successUrl,
        cancelUrl: args.cancelUrl,
        metadata: args.paymentIntentMetadata ?? args.metadata,
      });
      return { sessionId: result.sessionId, url: result.url };
    }
    throw new Error(
      "createCheckoutSession with mode 'setup' is not supported; use Stripe API directly if needed.",
    );
  }

  /**
   * Create or get a Stripe customer for the given entity.
   * Returns the Stripe customer ID.
   */
  async createCustomer(
    ctx: ActionCtx,
    args: {
      entityId: string;
      email?: string;
      name?: string;
      metadata?: Record<string, string>;
    },
  ) {
    const customerId = await ctx.runAction(
      this.component.public.createOrUpdateCustomer,
      {
        entityId: args.entityId,
        email: args.email,
        name: args.name,
        metadata: args.metadata,
      },
    );
    return { customerId };
  }

  /**
   * Get or create a Stripe customer for a user (entityId = userId).
   */
  async getOrCreateCustomer(
    ctx: ActionCtx,
    args: {
      userId: string;
      email?: string;
      name?: string;
    },
  ) {
    const existingByUserId = await ctx.runQuery(
      this.component.public.getCustomerByUserId,
      { userId: args.userId },
    );
    if (existingByUserId) {
      return {
        customerId: existingByUserId.stripeCustomerId,
        isNew: false,
      };
    }

    if (args.email) {
      const existingByEmail = await ctx.runQuery(
        this.component.public.getCustomerByEmail,
        { email: args.email },
      );
      if (existingByEmail) {
        return {
          customerId: existingByEmail.stripeCustomerId,
          isNew: false,
        };
      }
    }

    const existingSubs = await ctx.runQuery(
      this.component.public.listSubscriptionsByUserId,
      { userId: args.userId },
    );
    if (existingSubs.length > 0) {
      return {
        customerId: existingSubs[0].stripeCustomerId,
        isNew: false,
      };
    }

    const existingPayments = await ctx.runQuery(
      this.component.public.listPaymentsByUserId,
      { userId: args.userId },
    );
    if (existingPayments.length > 0 && existingPayments[0].stripeCustomerId) {
      return {
        customerId: existingPayments[0].stripeCustomerId,
        isNew: false,
      };
    }

    const customerId = await ctx.runAction(
      this.component.public.createOrUpdateCustomer,
      {
        entityId: args.userId,
        email: args.email,
        name: args.name,
        metadata: { userId: args.userId },
      },
    );
    return { customerId, isNew: true };
  }

  /**
   * Create a Stripe Customer Portal session (manage subscription, payment methods).
   * Uses entityId (e.g. userId).
   */
  async createCustomerPortalSession(
    ctx: ActionCtx,
    args: { entityId: string; returnUrl: string },
  ) {
    const result = await ctx.runAction(this.component.public.portal, {
      entityId: args.entityId,
      returnUrl: args.returnUrl,
    });
    return { url: result.url };
  }

  /**
   * Create a Stripe Connect account for a seller (Connect).
   */
  async createConnectAccount(
    ctx: ActionCtx,
    args: {
      entityId: string;
      email?: string;
      params?: Record<string, unknown>;
    },
  ) {
    const account = await ctx.runAction(
      this.component.public.createConnectAccount,
      {
        entityId: args.entityId,
        email: args.email,
        params: args.params,
      },
    );
    return account;
  }

  /**
   * Create a Stripe Connect Account Link for onboarding (Connect).
   */
  async createConnectAccountLink(
    ctx: ActionCtx,
    args: {
      accountId: string;
      refreshUrl: string;
      returnUrl: string;
      failureUrl?: string;
      type?: "account_onboarding" | "account_update";
      params?: Record<string, unknown>;
    },
  ) {
    const result = await ctx.runAction(
      this.component.public.createConnectAccountLink,
      {
        accountId: args.accountId,
        refreshUrl: args.refreshUrl,
        returnUrl: args.returnUrl,
        failureUrl: args.failureUrl,
        type: args.type,
        params: args.params,
      },
    );
    return { url: result.url };
  }
}

export default StripeSubscriptions;


export function registerRoutes(
  http: HttpRouter,
  config?: RegisterRoutesConfig,
) {

  const { stripe } = internalConvexStripe({
    stripe: {
      secret_key: config?.STRIPE_SECRET_KEY ?? '',
      account_webhook_secret: config?.STRIPE_ACCOUNT_WEBHOOK_SECRET ?? '',
      ...(process.env.STRIPE_CONNECT_WEBHOOK_SECRET && {
        connect_webhook_secret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
      }),
    },
    sync: {
      tables: syncAllTables(),
    },
  });


  stripe.addHttpRoutes(http);
  return http;
}
