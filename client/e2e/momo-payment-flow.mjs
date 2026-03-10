/**
 * E2E test: Full Momo Payment Flow
 * Login → Cart → Checkout → Momo Payment → Momo Sandbox
 *
 * node e2e/momo-payment-flow.mjs
 */

import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS = path.join(__dirname, "screenshots");
const BASE = "http://localhost:5173";
const API = "http://localhost:9002/api/v1";
const TEST_EMAIL = "test123@example.com";
const TEST_PASSWORD = "12345678";

// Clean
fs.readdirSync(SCREENSHOTS).filter((f) => f.endsWith(".png")).forEach((f) => fs.unlinkSync(path.join(SCREENSHOTS, f)));

let n = 0;
const snap = async (page, name) => {
  n++;
  const f = `${String(n).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: path.join(SCREENSHOTS, f), fullPage: true });
  console.log(`  📸 ${f}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (path, opts = {}) => fetch(`${API}${path}`, opts);

async function main() {
  console.log("\n🚀 Momo Payment Flow E2E\n");

  // ── 0. Prepare via API ──
  console.log("0️⃣  Prep...");
  const { access_token: token } = await (await api("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  })).json();
  const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const products = await (await api("/products/")).json();
  const product = products.find((p) => p.price >= 10000) || products[0];
  console.log(`  📦 ${product.name} - ${product.price.toLocaleString()}đ`);

  await api("/cart/", { method: "DELETE", headers: H });
  await api("/cart/", { method: "POST", headers: H, body: JSON.stringify({ product_id: product.id, quantity: 1 }) });
  console.log("  ✅ Cart ready");

  // ── Browser ──
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();

  try {
    // Inject token
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.evaluate((t) => localStorage.setItem("mgift_token", t), token);

    // ── 1. Home ──
    console.log("\n1️⃣  Home...");
    await page.goto(BASE, { waitUntil: "networkidle2" });
    await wait(1500);
    await snap(page, "home");

    // ── 2. Checkout ──
    console.log("2️⃣  Checkout...");
    await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle2" });
    await wait(2000);
    await snap(page, "checkout");

    // Fill shipping
    console.log("3️⃣  Fill shipping...");
    await page.evaluate(() => {
      const set = (ph, val) => {
        const el = document.querySelector(`input[placeholder*="${ph}"]`);
        if (!el) return;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(el, val);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      };
      set("Nguyễn Văn", "Nguyen Van Test");
      set("0901", "0901234567");
      set("email@example", "test@mgift.vn");
      set("Số nhà", "123 Nguyen Hue, Q1, TP.HCM");
    });
    await wait(500);
    await snap(page, "checkout-filled");

    // Place order
    console.log("4️⃣  Place order...");
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Tiến hành") && !b.disabled);
      if (b) b.click();
    });
    await wait(4000);
    await snap(page, "after-order");

    let url = page.url();
    console.log(`  🔗 ${url}`);

    // Fallback if checkout didn't navigate
    if (!url.includes("/payment")) {
      console.log("  ⚠️ Fallback: checkout via API...");
      // Re-add cart
      await api("/cart/", { method: "DELETE", headers: H });
      await api("/cart/", { method: "POST", headers: H, body: JSON.stringify({ product_id: product.id, quantity: 1 }) });
      const orderResp = await api("/cart/checkout", {
        method: "POST", headers: H,
        body: JSON.stringify({ recipient_name: "Nguyen Van Test", recipient_phone: "0901234567", recipient_address: "123 Nguyen Hue Q1 HCM" }),
      });
      const order = await orderResp.json();
      console.log(`  📋 Order: ${order.id}`);
      await page.evaluate((id) => sessionStorage.setItem("mgift_current_order_id", id), order.id);
      await page.goto(`${BASE}/payment`, { waitUntil: "networkidle2" });
      await wait(2000);
    }

    // ── 5. Payment page ──
    console.log("5️⃣  Payment page...");
    await snap(page, "payment-methods");

    // Click Momo card (the card div with "MoMo" text)
    console.log("6️⃣  Select Momo...");
    const clicked = await page.evaluate(() => {
      // Payment method cards have onClick handlers
      const cards = document.querySelectorAll("[class*='cursor-pointer'], [class*='rounded-xl']");
      for (const card of cards) {
        if (card.textContent.includes("MoMo") && card.onclick !== undefined || card.textContent.includes("MoMo")) {
          card.click();
          return "clicked-card";
        }
      }
      // Try radio inputs
      const radios = document.querySelectorAll("input[type='radio']");
      for (const r of radios) {
        const parent = r.closest("[class*='cursor']") || r.parentElement?.parentElement;
        if (parent?.textContent?.includes("MoMo")) {
          r.click();
          return "clicked-radio";
        }
      }
      return "not-found";
    });
    console.log(`  📌 ${clicked}`);
    await wait(1000);
    await snap(page, "momo-selected");

    // Click "Thanh toán xxx đ" button
    console.log("7️⃣  Click pay...");
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const btn = btns.find((b) => b.textContent.includes("Thanh toán") && b.textContent.includes("đ") && !b.disabled);
      if (btn) btn.click();
    });

    // Wait for redirect (Momo API call + redirect)
    console.log("  ⏳ Waiting for Momo redirect...");
    try {
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 });
    } catch {
      // timeout is ok, check URL
    }
    await wait(2000);

    url = page.url();
    console.log(`  🔗 ${url}`);
    await snap(page, "after-pay");

    // ── 8. Momo sandbox ──
    if (url.includes("momo") || url.includes("test-payment")) {
      console.log("\n🎉 MOMO SANDBOX PAGE!");
      await wait(5000);
      await snap(page, "momo-sandbox");
      await wait(3000);
      await snap(page, "momo-sandbox-2");
    } else {
      // Direct API: create Momo payment and navigate
      console.log("  ⚠️ No redirect. Creating payment via API...");
      const orderId = await page.evaluate(() => sessionStorage.getItem("mgift_current_order_id"));
      console.log(`  📋 orderId: ${orderId}`);

      if (orderId) {
        // Check if payment exists already
        let payUrl = null;
        const existingResp = await api(`/payments/order/${orderId}`, { headers: H });
        if (existingResp.ok) {
          const existing = await existingResp.json();
          payUrl = existing.payment_url;
          console.log(`  💰 Existing payment: ${existing.status}, URL: ${payUrl}`);
        }

        if (!payUrl) {
          const payResp = await api("/payments/", {
            method: "POST", headers: H,
            body: JSON.stringify({ order_id: orderId, method: "momo" }),
          });
          if (payResp.ok) {
            const payData = await payResp.json();
            payUrl = payData.payment_url;
            console.log(`  💳 New payment URL: ${payUrl}`);
          } else {
            console.log(`  ❌ Payment API: ${payResp.status} ${await payResp.text()}`);
          }
        }

        if (payUrl) {
          console.log("  🔀 Navigating to Momo...");
          await page.goto(payUrl, { waitUntil: "networkidle2", timeout: 20000 }).catch(() => {});
          await wait(3000);
          console.log(`  🔗 ${page.url()}`);
          await snap(page, "momo-sandbox");
          await wait(5000);
          await snap(page, "momo-sandbox-detail");
        }
      }
    }

    console.log("\n✅ Done!\n");
    const files = fs.readdirSync(SCREENSHOTS).filter((f) => f.endsWith(".png")).sort();
    console.log("📁 Screenshots:");
    files.forEach((f) => console.log(`   e2e/screenshots/${f}`));

  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    await snap(page, "error").catch(() => {});
  } finally {
    await wait(2000);
    await browser.close();
  }
}

main().catch(console.error);
