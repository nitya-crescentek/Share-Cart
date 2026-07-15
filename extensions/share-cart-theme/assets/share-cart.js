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

  function showLink(url) {
    if (navigator.share) {
      navigator.share({ title: "Shared cart", url: url }).catch(function () {});
      return;
    }
    copy(url).then(
      function () {
        window.prompt("Link copied! Share it:", url);
      },
      function () {
        window.prompt("Copy this link to share your cart:", url);
      },
    );
  }

  function onClick(button) {
    if (button.disabled) return;
    var label = button.textContent;
    button.disabled = true;
    button.textContent = "Creating link…";

    readCart()
      .then(function (cart) {
        if (!cart.items || !cart.items.length) throw new Error("empty_cart");
        return createShare(button.getAttribute("data-proxy-path"), toItems(cart));
      })
      .then(function (result) {
        showLink(result.url);
      })
      .catch(function (err) {
        window.alert(
          err && err.message === "empty_cart"
            ? "Add something to your cart before sharing it."
            : "Couldn't create a share link. Please try again.",
        );
      })
      .then(function () {
        button.disabled = false;
        button.textContent = label;
      });
  }

  function init() {
    var hosts = document.querySelectorAll("[data-sharecart]");
    Array.prototype.forEach.call(hosts, function (host) {
      if (host.__wired) return;
      host.__wired = true;

      var button = document.createElement("button");
      button.type = "button";
      button.className = "sharecart-btn";
      button.textContent = host.getAttribute("data-label") || "Share cart";
      button.setAttribute(
        "data-proxy-path",
        (host.getAttribute("data-proxy-path") || "/apps/share-cart").replace(/\/+$/, ""),
      );
      button.addEventListener("click", function () {
        onClick(button);
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
