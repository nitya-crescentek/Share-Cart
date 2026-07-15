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

  const url = new URL(request.url);
  const link = `${url.origin}/apps/share-cart/c/${share.code}`;

  return Response.json({ code: share.code, url: link });
}
