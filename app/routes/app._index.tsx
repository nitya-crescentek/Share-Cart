import {
  Form,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import type { HeadersArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const shares = await prisma.sharedCart.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return {
    shares: shares.map((share) => ({
      code: share.code,
      url: `https://${session.shop}/apps/share-cart/c/${share.code}`,
      itemCount: Array.isArray(share.items) ? share.items.length : 0,
      createdAt: share.createdAt.toISOString(),
    })),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);

  const form = await request.formData();
  if (form.get("intent") === "clear") {
    await prisma.sharedCart.deleteMany({ where: { shop: session.shop } });
  }

  return { ok: true };
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

      <s-section heading="Shared links">
        {shares.length === 0 ? (
          <s-paragraph>No carts have been shared yet.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-text tone="neutral">
                {shares.length} link{shares.length === 1 ? "" : "s"}
              </s-text>
              <Form method="post">
                <input type="hidden" name="intent" value="clear" />
                <s-button type="submit" variant="tertiary" tone="critical">
                  Clear all links
                </s-button>
              </Form>
            </s-stack>

            {shares.map((share) => (
              <s-box
                key={share.code}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="small-100">
                  <s-link href={share.url} target="_blank">
                    {share.url}
                  </s-link>
                  <s-text tone="neutral">
                    {share.itemCount} item{share.itemCount === 1 ? "" : "s"} ·{" "}
                    {new Date(share.createdAt).toLocaleString()}
                  </s-text>
                </s-stack>
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
