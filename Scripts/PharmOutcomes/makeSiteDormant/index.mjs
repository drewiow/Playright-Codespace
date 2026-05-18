import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import { initExecution } from "../../common/initExecution.mjs";
import { login, editProvider, setupContext, parseCSV, deaccredit, addAudit } from "../helpers.mjs";
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
  const log = (msg, ...rest) => logger(`${new Date().toISOString()} ${msg}`, ...rest);

  log("🚀 RUN STARTED");

  await initExecution({ logger });

  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;

  if (!username) throw new Error("Missing USERNAME");
  if (!password) throw new Error("Missing PASSWORD");

  const human = process.env.CONFIG_HUMAN === "true" || process.env.HUMAN === "true";
  const headless = process.env.CONFIG_HEADLESS === "true" || process.env.HEADLESS === "true";
  const recordVideo = process.env.CONFIG_RECORD_VIDEO === "true";
  const recordTrace = process.env.CONFIG_RECORD_TRACE === "true";
  const advancedStepsText = process.env.ADVANCED_STEPS || "";
  const runDir = process.env.RUN_DIR;
  const odsColumn = process.env.ODS_COLUMN || "ODSCode";
  const DRY_RUN = process.env.DRY_RUN === "true";

  log(`⚙️ ODS Column: ${odsColumn}`);
  log(`⚙️ Dry Run: ${DRY_RUN}`);
  log(`⚙️ Headless: ${headless}`);
  log(`⚙️ Human Mode: ${human}`);

  const csvPath = process.env.CSV_PATH;
  if (!csvPath) throw new Error("CSV_PATH not provided");

  log(`📄 Reading CSV: ${csvPath}`);

  let rows;
  try {
    const csvText = await fsp.readFile(csvPath, "utf8");
    rows = parseCSV(csvText);
  } catch (err) {
    log("❌ Failed to read CSV:", err?.message);
    throw err;
  }

  log(`📦 Loaded ${rows.length} rows from CSV`);

  const resultsPath = path.join(runDir, "Closed.csv");
  fs.writeFileSync(resultsPath, "ODSCode,CaseRef,PIDService,Timestamp\n");

  let browser = null;
  let context = null;
  let page = null;

  try {
    log("🔧 Setting up browser context...");
    ({ browser, context, page } = await setupContext({
      headless,
      human,
      runDir
    }));
    log("✅ Browser ready");

    const startTime = Date.now();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowStart = Date.now();

      log(`──────────── ROW ${i + 1}/${rows.length} ────────────`);

      const odsCode = row[odsColumn];
      const caseref = row.caseref || row.CaseRef;
      const PIDService = row.PIDService || row.pidservice;

      if (!odsCode) {
        log(`⚠️ Missing ODS (${odsColumn}) → skipping row`);
        continue;
      }

      log(`🔄 Processing ODS: ${odsCode}`);
      log(`📌 CaseRef: ${caseref}, PIDService: ${PIDService}`);

      // LOGIN
      try {
        log("🔐 Logging in...");
        await login(page, username, password, odsCode);
        log("✅ Login successful");
      } catch (err) {
        log(`❌ Login failed: ${err?.message}`);
        continue;
      }

      // EDIT PROVIDER
      try {
        log("👤 Opening provider...");
        await editProvider(page, odsCode);
        log("✅ Provider opened");
      } catch (err) {
        log(`❌ editProvider failed: ${err?.message}`);
        continue;
      }

      // DEACCREDIT
      try {
        log(`🔧 Deaccrediting PIDService: ${PIDService}`);
        await deaccredit(page, PIDService);
        log("✅ Deaccredit complete");
      } catch (err) {
        log(`❌ Deaccredit failed: ${err?.message}`);
      }

      // ACCOUNT REF CHECK
      try {
        log("🔎 Checking Account Reference...");

        const input = await page.$("#inAccountRef");
        const currentValue = await input.inputValue();

        log(`📋 Current Account Ref: ${currentValue}`);

        if (!currentValue.includes("EX-COVID")) {
          await input.fill("EX-COVID");
          log("✅ Updated Account Ref → EX-COVID");
        } else {
          log("ℹ️ Already contains EX-COVID, skipping");
        }
      } catch (err) {
        log(`⚠️ Failed to update Account Ref: ${err?.message}`);
      }

      // AUDIT
      try {
        log(`📝 Adding audit entry: ${caseref}`);
        await addAudit(page, caseref);
        log("✅ Audit entry added");
      } catch (err) {
        log(`❌ Audit failed: ${err?.message}`);
      }

      await page.waitForTimeout(1000);

      // SAVE
      try {
        log("💾 Saving provider...");
        await page.click('[value="Save"]');
        log("✅ Save successful");
      } catch (err) {
        log(`❌ Save failed: ${err?.message}`);
      }

      // WRITE CSV
      fs.appendFileSync(
        resultsPath,
        `"${odsCode}","${caseref}","${PIDService}","${new Date().toISOString()}"\n`
      );

      log(`📄 Result written for ${odsCode}`);

      // EXIT
      try {
        log("↩️ Exiting provider...");
        await page.click('[value="Exit"]');
        log("✅ Exit successful");
      } catch (err) {
        log(`⚠️ Exit failed (continuing): ${err?.message}`);
      }

      const rowDuration = ((Date.now() - rowStart) / 1000).toFixed(2);
      log(`✅ Row completed in ${rowDuration}s`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`⏱️ Script completed in ${duration}s`);

    if (recordVideo && page.saveVideo) {
      log("🎥 Saving video...");
      await page.saveVideo(`run-${Date.now()}`);
    }

    if (recordTrace) {
      const tracePath = path.join(runDir, "trace.zip");
      log("📦 Saving trace...");
      await context.tracing.stop({ path: tracePath });
    }

    if (human) {
      log("🕒 Keeping browser open (human mode)");
      await new Promise(() => { });
    }

  } catch (err) {
    log("❌ Run error:", err?.stack || err);
    throw err;

  } finally {
    log("__RUN_COMPLETE__");

    try { if (page && !page.isClosed()) await page.close(); } catch { }
    try { if (context) await context.close(); } catch { }
    try { if (browser) await browser.close(); } catch { }

    log("👋 Cleanup complete");
  }
}

run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});
