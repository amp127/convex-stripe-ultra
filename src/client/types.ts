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
