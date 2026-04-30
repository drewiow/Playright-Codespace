import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import process from "process";

import { login, editProvider, setupContext, parseCSV } from "../helpers.mjs";
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
// LOG WRAPPER
// ------------------------------------------------------------
async function logAction(actionDesc, fn, logger) {
  const start = Date.now();
  logger(`➡️ ${actionDesc}`);
  try {
    const result = await fn();
    logger(`✅ ${actionDesc} completed in ${Date.now() - start}ms`);
    return result;
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
  const DRY_RUN = process.env.DRY_RUN === "true";

  logger("CONFIG → human:", human);
  logger("CONFIG → intensity:", intensity);
  logger("CONFIG → headless:", headless);
  logger("CONFIG → recordVideo:", recordVideo);
  logger("CONFIG → recordTrace:", recordTrace);
  logger("CONFIG → DRY_RUN:", DRY_RUN);

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
    let accounts;
    try {
      const raw = fs.readFileSync(inputCsvPath, "utf-8");
      accounts = parseCSV(raw);
      logger(`✅ Loaded ${accounts.length} accounts from CSV`);
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
    const resultsCsvPath = path.join(runDir, "LinkedAccounts.csv");
    if (!fs.existsSync(resultsCsvPath)) {
      fs.writeFileSync(resultsCsvPath, "username,odsCode,fullName,email,linkedAt\n", "utf-8");
    }

    // -----------------------------
    // 1. CREATE ALL ACCOUNTS FIRST
    // -----------------------------
    logger("🔧 BEGIN ACCOUNT CREATION LOOP");

    await logAction("Login", () =>
      login(page, username, password, "PRIM"),
      logger
    );

    let baseUser = null;
    const created = [];

    for (let i = 0; i < accounts.length; i++) {
      const { odsCode, newUser, fullName, email } = accounts[i];
      const computedUsername = i === 0 ? newUser : `${newUser}.${odsCode}`;

      logger(`\n🧑‍💻 Creating user ${i + 1}/${accounts.length}`);
      logger(`   Provider ODS: ${odsCode}`);
      logger(`   Full name: ${fullName}`);
      logger(`   Email: ${email}`);
      logger(`   Username: ${computedUsername}`);

      await logAction(`Edit provider ${odsCode}`, () =>
        editProvider(page, odsCode),
        logger
      );

      // if the primary user, check if they exist before trying to create
      let exists = false;
      if (i === 0) {
        baseUser = { username: computedUsername, odsCode };
        logger(`⭐ Base user set: ${JSON.stringify(baseUser)}`);

        const row = page.locator(`tr:has(span:has-text("(${baseUser.username})"))`);
        exists = await row.count() > 0;
      }

      if (exists) {
        logger(`⚠️ Base user ${baseUser.username} already exists! Will skip creation and attempt linking directly.`);
        created.push(baseUser);
      }
      else {

        await logAction("Click New User", () =>
          page.locator('a.full-lock[href^="/o4h/admin/users?new"]').click(),
          logger
        );

        await logAction("Fill username", () =>
          page.fill("#inUserName", computedUsername),
          logger
        );

        await logAction("Fill full name", () =>
          page.fill("#inKnownName", fullName),
          logger
        );

        await logAction("Fill email", () =>
          page.fill("#inContactEmail", email),
          logger
        );

        await logAction("Save user (first save)", () =>
          page.click('input[type="submit"][name="update"]'),
          logger
        );

        if (i > 1) {
          await logAction("Uncheck Reset Password", () =>
            page.uncheck('input[name="inResetPassword"]'),
            logger
          );

          await logAction("Uncheck Cross Login", () =>
            page.uncheck('input[name="inCrossLogin"]'),
            logger
          );
        }

        await logAction("Tick all permissions", () =>
          page.click('input[type="button"][value="Tick all"]'),
          logger
        );

        await logAction("Save user (permissions save)", () =>
          page.click('input[type="submit"][name="update"]'),
          logger
        );

        created.push({ username: computedUsername, odsCode, fullName, email });
      }

    }

    logger("🎉 Finished creating all accounts");

    // -----------------------------
    // 2. FINAL LINKING PASS
    // -----------------------------
    logger("\n🔗 BEGIN FINAL LINKING PASS");

    if (!baseUser) throw new Error("baseUser was never set!");

    await logAction(`Return to base provider ${baseUser.odsCode}`, () =>
      editProvider(page, baseUser.odsCode),
      logger
    );

    const row = page.locator(`tr:has(span:has-text("(${baseUser.username})"))`);
    await logAction("Open base user row", () =>
      row.locator('a.full-lock:has-text("Edit")').click(),
      logger
    );

    await logAction("Click Link User", () =>
      page.click('input.submit.full-lock[name="submit"][value="Link User"]'),
      logger
    );

    for (const entry of created.slice(1)) {
      logger(`➡️ Linking username: ${entry.username}`);

      await logAction(`Fill linking search for ${entry.username}`, () =>
        page.fill("#inUserID_typedown", entry.username),
        logger
      );

      await logAction("Wait for autocomplete", () =>
        page.waitForSelector("#ui-id-1"),
        logger
      );

      await logAction("Select first autocomplete result", () =>
        page.locator("#ui-id-1 li").first().click(),
        logger
      );

      await logAction("Click AddLinkedUser", () =>
        page.click('input[type="submit"][name="AddLinkedUser"]'),
        logger
      );

      const csvRow = `"${entry.username}","${entry.odsCode}","${entry.fullName}","${entry.email}","${new Date().toISOString()}"\n`;
      fs.appendFileSync(resultsCsvPath, csvRow);
    }

    logger("🎉 All accounts linked successfully");

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