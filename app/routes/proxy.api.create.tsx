import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { createShareSchema, generateCode } from "../lib/share.server";

// Called from the storefront share button. Shopify signs the proxy request; we snapshot
// the cart and hand back a link.
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = createShareSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const share = await prisma.sharedCart.create({
    data: {
      code: generateCode(),
      shop: session.shop,
      items: parsed.data.items,
    },
  });

  // Build the link on the shop's own domain, NOT request.url -- a proxied request reaches
  // the app at the tunnel/app URL, so request.url's origin is the tunnel, not the storefront.
  const link = `https://${session.shop}/apps/share-cart/c/${share.code}`;

  return Response.json({ code: share.code, url: link });
}
