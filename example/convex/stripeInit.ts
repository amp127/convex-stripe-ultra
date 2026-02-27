import {
  internalConvexStripe,
  syncAllTables,
} from "@raideno/convex-stripe/server";

export const { stripe, store, sync } = internalConvexStripe({
  stripe: {
    secret_key: process.env.STRIPE_SECRET_KEY!,
    account_webhook_secret: process.env.STRIPE_ACCOUNT_WEBHOOK_SECRET!,
  },
  sync: {
    tables: syncAllTables(),
  },
});
