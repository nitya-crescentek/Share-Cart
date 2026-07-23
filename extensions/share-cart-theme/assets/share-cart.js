(function () {
  "use strict";

  function readCart() {
    // Read at click time -- themes mutate the cart via AJAX, so a render-time snapshot
    // would be stale.
    return fetch("/cart.js", {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    }).then(function (res) {
      return res.json();
    });
  }

  function toItems(cart) {
    return cart.items.map(function (item) {
      return {
        variantId: String(item.id),
        quantity: item.quantity,
        title: item.product_title || item.title,
        variantTitle: item.variant_title,
        image: (item.featured_image && item.featured_image.url) || item.image || null,
        // Carried through so bundle/personalisation line item data survives the round trip.
        properties:
          item.properties && Object.keys(item.properties).length
            ? item.properties
            : null,
      };
    });
  }

  function createShare(proxyPath, items) {
    return fetch(proxyPath + "/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ items: items }),
    }).then(function (res) {
      if (!res.ok) throw new Error("share_failed");
      return res.json();
    });
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.reject();
  }

  // Replace the button with the generated link and a copy button.
  function showResult(host, url) {
    host.innerHTML = "";

    var wrap = document.createElement("div");
    wrap.className = "sharecart-result";

    var input = document.createElement("input");
    input.className = "sharecart-link";
    input.type = "text";
    input.readOnly = true;
    input.value = url;
    input.setAttribute("aria-label", "Share link");

    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "sharecart-copy-btn";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", function () {
      copy(url).then(
        function () {
          copyBtn.textContent = "Copied!";
          setTimeout(function () {
            copyBtn.textContent = "Copy";
          }, 2000);
        },
        function () {
          input.select();
        },
      );
    });

    wrap.appendChild(input);
    wrap.appendChild(copyBtn);
    host.appendChild(wrap);

    input.focus();
    input.select();
  }

  function onClick(host, button) {
    if (button.disabled) return;
    button.disabled = true;
    var label = button.textContent;
    button.textContent = "Creating link…";

    readCart()
      .then(function (cart) {
        if (!cart.items || !cart.items.length) throw new Error("empty_cart");
        return createShare(host.getAttribute("data-proxy-path"), toItems(cart));
      })
      .then(function (result) {
        showResult(host, result.url);
      })
      .catch(function (err) {
        button.disabled = false;
        button.textContent = label;
        window.alert(
          err && err.message === "empty_cart"
            ? "Add something to your cart before sharing it."
            : "Couldn't create a share link. Please try again.",
        );
      });
  }

  function init() {
    var hosts = document.querySelectorAll("[data-sharecart]");
    Array.prototype.forEach.call(hosts, function (host) {
      if (host.__wired) return;
      host.__wired = true;

      host.setAttribute(
        "data-proxy-path",
        (host.getAttribute("data-proxy-path") || "/apps/share-cart").replace(/\/+$/, ""),
      );

      var button = document.createElement("button");
      button.type = "button";
      button.className = "sharecart-btn";
      button.textContent = host.getAttribute("data-label") || "Share cart";
      button.addEventListener("click", function () {
        onClick(host, button);
      });
      host.appendChild(button);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
