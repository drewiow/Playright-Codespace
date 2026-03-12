import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import process from "process";
import { login, loginCommissioner, setupContext } from "../helpers.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("SCRIPT BOOT:", __filename, new Date().toISOString());

process.on("uncaughtException", (err) => console.error("UNCAUGHT EXCEPTION:", err && err.stack ? err.stack : err));
process.on("unhandledRejection", (r) => console.error("UNHANDLED REJECTION:", r && r.stack ? r.stack : r));

function isRunDirectly() {
  const invoked = process.argv[1] ? path.resolve(process.argv[1]) : null;
  return invoked && path.resolve(__filename) === invoked;
}

function defaultLogger(...args) {
  console.log(...args);
}

export default async function run({ logger = defaultLogger } = {}) {
  logger("RUN STARTED");

  // Debug envs
  logger("ENV DEBUG:", {
    USERNAME: process.env.USERNAME ? "<present>" : "<missing>",
    PASSWORD: process.env.PASSWORD ? "<present>" : "<missing>",
    REGION: process.env.REGION ?? "<missing>",
    FROM: process.env.FROM ? "<present>" : "<missing>",
    TO: process.env.TO ? "<present>" : "<missing>",
    UNTIL: process.env.UNTIL ? "<present>" : "<missing>",
    TITLE: process.env.TITLE ? "<present>" : "<missing>",
    BODY: process.env.BODY ? "<present>" : "<missing>",
    PRIMARY: process.env.PRIMARY ?? "<unset>"
  });

  // Required credentials
  if (!process.env.USERNAME || !process.env.PASSWORD) {
    logger("❌ Missing USERNAME or PASSWORD.");
    throw new Error("Missing credentials");
  }

  // Required message inputs
  const from = process.env.FROM;
  const to = process.env.TO;
  const until = process.env.UNTIL;
  const title = process.env.TITLE;
  const body = process.env.BODY;
  const primary = ["1", "true", "on", "yes"].includes((process.env.PRIMARY || "").toLowerCase());

  if (!from) { logger("❌ No FROM provided."); throw new Error("Missing FROM"); }
  if (!to) { logger("❌ No TO provided."); throw new Error("Missing TO"); }
  if (!until) { logger("❌ No UNTIL provided."); throw new Error("Missing UNTIL"); }
  if (!title) { logger("❌ No TITLE provided."); throw new Error("Missing TITLE"); }
  if (!body) { logger("❌ No BODY provided."); throw new Error("Missing BODY"); }

  // Resolve and read regions file
  const regionsPath = path.resolve(__dirname, "../input/regions.json");
  logger("Resolved paths:", `regionsPath=${regionsPath}`);
  if (!fs.existsSync(regionsPath)) {
    logger("ERROR: regions.json not found at", regionsPath);
    throw new Error("regions.json missing");
  }

  let regions;
  try {
    regions = JSON.parse(fs.readFileSync(regionsPath, "utf-8"));
    if (!Array.isArray(regions)) throw new Error("regions.json must be an array");
  } catch (e) {
    logger("ERROR: failed to parse regions.json:", e && e.stack ? e.stack : e);
    throw e;
  }

  let browser = null;
  let context = null;
  let page = null;

  try {
    for (const { name, odscode } of regions) {
      logger("🔧 setupContext starting for region:", name, odscode);
      ({ browser, context, page } = await setupContext({ headless: false, human: true }));
      logger("✅ Browser/context/page created");

      // Login as normal user for this region
      logger("➡️ Logging in as user for region", odscode);
      await login(page, process.env.USERNAME, process.env.PASSWORD, odscode);
      logger("✅ User login complete");

      // Navigate to system announcement page
      logger("➡️ Navigating to system announcement page");
      await page.goto("https://pharmoutcomes.org/pharmoutcomes/home/announcement?id=0", { waitUntil: "networkidle" });

      // Fill fields with defensive waits and fallbacks
      // From date
      try {
        await page.waitForSelector('input[name="inFromDate"]', { timeout: 5000 });
        await page.fill('input[name="inFromDate"]', from);
      } catch (e) {
        logger(`⚠️ inFromDate selector not found for region ${name}, skipping fill`);
      }

      // Until / To date
      try {
        await page.waitForSelector('input[name="inToDate"]', { timeout: 5000 });
        await page.fill('input[name="inToDate"]', until);
      } catch (e) {
        logger(`⚠️ inToDate selector not found for region ${name}, skipping fill`);
      }

      // Target organisation / to field
      // Adjust selector if your site uses a different name for the "to" field
      try {
        await page.waitForSelector('input[name="inToOrg"], input[name="inTo"]', { timeout: 3000 });
        const toSelector = (await page.$('input[name="inToOrg"]')) ? 'input[name="inToOrg"]' : 'input[name="inTo"]';
        await page.fill(toSelector, to);
      } catch (e) {
        logger(`⚠️ to/org selector not found for region ${name}, skipping fill`);
      }

      // Title
      try {
        // try common title selectors; adjust if your app uses a different name
        const titleSelector = (await page.$('input[name="inTitle"]')) ? 'input[name="inTitle"]' : 'input[name="title"]';
        await page.waitForSelector(titleSelector, { timeout: 3000 });
        await page.fill(titleSelector, title);
      } catch (e) {
        logger(`⚠️ title selector not found for region ${name}, skipping fill`);
      }

      // Body - try textarea or TinyMCE iframe
      let bodyFilled = false;
      try {
        // first try a simple textarea
        if (await page.$('textarea[name="inBody"]')) {
          await page.fill('textarea[name="inBody"]', body);
          bodyFilled = true;
        } else if (await page.$('iframe[title="Rich Text Area"]')) {
          const frame = page.frameLocator('iframe[title="Rich Text Area"]');
          await frame.locator('body#tinymce').waitFor({ timeout: 5000 });
          await frame.locator('body#tinymce').fill(body);
          bodyFilled = true;
        } else if (await page.$('div[contenteditable="true"]')) {
          await page.fill('div[contenteditable="true"]', body);
          bodyFilled = true;
        }
      } catch (e) {
        logger(`⚠️ body field not filled for region ${name}:`, e && e.message ? e.message : e);
      }
      if (!bodyFilled) logger(`⚠️ Could not find a body input for region ${name}`);

      // Small pause to let UI update
      await page.waitForTimeout(500);

      // Click Save - try a few common selectors
      try {
        if (await page.$('input[type="submit"][value="Save"]')) {
          await page.click('input[type="submit"][value="Save"]');
        } else if (await page.$('button:has-text("Save")')) {
          await page.click('button:has-text("Save")');
        } else {
          logger("⚠️ Save button not found; attempting generic submit");
          await page.keyboard.press("Enter");
        }
      } catch (e) {
        logger("⚠️ Save action failed:", e && e.message ? e.message : e);
      }

      logger("✅ Message created and saved for region", name);

      // Logout or exit
      try {
        if (await page.$('[value="Exit"]')) {
          await page.click('[value="Exit"]');
        } else if (await page.$('a:has-text("Exit")')) {
          await page.click('a:has-text("Exit")');
        } else {
          logger("⚠️ Exit control not found; continuing");
        }
      } catch (e) {
        logger("⚠️ Exit action failed:", e && e.message ? e.message : e);
      }

      // If only primary region required, stop after first successful run
      if (primary) {
        logger("PRIMARY flag set — stopping after first region");
        return;
      }

      // Close context/browser for this iteration to avoid resource buildup
      try { if (page && typeof page.isClosed === "function" ? !page.isClosed() : true) await page.close(); } catch (e) { }
      try { if (context) await context.close(); } catch (e) { }
      try { if (browser) await browser.close(); } catch (e) { }
      browser = context = page = null;
    }
  } catch (err) {
    logger("❌ Run error:", err && err.stack ? err.stack : err);
    throw err;
  } finally {
    // final sentinel so runner can detect completion
    logger("__RUN_COMPLETE__");
    await new Promise(resolve => setTimeout(resolve, 50)); // allow stdout to flush

    // Defensive cleanup
    try { if (page && typeof page.isClosed === "function" ? !page.isClosed() : true) await page.close(); } catch (e) { /* ignore */ }
    try { if (context) await context.close(); } catch (e) { /* ignore */ }
    try { if (browser) await browser.close(); } catch (e) { /* ignore */ }
    logger("👋 Cleanup complete");
  }
}

// Direct-run guard (reliable on Windows and POSIX)
if (isRunDirectly()) {
  console.log("DIRECT RUN: invoking run()");
  run({ logger: console.log }).catch(err => {
    console.error("Script failed when run directly:", err && err.stack ? err.stack : err);
    process.exit(1);
  });
}