// ==UserScript==
// @name         Chiikawa Market Storage Checker
// @namespace    https://github.com/zhxie/chiikawa-market-storage-checker
// @version      2024-11-12
// @author       Xie Zhihao
// @description  Check storage of products in Chiikawa market.
// @homepage     https://github.com/zhxie/chiikawa-market-storage-checker
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chiikawamarket.jp
// @match        https://chiikawamarket.jp/products/*
// @match        https://chiikawamarket.jp/collections/*/products/*
// @match        https://nagano-market.jp/products/*
// @match        https://nagano-market.jp/collections/*/products/*
// @grant        none
// ==/UserScript==

const ATTEMPT = 1;
const INTERVAL = 500;
const MAX_QUANTITY = 20000;

(async function () {
  "use strict";

  const sleep = async (ms) => {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  };
  const clearCart = async () => {
    return await fetch("/cart/clear", {
      headers: {
        accept: "*/*",
        "content-type": "application/json",
      },
      method: "POST",
    });
  };
  const check = async (id, productId, quantity) => {
    try {
      // Clear cart.
      await clearCart();
      // Check for multiple times to reduce uncertainties caused by network or WAF.
      let res;
      for (let i = 0; i < ATTEMPT; i++) {
        // Add delay to avoid potential DDoS.
        await sleep(INTERVAL);
        // Attempt to add items with the given quantity to cart.
        res = await fetch("/cart/add.js", {
          headers: {
            accept: "application/javascript",
            "content-type": "multipart/form-data; boundary=----WebKitFormBoundary788zedotmtSec399",
            "x-requested-with": "XMLHttpRequest",
          },
          body: `------WebKitFormBoundary788zedotmtSec399\r\nContent-Disposition: form-data; name="form_type"\r\n\r\nproduct\r\n------WebKitFormBoundary788zedotmtSec399\r\nContent-Disposition: form-data; name="utf8"\r\n\r\n✓\r\n------WebKitFormBoundary788zedotmtSec399\r\nContent-Disposition: form-data; name="id"\r\n\r\n${id}\r\n------WebKitFormBoundary788zedotmtSec399\r\nContent-Disposition: form-data; name="quantity"\r\n\r\n${quantity}\r\n------WebKitFormBoundary788zedotmtSec399\r\nContent-Disposition: form-data; name="product-id"\r\n\r\n${productId}\r\n------WebKitFormBoundary788zedotmtSec399\r\nContent-Disposition: form-data; name="section-id"\r\n\r\ntemplate--18391309091057__main\r\n------WebKitFormBoundary788zedotmtSec399--\r\n`,
          method: "POST",
        });
        if (res.status == 200) {
          return 200;
        }
      }
      return res.status;
    } catch {
      return -1;
    }
  };

  // Make sure label is valid.
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

  // Alert for incognito mode since we will clear the cart for checking.
  if (
    !window.confirm(
      "此脚本将通过模拟将商品加入购物车以检测库存。\nThe script will check inventory by simulating adding items to the cart.\n\n检测库存中将会自动清空购物车，推荐使用无痕浏览运行该脚本。\nChecking inventory will automatically clear your cart. It is recommended to use incognito mode to run the script.\n\n商店的翻译功能可能导致脚本失效，请切换到日语并继续。\nThe translation feature of the store may cause the script to fail. Please switch to Japanese and continue."
    )
  ) {
    return;
  }

  // Check storage using binary searching.
  let left = 0;
  let right = MAX_QUANTITY + 1;
  let quantity = 0;
  while (left <= right) {
    const mid = Math.floor(left + (right - left) / 2);
    label.textContent = `${text} (🔄 ${left}→${right})`;
    const res = await check(id, productId, mid);
    if (res == 200) {
      left = mid + 1;
      quantity = Math.max(quantity, mid);
    } else if (res == 422) {
      right = mid - 1;
    } else {
      label.textContent = `${text} (🙁)`;
      return;
    }
  }
  if (quantity >= MAX_QUANTITY + 1) {
    label.textContent = `${text} (✅ ≥${MAX_QUANTITY})`;
  } else {
    label.textContent = `${text} (✅ ${quantity})`;
  }

  // Clean up.
  await clearCart();
})();
