import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import process from "process";

import { login, editViewer, setupContext } from "../helpers.mjs";
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

// ------------------------------------------------------------
// CSV PARSER
// ------------------------------------------------------------
function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line
      .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
      .map(v => v.replace(/^"|"$/g, "").trim());

    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });
}

// ------------------------------------------------------------
// LOG WRAPPER
// ------------------------------------------------------------
async function logAction(actionDesc, fn, logger) {
  const start = Date.now();
  logger(`➡️ ${actionDesc}`);
  try {
    await fn();
    logger(`✅ ${actionDesc} completed in ${Date.now() - start}ms`);
  } catch (err) {
    logger(`❌ ${actionDesc} failed: ${err.message}`);
    throw err;
  }
}

// ------------------------------------------------------------
// MAIN RUN FUNCTION
// ------------------------------------------------------------
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

  // Validate required env vars
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

  logger("CONFIG → human:", human);
  logger("CONFIG → intensity:", intensity);
  logger("CONFIG → headless:", headless);
  logger("CONFIG → recordVideo:", recordVideo);
  logger("CONFIG → recordTrace:", recordTrace);

  let browser = null;
  let context = null;
  let page = null;

  try {
    logger("🚀 Starting script...");

    const runDir = process.env.RUN_DIR
      ? process.env.RUN_DIR
      : path.resolve(__dirname, "runs", "manual-run");

    const inputCsvPath = process.env.INPUT_CSV_PATH;
    if (!inputCsvPath) throw new Error("INPUT_CSV_PATH not provided");

    logger("📂 Run directory:", runDir);
    logger("📁 CSV path:", inputCsvPath);

    if (!fs.existsSync(runDir)) {
      fs.mkdirSync(runDir, { recursive: true });
    }

    // Load CSV
    let rows;
    try {
      const raw = fs.readFileSync(inputCsvPath, "utf-8");
      rows = parseCSV(raw);
      logger(`✅ Loaded ${rows.length} rows from CSV`);
    } catch (err) {
      logger("❌ Error reading CSV:", err.message);
      throw err;
    }

    // Setup Playwright
    logger("🔧 setupContext starting");
    ({ browser, context, page } = await setupContext({
      headless,
      human,
      runDir
    }));
    logger("✅ Browser/context/page created");

    // Prepare output CSV
    const resultsCsvPath = path.join(runDir, "ProvidersLinked.csv");
    if (!fs.existsSync(resultsCsvPath)) {
      fs.writeFileSync(resultsCsvPath, "odsCode,headOffice,linkedAt\n", "utf-8");
    }

    // Main loop
    for (const row of rows) {
      const odsCode = row.odsCode ?? "";
      const headOffice = row.headOffice ?? "";

      logger(`\n🏥 Processing provider: ${odsCode} (${headOffice})`);

      await logAction("Login", () =>
        login(page, username, password, odsCode),
        logger
      );

      await logAction("Edit viewer", () =>
        editViewer(page, headOffice),
        logger
      );

      await logAction("Fill provider lookup", () =>
        page.fill("#providerlookup", odsCode),
        logger
      );

      await logAction("Wait for autocomplete", () =>
        page.waitForSelector("#ui-id-1", { timeout: 5000 }),
        logger
      );

      await logAction("Select first provider result", () =>
        page.locator("#ui-id-1 li").first().click(),
        logger
      );

      await logAction("Click Add Provider", () =>
        page.locator("#provider_add").click(),
        logger
      );

      // Log to CSV
      const csvRow = `"${odsCode}","${headOffice}","${new Date().toISOString()}"\n`;
      fs.appendFileSync(resultsCsvPath, csvRow);
      logger("✅ Logged provider to CSV");

      await logAction("Logout", () =>
        page.click('[value="Exit"]'),
        logger
      );
    }

    // Trace
    if (recordTrace) {
      const tracePath = path.join(runDir, "trace.zip");
      await context.tracing.stop({ path: tracePath });
    }

    logger("🏁 Script finished");

  } catch (err) {
    logger("❌ Unhandled error:", err?.stack || err);
    throw err;

  } finally {
    logger("__RUN_COMPLETE__");
    await new Promise(r => setTimeout(r, 50));

    try { if (page && !page.isClosed()) await page.close(); } catch { }
    try { if (context) await context.close(); } catch { }
    try { if (browser) await browser.close(); } catch { }

    logger("👋 Cleanup complete");
  }
}

// Runner always invokes this script directly
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});