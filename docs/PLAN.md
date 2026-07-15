# Share Cart — Development Plan

A Shopify app that lets a shopper share their cart as a link. Opening the link
rebuilds that exact cart for the recipient, replacing whatever they had.

**Status:** planning. Nothing built yet beyond the stock Shopify React Router template.

## Locked decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Language | TypeScript | Production app; cart snapshot shapes and webhook bodies are worth typing. |
| Hosting | Vercel | Serverless; drives the Prisma/cron/cold-start constraints below. |
| Database | Supabase Postgres via Prisma | Replaces the template's SQLite. |
| Share surfaces (v1) | Cart page + AJAX cart drawer | Thank-you page deferred to Phase 5. Checkout page dropped. |

## Architecture

### Redeem via App Proxy, not cart permalink

Share links point at the store's own domain and are proxied to us:

```
https://shop.com/apps/share-cart/c/A7fK2p   ->   our /proxy/c/:code route
```

Because the page is served from the storefront origin, the cart cookie applies, so
our page can call `/cart/clear.js` then `/cart/add.js` and produce an exact
reproduction of the sender's cart.

Shopify's native cart permalink (`/cart/12345:2,67890:1`) is rejected as the primary
mechanism: it drops line-item properties, selling plans, and discount codes, and it
*merges* into the existing cart rather than replacing it — which contradicts the
core requirement. Retained only as a no-JS fallback.

The proxy page is real HTML we control, so it carries Open Graph tags. A link pasted
into WhatsApp or iMessage unfurls with product imagery and a total. This is the app's
growth surface and the reason we do not render the redeem page as a bare Liquid response.

### End-to-end flow

1. Shopper clicks Share. The theme extension reads `/cart.js` **at click time** (never
   trusts cached state) and POSTs to `/apps/share-cart/api/create`.
2. Server validates and snapshots the cart, mints a short code, returns the URL.
3. Recipient opens the link. We render a preview, verify each variant is still
   purchasable, then clear + rebuild the cart and redirect to `/cart`.
4. The restored cart carries attribute `_sc_code`. When it becomes an order, the
   `orders/create` webhook reads the attribute and credits revenue to that share.

Step 4 is the commercial core. Without attribution this is a feature; with it, it's a
dashboard that tells a merchant sharing drove $8,400 last month.

### Constraints discovered

- **App proxy prefix/subpath are merchant-customizable and immutable per install.**
  Never hardcode `/apps/share-cart` when building links. Store each shop's actual
  prefix/subpath on the Shop record at install and construct URLs from that.
- App proxies require the `write_app_proxy` scope and one proxy route per app.
- Proxy requests are HMAC-signed; authenticate with `authenticate.public.appProxy`.
- Public storefront endpoints (create + redeem) are callable by anyone. They need rate
  limiting, payload caps, and a max-items-per-share limit.

### Vercel-specific constraints

- Prisma against Supabase's transaction pooler (port 6543) with
  `connection_limit=1&pgbouncer=true`; `DIRECT_URL` on 5432 for migrations.
- No long-running process: expiry cleanup and analytics rollups run on Vercel Cron or
  Supabase `pg_cron`.
- Cold starts land on the redeem path — the one request a *shopper* waits on. Keep that
  loader to a single indexed query; no Admin API calls in the hot path.
- Needs the `@vercel/react-router` preset, which the Shopify template does not ship with.

## Data model

```
Shop          shopDomain, accessScopes, proxyPrefix, proxySubpath, plan,
              installedAt, uninstalledAt
ShopSettings  buttonLabel, buttonStyle, placement, expiryDays, autoRestore,
              incentiveDiscountCode, maxItemsPerShare
SharedCart    code (unique per shop), shopId, itemsJson, currency, subtotalSnapshot,
              note, discountCodes, attributes, expiresAt, revokedAt,
              counters(opened / restored / converted / revenue)
ShareEvent    sharedCartId, type, channel, country, createdAt
WebhookLog    webhookId  -- idempotency
Session       -- Shopify's, moved from SQLite to Postgres
```

