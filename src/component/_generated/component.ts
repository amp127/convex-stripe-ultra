/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    public: {
      cancelSubscription: FunctionReference<
        "action",
        "internal",
        { cancelAtPeriodEnd?: boolean; stripeSubscriptionId: string },
        null,
        Name
      >;
      createConnectAccount: FunctionReference<
        "action",
        "internal",
        { email?: string; entityId: string; params?: any },
        { _id: string; accountId: string },
        Name
      >;
      createConnectAccountLink: FunctionReference<
        "action",
        "internal",
        {
          accountId: string;
          failureUrl?: string;
          params?: any;
          refreshUrl: string;
          returnUrl: string;
          type?: string;
        },
        { url: string },
        Name
      >;
      createOrUpdateCustomer: FunctionReference<
        "action",
        "internal",
        { email?: string; entityId: string; metadata?: any; name?: string },
        string,
        Name
      >;
      getCheckoutSession: FunctionReference<
        "query",
        "internal",
        { stripeCheckoutSessionId: string },
        {
          metadata?: any;
          mode: string;
          status: string;
          stripeCheckoutSessionId: string;
          stripeCustomerId?: string;
        } | null,
        Name
      >;
      getCustomer: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
          userId?: string;
        } | null,
        Name
      >;
      getCustomerByEmail: FunctionReference<
        "query",
        "internal",
        { email: string },
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
          userId?: string;
        } | null,
        Name
      >;
      getCustomerByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        {
          email?: string;
          metadata?: any;
          name?: string;
          stripeCustomerId: string;
          userId?: string;
        } | null,
        Name
      >;
      getPayment: FunctionReference<
        "query",
        "internal",
        { stripePaymentIntentId: string },
        {
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        } | null,
        Name
      >;
      getSubscription: FunctionReference<
        "query",
        "internal",
        { stripeSubscriptionId: string },
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        } | null,
        Name
      >;
      getSubscriptionByOrgId: FunctionReference<
        "query",
        "internal",
        { orgId: string },
        {
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        } | null,
        Name
      >;
      listCheckoutSessions: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          metadata?: any;
          mode: string;
          status: string;
          stripeCheckoutSessionId: string;
          stripeCustomerId?: string;
        }>,
        Name
      >;
      listInvoices: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          amountDue: number;
          amountPaid: number;
          created: number;
          orgId?: string;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
          userId?: string;
        }>,
        Name
      >;
      listInvoicesByOrgId: FunctionReference<
        "query",
        "internal",
        { orgId: string },
        Array<{
          amountDue: number;
          amountPaid: number;
          created: number;
          orgId?: string;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
          userId?: string;
        }>,
        Name
      >;
      listInvoicesByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          amountDue: number;
          amountPaid: number;
          created: number;
          orgId?: string;
          status: string;
          stripeCustomerId: string;
          stripeInvoiceId: string;
          stripeSubscriptionId?: string;
          userId?: string;
        }>,
        Name
      >;
      listPayments: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        }>,
        Name
      >;
      listPaymentsByOrgId: FunctionReference<
        "query",
        "internal",
        { orgId: string },
        Array<{
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        }>,
        Name
      >;
      listPaymentsByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          amount: number;
          created: number;
          currency: string;
          metadata?: any;
          orgId?: string;
          status: string;
          stripeCustomerId?: string;
          stripePaymentIntentId: string;
          userId?: string;
        }>,
        Name
      >;
      listSubscriptions: FunctionReference<
        "query",
        "internal",
        { stripeCustomerId: string },
        Array<{
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        }>,
        Name
      >;
      listSubscriptionsByOrgId: FunctionReference<
        "query",
        "internal",
        { orgId: string },
        Array<{
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        }>,
        Name
      >;
      listSubscriptionsByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          cancelAt?: number;
          cancelAtPeriodEnd: boolean;
          currentPeriodEnd: number;
          metadata?: any;
          orgId?: string;
          priceId: string;
          quantity?: number;
          status: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
          userId?: string;
        }>,
        Name
      >;
      pay: FunctionReference<
        "action",
        "internal",
        {
          cancelUrl: string;
          entityId: string;
          failureUrl?: string;
          lineItems: Array<{ price: string; quantity?: number }>;
          metadata?: any;
          referenceId: string;
          successUrl: string;
        },
        { sessionId: string; url: string | null },
        Name
      >;
      portal: FunctionReference<
        "action",
        "internal",
        { entityId: string; failureUrl?: string; returnUrl: string },
        { url: string | null },
        Name
      >;
      reactivateSubscription: FunctionReference<
        "action",
        "internal",
        { stripeSubscriptionId: string },
        null,
        Name
      >;
      subscribe: FunctionReference<
        "action",
        "internal",
        {
          cancelUrl: string;
          entityId: string;
          failureUrl?: string;
          metadata?: any;
          priceId: string;
          quantity?: number;
          subscriptionData?: any;
          successUrl: string;
        },
        { sessionId: string; url: string | null },
        Name
      >;
      updateSubscriptionMetadata: FunctionReference<
        "action",
        "internal",
        {
          metadata: any;
          orgId?: string;
          stripeSubscriptionId: string;
          userId?: string;
        },
        null,
        Name
      >;
      updateSubscriptionQuantity: FunctionReference<
        "action",
        "internal",
        { quantity: number; stripeSubscriptionId: string },
        null,
        Name
      >;
    };
  };
