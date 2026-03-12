import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

import { login, editProvider, setupContext } from "../helpers.mjs";
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

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
    const row = {};
    headers.forEach((h, i) => (row[h] = cols[i]));
    return row;
  });
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
  fs.writeFileSync(resultsPath, "ODSCode,MeshUsername,Timestamp\n");

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

    for (const row of rows) {
      const odsCode = row.odsCode || row.ODSCode || row.ODS || "";
      const meshUsername = row.meshUsername || row.MeshUsername || "";
      const meshPassword = row.meshPassword || row.MeshPassword || "";

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

      // Update MESH details
      await page.click("text=[+] MESH Mailbox settings");

      const mailboxIdInputs = page.locator('input[name="inMESHMailboxIDs[]"]');
      const mailboxPasswordInputs = page.locator('input[name="inMESHMailboxPasswords[]"]');

      await mailboxIdInputs.nth(0).fill(meshUsername);
      await mailboxPasswordInputs.nth(0).fill(meshPassword);

      await page.click('[value="Save"]');

      const csvRow = `"${odsCode}","${meshUsername}","${new Date().toISOString()}"\n`;
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