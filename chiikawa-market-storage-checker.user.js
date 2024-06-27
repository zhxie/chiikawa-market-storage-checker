// ==UserScript==
// @name         Chiikawa Market Storage Checker
// @namespace    https://github.com/zhxie/chiikawa-market-storage-checker
// @version      2024-06-27
// @author       Xie Zhihao
// @description  Check storage of products in Chiikawa market.
// @homepage     https://github.com/zhxie/chiikawa-market-storage-checker
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chiikawamarket.jp
// @match        https://chiikawamarket.jp/products/*
// @match        https://chiikawamarket.jp/collections/*/products/*
// @match        https://chiikawamarket.jp/cart
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  if (document.location.pathname === "/cart") {
    // Cart.
    for (const item of document.getElementsByClassName("cart--item")) {
      const quantity = item.getAttribute("data-inventory-quantity");
      const label =
        item.getElementsByClassName("cart--item--title")?.[0]?.children?.[0]
          ?.children?.[0];
      if (quantity !== undefined && label) {
        label.textContent += `(${quantity})`;
      }
    }
  } else {
    // Product.
    const quantity = document
      .getElementsByClassName("product-form--variant-select")?.[0]
      ?.children?.[0]?.getAttribute("data-inventory-quantity");
    const label = document.getElementsByClassName("product-page--title")?.[0];
    if (quantity !== undefined && label) {
      label.textContent += ` (${quantity})`;
    }
  }
})();
