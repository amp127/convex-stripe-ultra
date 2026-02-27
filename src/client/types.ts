import type {
  GenericActionCtx,
  GenericMutationCtx,
  GenericDataModel,
  GenericQueryCtx,
} from "convex/server";

export type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
export type MutationCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;
export type ActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation" | "runAction"
>;

/** Connect account creation params (passed to createConnectAccount params). */
export type CreateConnectAccountParams = {
  controller?: {
    fees?: { payer: "application" | "account" };
    losses?: { payments: "application" | "stripe" };
    stripe_dashboard?: { type: "express" | "full" };
  };
  [key: string]: unknown;
};

/** Connect account link creation params (passed to createConnectAccountLink params). */
export type CreateConnectAccountLinkParams = {
  collection_options?: { fields?: "currently_due" | "eventually_due" };
  [key: string]: unknown;
};

/**
 * Minimal Stripe webhook event shape (avoids direct stripe package dependency).
 * For full Stripe types, install the stripe package and extend as needed.
 */
export type StripeEvent = { type: string; [key: string]: unknown };

/**
 * Handler function for a specific Stripe webhook event.
 * Receives the action context and the Stripe event object.
 */
export type StripeEventHandler<T extends string = string> = (
  ctx: GenericActionCtx<GenericDataModel>,
  event: StripeEvent & { type: T },
) => Promise<void>;

/**
 * Map of event types to their handlers.
 * Users can provide handlers for any Stripe webhook event type.
 */
export type StripeEventHandlers = Record<string, StripeEventHandler>;


/**
 * Configuration for webhook registration.
 */
export type RegisterRoutesConfig = {
  /**
   * Optional webhook path. Defaults to "/stripe/webhook"
   */
  webhookPath?: string;

  /**
   * Optional event handlers that run after default processing.
   * The component will handle database syncing automatically,
   * and then call your custom handlers.
   */
  events?: StripeEventHandlers;

  /**
   * Optional generic event handler that runs for all events.
   * This runs after default processing and before specific event handlers.
   */
  onEvent?: StripeEventHandler;
  /**
   * Stripe webhook secret for signature verification.
   * Defaults to process.env.STRIPE_ACCOUNT_WEBHOOK_SECRET
   */
  STRIPE_ACCOUNT_WEBHOOK_SECRET?: string;

  /**
   * Stripe secret key for API calls.
   * Defaults to process.env.STRIPE_SECRET_KEY
   */
  STRIPE_SECRET_KEY?: string;

  /**
   * Stripe connect webhook secret for signature verification.
   */

  STRIPE_CONNECT_WEBHOOK_SECRET?: string;
};