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

export default async function run({ logger = defaultLogger } = {}) {
  logger("RUN STARTED");

  await initExecution({ logger });
  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;

  if (!username) throw new Error("Missing USERNAME");
  if (!password) throw new Error("Missing PASSWORD");

  const advancedStepsText = process.env.ADVANCED_STEPS || "";
  const steps = parseAdvancedSteps(advancedStepsText);
  logger(`[Advanced] Parsed ${steps.length} step(s)`);

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
      human: process.env.CONFIG_HUMAN === "true"
    }));
    logger("✅ Browser/context/page created");

    const startTime = Date.now();
    const steps = parseAdvancedSteps(advancedStepsText);

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

      try {
        await editProvider(page, odsCode);
      } catch (err) {
        logger(`❌ editProvider failed for ${odsCode}: ${err?.message}`);
        continue;
      }

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