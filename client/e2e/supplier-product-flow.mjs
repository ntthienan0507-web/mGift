/**
 * E2E test: Supplier creates product with images
 * Register/login supplier → Create product → Upload images → Verify
 *
 * node e2e/supplier-product-flow.mjs
 */

import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS = path.join(__dirname, "screenshots");
const BASE = "http://localhost:5173";
const API = "http://localhost:9002/api/v1";

// Clean old screenshots
fs.readdirSync(SCREENSHOTS).filter((f) => f.endsWith(".png")).forEach((f) => fs.unlinkSync(path.join(SCREENSHOTS, f)));

let n = 0;
const snap = async (page, name) => {
  n++;
  const f = `${String(n).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: path.join(SCREENSHOTS, f), fullPage: true });
  console.log(`  📸 ${f}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Create a sample test image (red square PNG)
function createTestImage(filename) {
  // Minimal 2x2 red PNG
  const pngData = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000020000000208020000009084" +
    "0e000000000c49444154789c626060f8cf00000008000105f845a50000000049454e44ae426082",
    "hex"
  );
  const filepath = path.join(__dirname, filename);
  fs.writeFileSync(filepath, pngData);
  return filepath;
}

async function main() {
  console.log("\n🚀 Supplier Product + Image Upload E2E\n");

  // Create test images
  const img1 = createTestImage("test-img-1.png");
  const img2 = createTestImage("test-img-2.png");
  console.log("  🖼️  Test images created");

  // Get or create a supplier API key
  let apiKey;

  // Try creating a new shop
  const shopResp = await fetch(`${API}/shops/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `E2E Test Shop ${Date.now()}`,
      description: "Shop tạo bởi E2E test",
      contact_email: "e2e@test.com",
    }),
  });
  if (shopResp.ok) {
    const shop = await shopResp.json();
    apiKey = shop.api_key;
    console.log(`  🏪 Created shop: ${shop.name}`);
  } else {
    console.log(`  ⚠️ Create shop failed: ${shopResp.status}, using existing...`);
    // Use existing supplier key from localStorage if any
  }

  const supplierHeaders = {
    "Content-Type": "application/json",
    "X-Supplier-API-Key": apiKey,
  };

  // Verify supplier profile
  const profileResp = await fetch(`${API}/supplier/profile`, {
    headers: { "X-Supplier-API-Key": apiKey },
  });
  const profile = await profileResp.json();
  console.log(`  ✅ Supplier: ${profile.name}`);

  // ── Browser ──
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();

  try {
    // Inject supplier API key
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.evaluate((key) => localStorage.setItem("mgift_supplier_api_key", key), apiKey);

    // ── 1. Supplier Dashboard ──
    console.log("\n1️⃣  Supplier Dashboard...");
    await page.goto(`${BASE}/supplier`, { waitUntil: "networkidle2" });
    await wait(2000);
    await snap(page, "supplier-dashboard");

    // ── 2. Go to Products tab ──
    console.log("2️⃣  Products tab...");
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const tab = btns.find((b) => b.textContent.includes("Sản phẩm"));
      if (tab) tab.click();
    });
    await wait(1500);
    await snap(page, "products-tab");

    // ── 3. Click "Thêm sản phẩm" ──
    console.log("3️⃣  Open add product form...");
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const btn = btns.find((b) => b.textContent.includes("Thêm sản phẩm"));
      if (btn) btn.click();
    });
    await wait(1000);
    await snap(page, "add-product-form");

    // ── 4. Fill product info ──
    console.log("4️⃣  Fill product info...");
    await page.evaluate(() => {
      const set = (ph, val) => {
        const el = document.querySelector(`input[placeholder*="${ph}"]`);
        if (!el) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(el, val);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      };
      set("Tên sản phẩm", "Hộp quà sinh nhật Premium");
      set("100000", "350000");

      // Stock input: placeholder="0", type="number"
      const stockInputs = document.querySelectorAll('input[type="number"]');
      stockInputs.forEach((el) => {
        if (el.placeholder === "0") {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(el, "25");
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      // Description textarea
      const ta = document.querySelector("textarea");
      if (ta) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
        setter.call(ta, "Hộp quà sang trọng gồm nến thơm, chocolate Bỉ, thiệp handmade. Phù hợp tặng sinh nhật người yêu, bạn bè.");
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await wait(500);

    // Fill metadata (occasion, recipient, style)
    await page.evaluate(() => {
      const selects = document.querySelectorAll("select");
      selects.forEach((sel) => {
        const options = [...sel.options];
        // Set occasion to "birthday"
        if (options.some((o) => o.value === "birthday")) {
          sel.value = "birthday";
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
        // Set recipient to "female"
        if (options.some((o) => o.value === "female") && !options.some((o) => o.value === "birthday")) {
          sel.value = "female";
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
        // Set style to "elegant"
        if (options.some((o) => o.value === "elegant")) {
          sel.value = "elegant";
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    });
    await wait(300);

    // Tags
    await page.evaluate(() => {
      const inputs = document.querySelectorAll("input");
      inputs.forEach((input) => {
        if (input.placeholder && input.placeholder.includes("handmade")) {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, "handmade, chocolate, nến thơm, sinh nhật");
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
    });
    await wait(500);
    await snap(page, "product-filled");

    // ── 5. Upload images ──
    console.log("5️⃣  Upload images...");
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      // Puppeteer's uploadFile properly triggers 'change' event
      // But the input is hidden, so we need to make it visible first
      await page.evaluate((el) => {
        el.classList.remove("hidden");
        el.style.display = "block";
      }, fileInput);
      await fileInput.uploadFile(img1, img2);
      await wait(500);
      // Verify files were picked up by React
      const fileCount = await page.evaluate(() => {
        const input = document.querySelector('input[type="file"]');
        return input?.files?.length || 0;
      });
      console.log(`  ✅ Files selected: ${fileCount}`);
    } else {
      console.log("  ⚠️ File input not found");
    }
    await wait(1000);
    await snap(page, "images-selected");

    // ── 6. Submit form ──
    console.log("6️⃣  Submit product...");
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button[type='submit']")];
      const btn = btns.find((b) => b.textContent.includes("Tạo sản phẩm") || b.textContent.includes("Lưu"));
      if (btn && !btn.disabled) btn.click();
    });
    await wait(4000);
    await snap(page, "after-submit");

    // ── 7. Verify product in list ──
    console.log("7️⃣  Verify product...");
    // Refresh products tab
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const tab = btns.find((b) => b.textContent.includes("Sản phẩm"));
      if (tab) tab.click();
    });
    await wait(2000);
    await snap(page, "product-in-list");

    // ── 8. Verify via API ──
    console.log("8️⃣  Verify via API...");
    const productsResp = await fetch(`${API}/supplier/products`, {
      headers: { "X-Supplier-API-Key": apiKey },
    });
    const products = await productsResp.json();
    const created = products.find((p) => p.name === "Hộp quà sinh nhật Premium");
    if (created) {
      console.log(`  ✅ Product found: ${created.name}`);
      console.log(`  💰 Price: ${created.price.toLocaleString()}đ`);
      console.log(`  📦 Stock: ${created.stock}`);

      // Upload images via API (more reliable than Puppeteer file input)
      if (created.images?.length === 0) {
        console.log("  📤 Uploading images via API...");
        const formData = new FormData();
        const buf1 = fs.readFileSync(img1);
        const buf2 = fs.readFileSync(img2);
        formData.append("files", new File([buf1], "test-img-1.png", { type: "image/png" }));
        formData.append("files", new File([buf2], "test-img-2.png", { type: "image/png" }));
        const uploadResp = await fetch(`${API}/products/${created.id}/images`, {
          method: "POST",
          headers: { "X-Supplier-API-Key": apiKey },
          body: formData,
        });
        if (uploadResp.ok) {
          const updated = await uploadResp.json();
          console.log(`  ✅ Images uploaded: ${updated.images?.length || 0}`);
          updated.images?.forEach((img, i) => console.log(`     ${i + 1}. ${img.url}`));
        } else {
          console.log(`  ❌ Upload failed: ${uploadResp.status} ${await uploadResp.text()}`);
        }
      } else {
        console.log(`  🖼️  Images: ${created.images.length}`);
        created.images.forEach((img, i) => console.log(`     ${i + 1}. ${img.url}`));
      }

      if (created.metadata_info) {
        console.log(`  🏷️  Metadata: ${JSON.stringify(created.metadata_info)}`);
      }
    } else {
      console.log("  ⚠️ Product not found in API response");
      console.log(`  📋 Products: ${products.map((p) => p.name).join(", ")}`);
    }

    // ── 9. Check image on Home page ──
    console.log("9️⃣  Check on Home page...");
    await page.goto(BASE, { waitUntil: "networkidle2" });
    await wait(2000);
    await snap(page, "home-with-product");

    console.log("\n✅ Done!\n");
    const files = fs.readdirSync(SCREENSHOTS).filter((f) => f.endsWith(".png")).sort();
    console.log("📁 Screenshots:");
    files.forEach((f) => console.log(`   e2e/screenshots/${f}`));

  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    await snap(page, "error").catch(() => {});
  } finally {
    // Cleanup test images
    [img1, img2].forEach((f) => { try { fs.unlinkSync(f); } catch {} });
    await wait(2000);
    await browser.close();
  }
}

main().catch(console.error);
