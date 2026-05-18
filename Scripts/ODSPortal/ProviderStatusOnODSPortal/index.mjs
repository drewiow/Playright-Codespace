import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import { initExecution } from "../../common/initExecution.mjs";
import { resolveOdsContext, setupContext, parseCSV } from "../helpers.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("SCRIPT BOOT:", __filename);

process.on("uncaughtException", err =>
  console.error("UNCAUGHT EXCEPTION:", err?.stack || err)
);
process.on("unhandledRejection", r =>
  console.error("UNHANDLED REJECTION:", r?.stack || r)
);

function defaultLogger(...args) {
  console.log(...args);
}

process.on("SIGTERM", async () => {
  console.log("🛑 Stop requested — cleaning up…");

  try { if (page && !page.isClosed()) await page.close(); } catch { }
  try { if (context) await context.close(); } catch { }
  try { if (browser) await browser.close(); } catch { }

  console.log("__RUN_STOPPED__");
  process.exit(0);
});

export default async function run({ logger = defaultLogger } = {}) {
  logger("RUN STARTED");

  await initExecution({ logger, requireEnv: false });

  // Config flags
  const human = process.env.CONFIG_HUMAN === "true" || process.env.HUMAN === "true";
  const intensity = Number(process.env.CONFIG_INTENSITY || 1);
  const headless = process.env.CONFIG_HEADLESS === "true" || process.env.HEADLESS === "true";
  const recordVideo = process.env.CONFIG_RECORD_VIDEO === "true";
  const recordTrace = process.env.CONFIG_RECORD_TRACE === "true";
  const advancedStepsText = process.env.ADVANCED_STEPS || "";
  const runDir = process.env.RUN_DIR

  let browser = null;
  let context = null;
  let page = null;

  try {
    logger("🔧 setupContext starting");
    ({ browser, context, page } = await setupContext({
      headless: process.env.CONFIG_HEADLESS === "true",
      human: process.env.CONFIG_HUMAN === "true",
      runDir: process.env.RUN_DIR
    }));
    logger("✅ Browser/context/page created");

    const startTime = Date.now();
    const DRY_RUN = process.env.DRY_RUN === "true";

    if (DRY_RUN) {
      logger("⚠️ DRY RUN mode enabled - no actions will be performed");
    }


    const odsCode = process.env.ODS_CODE;

    try {
      page.goto("https://www.odsdatasearchandexport.nhs.uk/?search=generalorg&query=" + odsCode);

      //wait until the status element is visible
      await page.waitForSelector('[data-field="status"] .MuiDataGrid-cellContent', { timeout: 5000 });

      const statusText = await page
        .locator('[data-field="status"] .MuiDataGrid-cellContent')
        .first()
        .textContent();

      const active = statusText?.trim().toLowerCase() === "active";
      logger(`✅ ODS ${odsCode} is ${active ? "active" : "not active"}`);

    } catch (err) {
      logger(`❌ ODS lookup failed for ${odsCode}: ${err?.message}`);
    }

    await page.context().clearCookies();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger(`⏱️ Script completed in ${duration} seconds`);

    // Video
    logger(`Record video? : ${recordVideo}`);
    logger(`save video? : ${page.saveVideo}`);
    if (recordVideo && page.saveVideo) {
      await page.saveVideo(`run-${Date.now()}`);
    }

    // Trace
    if (recordTrace) {
      const tracePath = path.join(runDir, "trace.zip");
      await context.tracing.stop({ path: tracePath });
    }

    if (human) {
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
