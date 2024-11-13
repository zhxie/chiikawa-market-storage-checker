// ==UserScript==
// @name         Chiikawa Market Storage Checker
// @namespace    https://github.com/zhxie/chiikawa-market-storage-checker
// @version      2024-11-13+1
// @author       Xie Zhihao
// @description  Check storage of products in Chiikawa market.
// @homepage     https://github.com/zhxie/chiikawa-market-storage-checker
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chiikawamarket.jp
// @match        https://chiikawamarket.jp/products/*
// @match        https://chiikawamarket.jp/collections/*/products/*
// @match        https://nagano-market.jp/products/*
// @match        https://nagano-market.jp/*/products/*
// @match        https://nagano-market.jp/collections/*/products/*
// @match        https://nagano-market.jp/*/collections/*/products/*
// @grant        none
// ==/UserScript==

const INTERVAL = 500;
const LEFT_BEGIN = 0;
const RIGHT_BEGIN = 10000;
const THRESHOLD = 100;
const THRESHOLD_PRECISION = 100;

(async function () {
  "use strict";

  const sleep = async (ms) => {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
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
    const res = await fetch("/cart.js", {
      headers: {
        accept: "*/*",
      },
    });
    const data = await res.json();
    const index = data?.["items"]?.findIndex((e) => e?.["id"] == id);
    if (index >= 0) {
      await fetch("/cart/change.js", {
        headers: {
          accept: "*/*",
          "content-type": "application/json",
        },
        method: "POST",
        body: `{"line":${index + 1},"quantity":0}`,
      });
      return data["items"][index]?.["quantity"] ?? 0;
    }
    return 0;
  };

  const check = async (id, productId, fn) => {
    // Check storage using binary searching.
    let left = LEFT_BEGIN;
    let right = RIGHT_BEGIN;
    let quantity = 0;
    let precision = 1;
    while (left <= right && right - left >= precision) {
      let mid = Math.floor((left + (right - left) / 2) / precision) * precision;
      if (left == LEFT_BEGIN && right == RIGHT_BEGIN) {
        // Begin from 100.
        mid = THRESHOLD;
      }

      let res = -1;
      try {
        // Add delay to avoid potential DDoS.
        await sleep(INTERVAL);

        // Attempt to add items with the given quantity to cart.
        res = await addItem(id, productId, quantity);

        // Remove items from the cart.
        await removeItem(id);
      } catch {}

      if (res == 200) {
        if (left == LEFT_BEGIN && right == RIGHT_BEGIN) {
          // If the quantity is larger than 100, we will only get an approximation to accelerate the process.
          precision = THRESHOLD_PRECISION;
        }
        left = mid + 1;
        quantity = Math.max(quantity, mid);
        fn(`🔄 ≥${quantity}`);
      } else if (res == 422) {
        right = mid - 1;
        fn(`🔄 <${right + 1}`);
      } else {
        fn("🙁");
        return;
      }
    }
    if (precision == 1) {
      fn(`✅ ${quantity}`);
    } else {
      fn(`✅ ≥${quantity}`);
    }
  };

  // Make sure the label is valid.
  const label = document.getElementsByClassName("product-page--title")?.[0];
  if (!label) {
    return;
  }
  const text = label.textContent;

  // Get product ID and ID for storage checking.
  const sku = document.querySelector("div.product-form--root")?.getAttribute("data-handle");
  const productId = document.querySelector('input[name="product-id"]')?.getAttribute("value");
  if (!sku || !productId) {
    return;
  }
  let id = document.querySelector(`option[data-sku="${sku}"]`)?.getAttribute("value");
  if (!id) {
    // Nagano Market.
    id = document.querySelector(`option[data-sku="N${sku}"]`)?.getAttribute("value");
  }
  if (!id) {
    return;
  }

  // Alert for incognito mode since we will change the cart for checking.
  if (
    !window.confirm(
      "此脚本将通过模拟将商品加入购物车以检测库存。\nThe script will check inventory by simulating adding items to the cart.\n\n检测库存将改变此商品在购物车中的件数，推荐使用无痕窗口运行该脚本。\nChecking inventory will change the quantity of this item in the shopping cart. It is recommended to use incognito mode to run the script."
    )
  ) {
    return;
  }

  // Get current quantity.
  let currentQuantity = 0;
  try {
    currentQuantity = await removeItem(id);
  } catch {}

  // Check storage.
  label.textContent = `${text} (🔄)`;
  await check(id, productId, (t) => {
    label.textContent = `${text} (${t})`;
  });

  // Recover the cart.
  if (currentQuantity) {
    await addItem(id, productId, currentQuantity);
  }
})();
