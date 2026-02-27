import {
  internalConvexStripe,
  syncAllTables,
} from "@raideno/convex-stripe/server";

export const { stripe, store, sync } = internalConvexStripe({
  stripe: {
    secret_key: process.env.STRIPE_SECRET_KEY ?? 'default',
    account_webhook_secret: process.env.STRIPE_ACCOUNT_WEBHOOK_SECRET ?? 'default',
    ...(process.env.STRIPE_CONNECT_WEBHOOK_SECRET && {
      connect_webhook_secret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET ?? 'default',
    }),
  },
  sync: {
    tables: syncAllTables(),
  },
});
