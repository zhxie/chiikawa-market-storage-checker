// ==UserScript==
// @name         Chiikawa Market Storage Checker
// @namespace    https://github.com/zhxie/chiikawa-market-storage-checker
// @version      2024-11-16+1
// @author       Xie Zhihao
// @description  Check storage of products in Chiikawa market.
// @homepage     https://github.com/zhxie/chiikawa-market-storage-checker
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chiikawamarket.jp
// @match        https://chiikawamarket.jp/products/*
// @match        https://chiikawamarket.jp/collections/*/products/*
// @match        https://chiikawamarket.jp/cart
// @match        https://nagano-market.jp/products/*
// @match        https://nagano-market.jp/*/products/*
// @match        https://nagano-market.jp/collections/*/products/*
// @match        https://nagano-market.jp/*/collections/*/products/*
// @match        https://nagano-market.jp/cart
// @match        https://nagano-market.jp/*/cart
// @match        https://chiikawamogumogu.shop/products/*
// @match        https://chiikawamogumogu.shop/collections/*/products/*
// @grant        none
// ==/UserScript==

const INTERVAL = 500;
const MAX_QUANTITY = 20000;
const THRESHOLD_QUANTITY = 100;
const THRESHOLD_PRECISION = 100;

(async function () {
  "use strict";

  const sleep = async (ms) => {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  };
  const getCart = async () => {
    const res = await fetch("/cart.js", {
      headers: {
        accept: "*/*",
      },
    });
    const data = await res.json();
    return data?.items;
  };
  const addItem = async (id, productId, quantity) => {
    const res = await fetch("/cart/add.js", {
      headers: {
        accept: "application/javascript",
        "content-type": "multipart/form-data; boundary=----WebKitFormBoundary788zedotmtSec399",
        "x-requested-with": "XMLHttpRequest",
      },
      method: "POST",
      body: `------WebKitFormBoundary788zedotmtSec399\r\nContent-Disposition: form-data; name="form_type"\r\n\r\nproduct\r\n------WebKitFormBoundary788zedotmtSec399\r\nContent-Disposition: form-data; name="utf8"\r\n\r\n✓\r\n------WebKitFormBoundary788zedotmtSec399\r\nContent-Disposition: form-data; name="id"\r\n\r\n${id}\r\n------WebKitFormBoundary788zedotmtSec399\r\nContent-Disposition: form-data; name="quantity"\r\n\r\n${quantity}\r\n------WebKitFormBoundary788zedotmtSec399\r\nContent-Disposition: form-data; name="product-id"\r\n\r\n${productId}\r\n------WebKitFormBoundary788zedotmtSec399\r\nContent-Disposition: form-data; name="section-id"\r\n\r\ntemplate--18391309091057__main\r\n------WebKitFormBoundary788zedotmtSec399--\r\n`,
    });
    return res.status;
  };
  const removeItem = async (id) => {
    const items = await getCart();
    const index = items?.findIndex((e) => e?.id == id);
    if (index >= 0) {
      await fetch("/cart/change.js", {
        headers: {
          accept: "*/*",
          "content-type": "application/json",
        },
        method: "POST",
        body: `{"line":${index + 1},"quantity":0}`,
      });
      return items[index]?.quantity ?? 0;
    }
    return 0;
  };

  const check = async (id, productId, currentQuantity, fn) => {
    // Remove items from the cart.
    await removeItem(id);

    // Check storage using binary searching.
    const set = new Set();
    let quantity = 0;
    let increment = THRESHOLD_QUANTITY;
    let precision = 1;
    let firstCheck = true;
    while (increment >= precision && quantity < MAX_QUANTITY) {
      let res = -1;
      try {
        // Add delay to avoid potential DDoS.
        await sleep(INTERVAL);

        // Attempt to add items with the given quantity to cart.
        res = await addItem(id, productId, increment);
      } catch {}

      if (res == 200) {
        fn(`🔄 ≥${quantity + increment}`);
        quantity += increment;

        // If the quantity is larger than the threshold, we will only get an approximation to accelerate the process.
        if (firstCheck) {
          increment = MAX_QUANTITY / 2;
          precision = THRESHOLD_PRECISION;
        }

        // Shrink in advance since we have checked the next increment before.
        while (set.has(quantity + increment)) {
          increment = Math.floor(increment / 2 / precision) * precision;
        }
      } else if (res == 422) {
        fn(`🔄 <${quantity + increment}`);
        set.add(quantity + increment);
        increment = Math.floor(increment / 2 / precision) * precision;
      } else {
        fn("🙁");
        return;
      }
      firstCheck = false;
    }
    if (precision == 1 || quantity > MAX_QUANTITY) {
      quantity = Math.min(quantity, MAX_QUANTITY);
      fn(`✅ ${quantity}`);
    } else {
      fn(`✅ ${quantity}+`);
    }

    // Clean up.
    await removeItem(id);

    // Recover the cart.
    if (currentQuantity) {
      try {
        await addItem(id, productId, currentQuantity);
      } catch {}
    }
  };

  const checkCart = async () => {
    // Get current cart.
    let currentItems;
    try {
      currentItems = await getCart();
    } catch {}
    if (!currentItems) {
      return;
    }

    const items = document.getElementsByClassName("cart--item");
    for (let i = 0; i < items.length / 2; i++) {
      // Make sure the label is valid.
      const label1 = items[i].getElementsByClassName("cart--item--title")?.[0]?.children?.[0]?.children?.[0];
      const label2 = items[i + items.length / 2].getElementsByClassName("cart--item--title")?.[0]?.children?.[0]?.children?.[0];
      if (!label1 || !label2) {
        continue;
      }
      const text1 = label1.textContent;
      const text2 = label2.textContent;

      // Get product ID and ID for storage checking.
      const id = items[i].getAttribute("data-variant-id");
      if (!id) {
        continue;
      }
      const productId = currentItems.find((e) => e?.id == id)?.product_id;
      if (!productId) {
        continue;
      }

      // Get current quantity.
      let currentQuantity = currentItems.find((e) => e?.id == id)?.quantity ?? 0;

      // Check storage.
      label1.textContent = `${text1} (🔄)`;
      label2.textContent = `${text2} (🔄)`;
      await check(id, productId, currentQuantity, (t) => {
        label1.textContent = `${text1} (${t})`;
        label2.textContent = `${text2} (${t})`;
      });
    }
  };
  const checkProduct = async () => {
    // Make sure the label is valid.
    let label = document.getElementsByClassName("product-page--title")?.[0];
    if (!label) {
      label = document.getElementsByClassName("product__title")?.[0].children?.[0];
    }
    if (!label) {
      return;
    }
    const text = label.textContent;

    // Get product ID and ID for storage checking.
    const productId = document.querySelector('input[name="product-id"]')?.getAttribute("value");
    let id = document.getElementsByClassName("product-form--variant-select")?.[0]?.children?.[0]?.getAttribute("value");
    if (!id) {
      // Chiikawa Mogumogu Honpo Online Store.
      id = document.getElementsByClassName("product__pickup-availabilities")?.[0]?.getAttribute("data-variant-id");
    }
    if (!productId || !id) {
      return;
    }

    // Get current quantity.
    let currentQuantity = 0;
    try {
      currentQuantity = await removeItem(id);
    } catch {}

    // Check storage.
    label.textContent = `${text} (🔄)`;
    await check(id, productId, currentQuantity, (t) => {
      label.textContent = `${text} (${t})`;
    });
  };

  const links = [];
  const createLink = () => {
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = "检查库存";
    // TODO: this color does not apply to Chiikawa Mogumogu Honpo Online Store.
    link.style.color = "var(--bg-color--button)";
    link.style.marginLeft = "8px";
    link.style.textDecoration = "underline";
    link.addEventListener("click", (e) => {
      e.preventDefault();
      for (const link of links) {
        link.remove();
      }
    });
    links.push(link);
    return link;
  };

  if (document.location.pathname.endsWith("/cart")) {
    // Cart.
    for (const title of document.getElementsByClassName("cart--title")) {
      const link = createLink();
      link.addEventListener("click", () => {
        checkCart();
      });
      title.appendChild(link);
    }
  } else {
    // Product.
    let title = document.getElementsByClassName("product-page--title")?.[0];
    if (!title) {
      title = document.getElementsByClassName("product__title")?.[0]?.children?.[0];
    }
    if (!title) {
      return;
    }
    const link = createLink();
    link.addEventListener("click", () => {
      checkProduct();
    });
    title.appendChild(link);
  }
})();
