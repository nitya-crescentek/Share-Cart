import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import type { ShareItem } from "../lib/share.server";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// Served from the shop's own origin via the app proxy, so the inline script can call
// /cart/clear.js and /cart/add.js against the visitor's real cart. Plain HTML with
// inlined JS, because storefront asset paths don't proxy back to the app.
export async function loader({ params }: LoaderFunctionArgs) {
  const code = params.code ?? "";
  const share = await prisma.sharedCart.findUnique({ where: { code } });

  if (!share) {
    return html(
      `<!doctype html><meta charset="utf-8"><title>Link not found</title>
       <body style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:0 20px">
       <h1>This link isn't valid</h1><p>We couldn't find a shared cart for this link.</p>
       <p><a href="/">Continue shopping &rarr;</a></p></body>`,
      404,
    );
  }

  const items = share.items as unknown as ShareItem[];

  const rows = items
    .map(
      (item) => `<li style="display:flex;gap:12px;align-items:center;padding:8px 0;border-top:1px solid #eee">
      ${
        item.image
          ? `<img src="${esc(item.image)}" alt="" width="48" height="48" style="border-radius:6px;object-fit:cover">`
          : ""
      }
      <span style="flex:1">${esc(item.title ?? "Item")}${
        item.variantTitle && item.variantTitle !== "Default Title"
          ? ` <span style="color:#777">– ${esc(item.variantTitle)}</span>`
          : ""
      }</span>
      <span style="color:#777">×${esc(item.quantity)}</span>
    </li>`,
    )
    .join("");

  // Only pass what /cart/add.js needs.
  const cartItems = items.map((item) => ({
    id: Number(item.variantId),
    quantity: item.quantity,
    ...(item.properties ? { properties: item.properties } : {}),
  }));

  const page = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>A shared cart</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:40px auto;padding:0 20px;color:#1a1a1a">
<h1 style="font-size:22px">A cart was shared with you</h1>
<p style="color:#777">Loading it will replace anything currently in your cart.</p>
<ul style="list-style:none;padding:0;margin:20px 0">${rows}</ul>
<button id="load" style="width:100%;padding:14px;font-size:15px;font-weight:600;color:#fff;background:#1a1a1a;border:0;border-radius:8px;cursor:pointer">Load this cart</button>
<p id="status" style="text-align:center;color:#777;margin-top:12px"></p>
<script>
var ITEMS = ${JSON.stringify(cartItems).replace(/</g, "\\u003c")};
var btn = document.getElementById('load');
var status = document.getElementById('status');
function post(url, body){
  return fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body||{}), credentials:'same-origin'});
}
btn.addEventListener('click', function(){
  btn.disabled = true;
  status.textContent = 'Loading\\u2026';
  post('/cart/clear.js')
    .then(function(){ return post('/cart/add.js', {items: ITEMS}); })
    .then(function(res){ if(!res.ok) throw new Error(); window.location.href = '/cart'; })
    .catch(function(){ btn.disabled = false; status.textContent = 'Something went wrong. Please try again.'; });
});
</script>
</body></html>`;

  return html(page);
}
