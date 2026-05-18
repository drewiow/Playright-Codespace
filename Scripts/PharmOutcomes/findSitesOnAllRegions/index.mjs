import fs from "node:fs";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import { login, setupContext } from "../helpers.mjs";
import { initExecution } from "../../common/initExecution.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on("uncaughtException", err =>
  console.error("UNCAUGHT EXCEPTION:", err?.stack || err)
);
process.on("unhandledRejection", r =>
  console.error("UNHANDLED REJECTION:", r?.stack || r)
);

function defaultLogger(...args) {
  console.log(...args);
}

export default async function run({ logger = defaultLogger } = {}) {

  // Dynamic input from meta.json → backend → env
  await initExecution({ logger });
  const targetOdsCode = process.env.ODSCODE;
  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;

  if (!username) throw new Error("Missing USERNAME");
  if (!password) throw new Error("Missing PASSWORD");
  if (!targetOdsCode) throw new Error("Missing ODSCODE dynamic input");

  // Load regions.json
  const regionsPath = path.resolve(__dirname, "../input/regions.json");
  const regions = JSON.parse(fs.readFileSync(regionsPath, "utf-8"));

  let browser = null;
  let context = null;
  let page = null;

  try {
    ({ browser, context, page } = await setupContext({
      headless: process.env.CONFIG_HEADLESS === "true",
      human: process.env.CONFIG_HUMAN === "true"
    }));

    const startTime = Date.now();

    for (const { name, odscode } of regions) {
      logger(`🔍 Checking region: ${name} (${odscode})`);

      try {
        await login(page, username, password, odscode);
      } catch (err) {
        logger(`❌ Login failed for ${name}: ${err?.message}`);
        continue;
      }

      await page.goto("https://outcomes4health.org/o4h/admin/providers");
      await page.fill("#providerlookup", targetOdsCode);

      try {
        await page.waitForSelector("#ui-id-1", { timeout: 5000 });
      } catch {
        logger(`⚠️ No results found for ${targetOdsCode} in ${name}`);
        continue;
      }

      const items = await page.$$("#ui-id-1 li");
      for (const item of items) {
        const text = (await item.textContent())?.trim() || "";
        if (text.includes("No matches")) {
          logger(`🚫 No matches in ${name}`);
          continue;
        } else {
          logger(`✅ Found match in ${name}: ${text}`);
        }
      }

      await page.click('[value="Exit"]');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger(`⏱️ Script completed in ${duration} seconds`);

  } catch (err) {
    logger("❌ Run error:", err?.stack || err);
    throw err;

  } finally {
    logger("__RUN_COMPLETE__");

    try { if (page && !page.isClosed()) await page.close(); } catch { }
    try { if (context) await context.close(); } catch { }
    try { if (browser) await browser.close(); } catch { }

    logger("👋 Cleanup complete");
  }
}

run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});