`itemsJson` holds variant ID + quantity + properties + selling plan. **No customer PII**
— no emails, no addresses.

**Privacy caveat:** line-item *properties* can legitimately contain personal data (a gift
message, an engraved name). GDPR redaction must reach into that field. Mitigation: hard-expire
shared carts (default 30 days) so the data largely deletes itself.

## Scopes

`write_app_proxy`, `read_products`, `read_orders`.

`read_orders` requires **protected customer data access** approval in the Partner dashboard.
It gates Phase 4 and can take days — start the request during Phase 0.

## Feature set

**v1 must-have**
- Share button on cart page *and* in AJAX cart drawers (most modern themes never navigate to `/cart`).
- Copy link, native share sheet, direct WhatsApp / Email / SMS targets.
- Branded preview page with OG unfurl.
- Honest handling of items that went out of stock, were deleted, or changed price between
  share and open. The top source of one-star reviews in this app category.
- Merchant admin: enable/disable, button text and colour, placement, link expiry.

**High value, differentiating**
- Conversion analytics and revenue attribution (shares → opens → restores → orders → $).
- QR code on the share modal — converts a desktop cart to a phone cart; the killer feature
  for in-store, showroom, and wholesale reps.
- Incentive on redeem: auto-apply a discount when a shared cart is opened. Turns sharing
  into a referral loop; natural paid-tier feature.
- Merchant-built carts: a rep assembles a cart in the admin and sends the link. A whole
  B2B/clienteling use case on infrastructure we already have.
- Thank-you-page share ("show your haul") — the moment of peak enthusiasm.

**Deliberately deferred**
- Sharing from the checkout page: constrained (checkout UI extensions, placement limits on
  non-Plus plans) and psychologically wrong — nobody stops mid-payment to share. Replaced by
  the Thank-you page.
- Collaborative real-time carts. Large scope, niche demand.
- Save-for-later / wishlist. Same infrastructure, but a second product. Don't dilute v1.

## Phases

**Phase 0 — Foundations (~1 day)**
Convert template to TypeScript. Prisma SQLite → Supabase Postgres (pooled + direct URLs).
Session storage to Postgres. `@vercel/react-router` preset. Env validation, structured
logging, error boundaries. Wire the app proxy and confirm a signed request round-trips.
Kick off the protected-customer-data request.

**Phase 1 — Core share loop (~3–4 days)**
The described workflow, working end to end: theme app extension share button (cart block +
drawer-compatible embed), create endpoint, code generation, snapshot, redeem page,
clear-and-rebuild, redirect to cart. Not pretty. Proves the mechanism.

**Phase 2 — Make it not break (~3 days)**
Unavailable/deleted/out-of-stock handling with an explicit "2 of 5 items are no longer
available" screen rather than a silently wrong cart. Expiry. Permalink fallback. OG tags and
dynamic preview image. Rate limiting and payload caps. Theme compatibility passes against
Dawn plus two or three popular paid themes.

**Phase 3 — Merchant admin (~3 days)**
Polaris dashboard: settings, share list, onboarding checklist, theme-extension-enabled
detection. This is what a reviewer sees first and what a merchant judges in ten seconds.

**Phase 4 — Analytics & attribution (~2–3 days)**
`orders/create` webhook, cart-attribute stamping, funnel metrics, top-shared products.
Blocked on protected-customer-data approval.

**Phase 5 — Growth features (~4 days)**
QR codes, incentive discounts, merchant-built carts, Thank-you-page share.

**Phase 6 — Production hardening (~3–4 days)**
Mandatory GDPR webhooks (`customers/data_request`, `customers/redact`, `shop/redact` — the
App Store rejects without them). Billing (Shopify Managed Pricing is the low-effort path).
Sentry, uptime monitoring, load test on the redeem path, listing assets, privacy policy.

Roughly 3–4 weeks of focused work to a submittable app. Phases 0–2 alone produce something
demoable in under a week.
