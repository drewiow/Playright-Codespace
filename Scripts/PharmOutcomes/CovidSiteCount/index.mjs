import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import process from "process";
import { login, securityWord, setupContext } from "../helpers.mjs";
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

    // ------------------------------------------------------------
    // SCRIPT LOGIC STARTS HERE
    // ------------------------------------------------------------

    const startTime = new Date();
    logger(`🚀 Starting COVID accreditation count script...`);
    logger(`📅 Start time: ${startTime.toLocaleString()}`);

    const resultsDir = path.resolve(__dirname, "results");
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
    const csvPath = path.join(resultsDir, "CovidCount.csv");

    const regionsPath = path.resolve(__dirname, "../input/regions.json");
    logger(`Resolved paths: csvPath=${csvPath} regionsPath=${regionsPath}`);

    if (!fs.existsSync(regionsPath)) {
      logger("❌ ERROR: regions.json not found at", regionsPath);
      return;
    }

    const regionsRaw = fs.readFileSync(regionsPath, "utf-8");
    const regions = JSON.parse(regionsRaw);
    logger(`📁 Loaded ${regions.length} regions`);

    fs.appendFileSync(csvPath, `"Date","${new Date().toISOString()}"\n`);

    let totalAccredited = 0;
    let findings = [];   // <-- NEW: store results for summary table

    for (const { name, odscode } of regions) {
      const regionStart = new Date();
      logger(`\n🔍 Checking region: ${name} (${odscode})`);

      try {
        logger("➡️ Logging in...");
        await login(page, username, password, odscode);
        logger("✅ Login successful");
      } catch (err) {
        logger(`❌ Login failed for ${name}:`, err?.message || err);
        continue;
      }

      try {
        logger("➡️ Navigating to impersonation page...");
        await page.goto("https://outcomes4health.org/o4h/admin/loginas?id=881686", {
          waitUntil: "networkidle"
        });
        await securityWord(page);

        logger("➡️ Opening COVID accreditation list...");
        await page.goto(
          "https://outcomes4health.org/o4h/admin/accreditations?category=COVID%20Vaccination%202025/26",
          { waitUntil: "networkidle" }
        );

        logger("➡️ Counting accredited rows...");
        const accredited = await page.evaluate(() => {
          return Array.from(
            document.querySelectorAll(
              'tr:not(.green):not(.rosybrown) td[cat="accredit"] input[type="checkbox"]'
            )
          ).filter(cb => cb.checked).length;
        });

        logger(`🧮 Accredited count for ${name}: ${accredited}`);
        fs.appendFileSync(csvPath, `"${name}",${accredited}\n`);

        totalAccredited += accredited;
        findings.push({ name, accredited });   // <-- NEW: store result

        logger("➡️ Exiting region session...");
        await page.click('[value="Exit"]');
      } catch (err) {
        logger(`❌ Error while processing region ${name}:`, err?.message || err);
      }

      const regionEnd = new Date();
      const regionDuration = ((regionEnd - regionStart) / 1000).toFixed(2);
      logger(`⏱️ Region completed in ${regionDuration} seconds`);
    }

    logger("------------------------------------------------------------");
    logger(`📊 Total accredited across all regions: ${totalAccredited}`);
    fs.appendFileSync(csvPath, `"Total",${totalAccredited}\n`);

    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    logger("------------------------------------------------------------");
    logger(`🎉 All regions processed`);
    logger(`⏱️ Total script duration: ${duration} seconds`);
    logger("📁 Results saved to CovidCount.csv");

    // ------------------------------------------------------------
    // NEW: PRINT SUMMARY TABLE
    // ------------------------------------------------------------

    logger("\n📋 Accreditation summary:");
    logger("----------------------------------------------");
    logger("Region".padEnd(40) + "Accredited");
    logger("----------------------------------------------");

    for (const f of findings) {
      logger(f.name.padEnd(40) + f.accredited);
    }

    logger("----------------------------------------------");
    logger(`TOTAL`.padEnd(40) + totalAccredited);
    logger("----------------------------------------------");

    // ------------------------------------------------------------
    // SCRIPT LOGIC ENDS HERE
    // ------------------------------------------------------------

  } catch (err) {
    logger("❌ Run error:", err?.stack || err);
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