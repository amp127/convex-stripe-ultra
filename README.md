# @convex-dev/stripe

A Convex component for integrating Stripe payments, subscriptions, and billing into your Convex app. Built on [@raideno/convex-stripe](https://github.com/raideno/convex-stripe), following [Theo's Stripe Recommendations](https://github.com/t3dotgg/stripe-recommendations).

## Features

- **Subscriptions** - Create subscription checkouts via `stripe.subscribe`
- **One-time payments** - Create payment checkouts via `stripe.pay`
- **Customer portal** - Let users manage billing via `stripe.portal`
- **Stripe Connect** - Create connected accounts and onboarding links
- **Webhook sync** - Automatic sync of Stripe data to Convex tables (24 tables)
- **Entity-based** - Use `entityId` (userId, orgId, etc.) for customers
- **Seat-based pricing** - Update subscription quantities
- **Pre-built queries** - List subscriptions, payments, invoices by user/org

## Two Ways to Use

### Option A: Direct package usage (recommended for most apps)

Use `@raideno/convex-stripe` (or `@convex-dev/stripe/server`) directly—no component. Full control, minimal abstraction.

### Option B: Component + StripeSubscriptions client

Use the Convex component for a higher-level `StripeSubscriptions` client and pre-built queries. Best when you want a drop-in API.

---

## Quick Start (Direct Usage)

### 1. Install

```bash
npm install @convex-dev/stripe stripe
# or: npm install @raideno/convex-stripe stripe
```

### 2. Schema

Add `stripeTables` to your Convex schema:

```ts
// convex/schema.ts
import { defineSchema } from "convex/server";
import { stripeTables } from "@raideno/convex-stripe/server";

export default defineSchema({
  ...stripeTables,
  // your other tables...
});
```

### 3. Stripe init

Create `convex/stripeInit.ts`:

```ts
import { internalConvexStripe, syncAllTables } from "@raideno/convex-stripe/server";

export const { stripe, store, sync } = internalConvexStripe({
  stripe: {
    secret_key: process.env.STRIPE_SECRET_KEY!,
    account_webhook_secret: process.env.STRIPE_ACCOUNT_WEBHOOK_SECRET!,
    // Optional, for Stripe Connect:
    ...(process.env.STRIPE_CONNECT_WEBHOOK_SECRET && {
      connect_webhook_secret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    }),
  },
  sync: {
    tables: syncAllTables(),
  },
});
```

### 4. HTTP routes

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { stripe } from "./stripeInit";

const http = httpRouter();
stripe.addHttpRoutes(http);

export default http;
```

### 5. Environment variables

In Convex Dashboard → Settings → Environment Variables:

| Variable                         | Description                                      |
| -------------------------------- | ------------------------------------------------ |
| `STRIPE_SECRET_KEY`              | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_ACCOUNT_WEBHOOK_SECRET`  | Webhook signing secret (`whsec_...`)              |
| `STRIPE_CONNECT_WEBHOOK_SECRET`  | (Optional) Connect webhook secret                |

### 6. Stripe setup

1. [Stripe webhooks](https://dashboard.stripe.com/test/webhooks): add endpoint  
   `https://<your-deployment>.convex.site/stripe/webhook`
2. Enable required events (see [Synced Events](#synced-events) below).
3. Enable [Stripe Billing Portal](https://dashboard.stripe.com/test/settings/billing/portal).

### 7. Run sync (one-time)

In Convex Dashboard → Functions, run the `sync` action with `{ tables: true }` to backfill existing Stripe data.

### 8. Use in your app

```ts
// convex/stripe.ts
import { action } from "./_generated/server";
import { stripe } from "./stripeInit";
import { v } from "convex/values";

// Create a Stripe customer when a user is created (e.g. in auth callback)
export const createCustomer = action({
  args: { entityId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const customer = await stripe.customers.create(ctx, {
      entityId: args.entityId,
      email: args.email,
    });
    return customer.customerId;
  },
});

// Subscription checkout
export const createSubscriptionCheckout = action({
  args: { entityId: v.string(), priceId: v.string() },
  handler: async (ctx, args) => {
    const session = await stripe.subscribe(ctx, {
      entityId: args.entityId,
      priceId: args.priceId,
      mode: "subscription",
      success_url: "https://example.com/success",
      cancel_url: "https://example.com/cancel",
    });
    return session.url;
  },
});

// One-time payment
export const createPaymentCheckout = action({
  args: { entityId: v.string(), orderId: v.string(), priceId: v.string() },
  handler: async (ctx, args) => {
    const session = await stripe.pay(ctx, {
      entityId: args.entityId,
      referenceId: args.orderId,
      mode: "payment",
      line_items: [{ price: args.priceId, quantity: 1 }],
      success_url: "https://example.com/success",
      cancel_url: "https://example.com/cancel",
    });
    return session.url;
  },
});

// Customer portal
export const openPortal = action({
  args: { entityId: v.string() },
  handler: async (ctx, args) => {
    const session = await stripe.portal(ctx, {
      entityId: args.entityId,
      return_url: "https://example.com/account",
    });
    return session.url;
  },
});
```

Query the synced tables directly:

```ts
import { query } from "./_generated/server";

export const getUserSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const customer = await ctx.db
      .query("stripeCustomers")
      .withIndex("byEntityId", (q) => q.eq("entityId", identity.subject))
      .first();
    if (!customer) return [];

    return await ctx.db
      .query("stripeSubscriptions")
      .withIndex("byCustomerId", (q) => q.eq("customerId", customer.customerId))
      .collect();
  },
});
```

---

## Quick Start (Component Mode)

### 1. Install and add component

```bash
npm install @convex-dev/stripe stripe
```

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import stripe from "@convex-dev/stripe/convex.config.js";

const app = defineApp();
app.use(stripe);

export default app;
```

### 2. Schema and HTTP

The component brings `stripeTables` into your app. You still need to register webhook routes. Use the package's server init in your app:

```ts
// convex/stripeInit.ts – same as direct usage above
import { internalConvexStripe, syncAllTables } from "@convex-dev/stripe/server";

export const { stripe, store, sync } = internalConvexStripe({
  stripe: {
    secret_key: process.env.STRIPE_SECRET_KEY!,
    account_webhook_secret: process.env.STRIPE_ACCOUNT_WEBHOOK_SECRET!,
  },
  sync: { tables: syncAllTables() },
});
```

```ts
// convex/schema.ts – add stripeTables if not using component's merged schema
// The component merges its schema; add your own tables here.
import { defineSchema } from "convex/server";

export default defineSchema({
  // your tables...
});
```

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { stripe } from "./stripeInit";

const http = httpRouter();
stripe.addHttpRoutes(http);
export default http;
```

### 3. Use StripeSubscriptions client

```ts
// convex/stripe.ts
import { action } from "./_generated/server";
import { components } from "./_generated/api";
import { StripeSubscriptions } from "@convex-dev/stripe";
import { v } from "convex/values";

const stripeClient = new StripeSubscriptions(components.stripe);

export const createSubscriptionCheckout = action({
  args: { priceId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email,
      name: identity.name,
    });

    return await stripeClient.createCheckoutSession(ctx, {
      entityId: identity.subject,
      priceId: args.priceId,
      mode: "subscription",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });
  },
});
```

### 4. Component public queries

```ts
import { query } from "./_generated/server";
import { components } from "./_generated/api";

export const getUserSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.runQuery(
      components.stripe.public.listSubscriptionsByUserId,
      { userId: identity.subject },
    );
  },
});
```

---

## API Reference

### StripeSubscriptions (component mode)

| Method                       | Description                                            |
| ---------------------------- | ------------------------------------------------------ |
| `createCheckoutSession()`    | Create a Stripe Checkout session (subscription/payment) |
| `createCustomerPortalSession()` | Open the Stripe Customer Portal                      |
| `createCustomer()`           | Create a Stripe customer                               |
| `getOrCreateCustomer()`      | Get or create a Stripe customer                        |
| `cancelSubscription()`       | Cancel a subscription                                  |
| `reactivateSubscription()`   | Reactivate a subscription set to cancel                 |
| `updateSubscriptionQuantity()` | Update seat count for a subscription                 |
| `createConnectAccount()`     | Create a Stripe Connect account                        |
| `createConnectAccountLink()` | Create an onboarding link for a Connect account        |

### Component public queries

| Query                       | Args                  | Description                     |
| --------------------------- | --------------------- | ------------------------------- |
| `getCustomer`               | `stripeCustomerId`    | Customer by Stripe ID           |
| `getCustomerByEmail`        | `email`               | Customer by email               |
| `getCustomerByUserId`       | `userId`              | Customer by entityId            |
| `listSubscriptions`        | `stripeCustomerId`    | Subscriptions for a customer    |
| `listSubscriptionsByUserId` | `userId`              | Subscriptions for a user        |
| `listSubscriptionsByOrgId` | `orgId`               | Subscriptions for an org        |
| `getSubscription`          | `stripeSubscriptionId`| Subscription by ID              |
| `getSubscriptionByOrgId`   | `orgId`               | Subscription for an org         |
| `getPayment`               | `stripePaymentIntentId`| Payment by ID                   |
| `listPayments`              | `stripeCustomerId`    | Payments for a customer         |
| `listPaymentsByUserId`     | `userId`              | Payments for a user             |
| `listPaymentsByOrgId`      | `orgId`               | Payments for an org             |
| `listInvoices`             | `stripeCustomerId`    | Invoices for a customer        |
| `listInvoicesByUserId`     | `userId`              | Invoices for a user            |
| `listInvoicesByOrgId`      | `orgId`               | Invoices for an org            |
| `getCheckoutSession`       | `stripeCheckoutSessionId` | Checkout session by ID      |
| `listCheckoutSessions`     | `stripeCustomerId`    | Checkout sessions for a customer |

### Package API (direct usage)

- `stripe.customers.create` – Create/get customer by entityId  
- `stripe.subscribe` – Create subscription checkout  
- `stripe.pay` – Create one-time payment checkout  
- `stripe.portal` – Open billing portal  
- `stripe.accounts.create` – Create Connect account  
- `stripe.accounts.link` – Create Connect onboarding link  
- `stripe.client` – Raw Stripe SDK client  
- `stripe.addHttpRoutes` – Register webhook and redirect routes  

See [@raideno/convex-stripe](https://github.com/raideno/convex-stripe) for full API details.

---

## Synced tables (24)

The library syncs Stripe data into Convex tables such as:

`stripeCustomers`, `stripeSubscriptions`, `stripeProducts`, `stripePrices`, `stripeInvoices`, `stripePaymentIntents`, `stripeCheckoutSessions`, `stripeCoupons`, `stripePromotionCodes`, `stripeRefunds`, `stripeCharges`, `stripePaymentMethods`, `stripeAccounts` (Connect), and others.

## Synced events

Webhooks handle events for subscriptions, customers, invoices, payment intents, checkout sessions, products, prices, charges, refunds, and more. See the [package docs](https://github.com/raideno/convex-stripe) for the full list.

---

## Example app

The [`example/`](./example) directory contains a full demo that uses the direct package approach (no component):

```bash
git clone https://github.com/amp127/convex-stripe-ultra
cd convex-stripe-ultra
npm install
cd example && npm install
npm run dev
```

The example includes one-time payments, subscriptions, user profile with order history, subscription management, customer portal, and team/org billing.

---

## Exports

| Export             | Use case                                  |
| ------------------ | ----------------------------------------- |
| `@convex-dev/stripe` | `StripeSubscriptions` client (component mode) |
| `@convex-dev/stripe/server` | `internalConvexStripe`, `stripeTables`, `syncAllTables`, etc. |
| `@convex-dev/stripe/convex.config.js` | Convex component (component mode)       |

---

## Troubleshooting

- **Tables empty after checkout** – Confirm `STRIPE_SECRET_KEY` and `STRIPE_ACCOUNT_WEBHOOK_SECRET` are set, webhook URL is correct, and required events are enabled. Run `sync` with `{ tables: true }`.
- **Webhooks failing** – Verify webhook URL (`https://<deployment>.convex.site/stripe/webhook`) and the signing secret in Stripe.
- **"Not authenticated"** – Ensure your auth provider and `auth.config.ts` are configured.

---

## License

Apache-2.0
