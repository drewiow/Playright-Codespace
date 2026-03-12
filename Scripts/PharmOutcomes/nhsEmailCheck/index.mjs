import fs from "fs";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

import { login, setupContext } from "../helpers.mjs";
import { decryptEnv } from "../../common/common.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("SCRIPT BOOT:", __filename, new Date().toISOString());

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
  logger("RUN STARTED");

  // 🔐 decrypt env.enc
  try {
    logger("🔐 decryptEnv starting...");
    await decryptEnv(process.env.ENV_ENC_PATH, process.env.ENV_PASSPHRASE);
    logger("🔐 decryptEnv complete");
  } catch (err) {
    logger("❌ decryptEnv failed:", err?.stack || err);
    throw err;
  }

  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;

  if (!username) throw new Error("Missing USERNAME");
  if (!password) throw new Error("Missing PASSWORD");

  // Load regions.json
  const regionsPath = path.resolve(__dirname, "../input/regions.json");
  const regions = JSON.parse(fs.readFileSync(regionsPath, "utf-8"));

  // Prepare results file inside run directory
  const resultsPath = path.join(process.env.RUN_DIR, "EmailCheck.csv");
  fs.writeFileSync(resultsPath, "Timestamp,RegionCode,RegionName,Status\n");

  let browser = null;
  let context = null;
  let page = null;

  try {
    logger("🔧 setupContext starting");
    ({ browser, context, page } = await setupContext({
      headless: process.env.CONFIG_HEADLESS === "true",
      human: process.env.CONFIG_HUMAN === "true"
    }));
    logger("✅ Browser/context/page created");

    const startTime = Date.now();

    for (const { name, odscode } of regions) {
      logger(`🔍 Checking region: ${name} (${odscode})`);

      try {
        await login(page, username, password, odscode);
      } catch (err) {
        logger(`❌ Login failed for ${name}: ${err?.message}`);
        continue;
      }

      await page.goto("https://outcomes4health.org/o4h/admin/web?nhsnetlock");

      const submitButton = await page.$('input.submit.full-lock[name="submit"]');

      if (submitButton) {
        const isDisabled = await submitButton.getAttribute("disabled");

        if (!isDisabled) {
          await submitButton.click();

          const csvRow = `"${new Date().toISOString()}","${odscode}","${name}","Unlocked"`;
          logger(`✅ Logged: ${csvRow}`);
          fs.appendFileSync(resultsPath, csvRow + "\n");
        } else {
          logger("⛔ Button is disabled, skipping.");
        }
      } else {
        logger("⚠️ Submit button not found.");
      }

      await page.click('[value="Exit"]');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger(`⏱️ Script completed in ${duration} seconds`);

    if (process.env.CONFIG_HUMAN === "true") {
      logger("🕒 Browser will remain open...");
      await new Promise(() => { });
    }

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