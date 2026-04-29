import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import { initExecution } from "../../common/initExecution.mjs";
import { login, editProvider, setupContext, parseCSV } from "../helpers.mjs";
import { parseAdvancedSteps, resolveCsvTokens } from "../../advanced/parseAdvancedSteps.mjs";
import { executeAdvancedSteps } from "../../advanced/executeAdvancedSteps.mjs";

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

  await initExecution({ logger });
  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;

  if (!username) throw new Error("Missing USERNAME");
  if (!password) throw new Error("Missing PASSWORD");
  // Config flags
  const human = process.env.CONFIG_HUMAN === "true" || process.env.HUMAN === "true";
  const intensity = Number(process.env.CONFIG_INTENSITY || 1);
  const headless = process.env.CONFIG_HEADLESS === "true" || process.env.HEADLESS === "true";
  const recordVideo = process.env.CONFIG_RECORD_VIDEO === "true";
  const recordTrace = process.env.CONFIG_RECORD_TRACE === "true";
  const advancedStepsText = process.env.ADVANCED_STEPS || "";
  const steps = parseAdvancedSteps(advancedStepsText);
  logger("CONFIG → human:", human);
  logger("CONFIG → intensity:", intensity);
  logger("CONFIG → headless:", headless);
  logger("CONFIG → recordVideo:", recordVideo);
  logger("CONFIG → recordTrace:", recordTrace);
  logger(`[Advanced] Parsed ${steps.length} step(s)`);

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
  const resultsPath = path.join(process.env.RUN_DIR, "meshUpdated.csv");
  fs.writeFileSync(resultsPath, "ODSCode,Timestamp\n");

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
    const steps = parseAdvancedSteps(advancedStepsText);
    const DRY_RUN = process.env.DRY_RUN === "true";

    for (let i = 0; i < rows.length; i++) {

      const row = rows[i];
      const odsCode = row.odsCode || row.ODSCode || row.ODS || "";

      if (!odsCode) {
        logger("⚠️ Skipping row with no ODS code:", row);
        continue;
      }

      logger(`🔄 Updating ${odsCode}`);

      try {
        await login(page, username, password, odsCode);
      } catch (err) {
        logger(`❌ Login failed for ${odsCode}: ${err?.message}`);
        continue;
      }
      /*
            try {
              await editProvider(page, odsCode);
            } catch (err) {
              logger(`❌ editProvider failed for ${odsCode}: ${err?.message}`);
              continue;
            }
      
             Guard example
            if (!DRY_RUN) {
              await page.click(selector);
            } else {
              logger(`[DRY RUN] Would click: ${selector}`);
            }
            */

      //Do the advanced script
      const resolvedStepsText = resolveCsvTokens(
        advancedStepsText,
        row
      );

      const resolvedSteps = parseAdvancedSteps(resolvedStepsText);

      if (steps.length > 0) {
        logger(`🚀 Executing advanced steps`);
        await executeAdvancedSteps({
          steps: resolvedSteps,
          page,
          rowIndex: 1, // no row index in this script, but keeping for consistency
          log: logger
        });
      }

      const csvRow = `"${odsCode}""${new Date().toISOString()}"\n`;
      fs.appendFileSync(resultsPath, csvRow);

      await page.click('[value="Exit"]');
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