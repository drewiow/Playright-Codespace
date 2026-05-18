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

  // CSV input path from runner
  const csvPath = process.env.CSV_PATH;
  if (!csvPath) throw new Error("CSV_PATH not provided");

  logger("📄 Reading CSV:", csvPath);

  let rows;
  try {
    const csvText = await fsp.readFile(csvPath, "utf8");
    rows = parseCSV(csvText);
  } catch (err) {
    logger("❌ Failed to read CSV:", err?.message);
    throw err;
  }

  logger(`📦 Loaded ${rows.length} rows from CSV`);

  // Prepare results file inside run directory
  const notFoundResultsPath = path.join(process.env.RUN_DIR, "notFound.csv");
  const foundResultsPath = path.join(process.env.RUN_DIR, "Found.csv");

  fs.writeFileSync(notFoundResultsPath, "ODSCode,Timestamp\n");
  fs.writeFileSync(foundResultsPath, "ODSCode, Region, Timestamp\n");

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

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const odsKey = process.env.ODS_COLUMN;
      const odsCode = row[odsKey];

      if (!odsCode) {
        logger(`⚠️ Missing ODS in column "${odsKey}"`);
        continue;
      }

      logger(`\n==============================`);
      logger(`🔄 Processing ${i + 1}/${rows.length}: ${odsCode}`);

      try {
        // ✅ ALWAYS start from clean state
        await page.goto("https://outcomes4health.org/o4h/", {
          waitUntil: "networkidle"
        });

        const result = await resolveOdsContext(page, odsCode, logger);

        logger(`✅ Exists: ${result.exists}`);
        logger(`📍 Region: ${result.region || "Unknown"}`);

        if (!result.exists) {
          const csvRow = `"${odsCode}","${new Date().toISOString()}"\n`;
          fs.appendFileSync(notFoundResultsPath, csvRow);
        } else {
          const csvRow = `"${odsCode}","${result.region || "Unknown"}","${new Date().toISOString()}"\n`;
          fs.appendFileSync(foundResultsPath, csvRow);
        }

      } catch (err) {
        logger(`❌ ODS lookup failed for ${odsCode}: ${err?.message}`);

        const csvRow = `"${odsCode}","${new Date().toISOString()}"\n`;
        fs.appendFileSync(notFoundResultsPath, csvRow);
      }

      await page.context().clearCookies();
    }

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
