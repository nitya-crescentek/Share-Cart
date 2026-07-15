import {
  Outlet,
  useLoaderData,
  useRouteError,
  type HeadersArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
}

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses so their headers survive.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export function headers(headersArgs: HeadersArgs) {
  return boundary.headers(headersArgs);
}
