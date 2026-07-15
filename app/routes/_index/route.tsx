import {
  redirect,
  Form,
  useLoaderData,
  type LoaderFunctionArgs,
} from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
}

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Share a cart. Sell the whole cart.</h1>
        <p className={styles.text}>
          Let shoppers send their cart to anyone with a link. One tap loads it
          back, ready to check out.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>One-tap restore</strong>. Opening a link rebuilds the exact
            cart, including options and subscriptions.
          </li>
          <li>
            <strong>Made to be sent</strong>. Links unfurl in WhatsApp and
            iMessage with your products and total.
          </li>
          <li>
            <strong>Attributed revenue</strong>. See which shared carts turn
            into orders.
          </li>
        </ul>
      </div>
    </div>
  );
}
