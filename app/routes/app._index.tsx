import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import type { HeadersArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const shares = await prisma.sharedCart.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    shares: shares.map((share) => ({
      code: share.code,
      itemCount: Array.isArray(share.items) ? share.items.length : 0,
      createdAt: share.createdAt.toISOString(),
    })),
  };
}

export default function Index() {
  const { shares } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Share cart">
      <s-section heading="How to use">
        <s-paragraph>
          Add the <b>Share cart</b> block to your cart page in the theme editor.
          Shoppers can then share their cart as a link that loads the same items
          for whoever opens it.
        </s-paragraph>
      </s-section>

      <s-section heading="Recent shares">
        {shares.length === 0 ? (
          <s-paragraph>No carts have been shared yet.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {shares.map((share) => (
              <s-box
                key={share.code}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-text>
                  <b>{share.code}</b> · {share.itemCount} item
                  {share.itemCount === 1 ? "" : "s"} ·{" "}
                  {new Date(share.createdAt).toLocaleDateString()}
                </s-text>
              </s-box>
            ))}
          </s-stack>
        )}
      </s-section>
    </s-page>
  );
}

export function headers(headersArgs: HeadersArgs) {
  return boundary.headers(headersArgs);
}
