import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import process from "process";
import { initExecution } from "../../common/initExecution.mjs";
import { login, editProvider, setupContext } from "../helpers.mjs";
import { decryptEnv, logAction, scriptStatus } from "../../common/common.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on("uncaughtException", err =>
  console.error("UNCAUGHT EXCEPTION:", err?.stack || err)
);
process.on("unhandledRejection", r =>
  console.error("UNHANDLED REJECTION:", r?.stack || r)
);

function defaultLogger(...args) {
  console.log(...args);
}

let i = 0;
// Load regions.json
const regionsPath = path.resolve(__dirname, "../input/regions.json");
const regions = JSON.parse(fs.readFileSync(regionsPath, "utf-8"));


async function unlockNHS(logger, page, username, password) {


  console.log(logger, "📊 Checking NHS Lock status...");
  for (const { name, odscode } of regions) {

    logger(scriptStatus.ROW_PROGRESS(i + 1, regions.length + 4));
    i++;
    await logAction("Login", () =>
      login(page, username, password, odscode),
      logger
    );

    await page.goto("https://outcomes4health.org/o4h/admin/web?nhsnetlock");

    const submitButton = await page.$('input.submit.full-lock[name="submit"]');

    if (submitButton) {
      const isDisabled = await submitButton.getAttribute("disabled");

      if (!isDisabled) {
        await submitButton.click();
      } else {
        logger("⛔ Button is disabled, skipping.");
      }
    } else {
      logger("⚠️ Submit button not found.");
    }

    await page.click('[value="Exit"]');
  }

  // Now go back to primary and keep unlocking until the button says so
  await logAction("Login", () =>
    login(page, username, password, "prim"),
    logger
  );

  while (true) {

    await page.goto("https://outcomes4health.org/o4h/admin/web?nhsnetlock");

    const button = page.locator('input.submit.full-lock[name="submit"]');

    // Wait for button to exist
    await button.waitFor();

    const isDisabled = await button.isDisabled();

    if (!isDisabled) {
      logger("✅ Button enabled — unlocking...");
      await button.click();
      logger("⛔ Email unlocked, checking again...");
    } else {
      logger("✅ Button is disabled — all clear!");
      await page.click('[value="Exit"]');
      break;
    }

    await page.waitForTimeout(2000);

  }
}

async function checkClaims(logger, page, username, password) {
  logger("📊 Checking claim system status...");

  // re-run claims
  await logAction("Login", () =>
    login(page, username, password, "PRIM"),
    logger
  );

  page.goto("https://outcomes4health.org/o4h/claims/home");

  //Check the the Claims didn't fail,  not point continuing if they did
  logger("🔎 Checking claim status...");
  const latestClaims = page
    .locator('li')
    .filter({
      has: page.locator('.cronResponseDetailItemHeader:has-text("Claims")')
    })
    .first();

  await latestClaims.waitFor({ state: 'attached' });  // ✅ not visible

  const statusIcon = latestClaims.locator('.status-circle');

  // No visible wait
  const statusClass = await statusIcon.getAttribute('class');

  if (!statusClass?.includes('green')) {
    logger('❌ Status is red — stopping script');
    return;
  }

  logger('✅ Claim Status is green — re-running...');

  const status = await page.locator('.cronLastestOverall .status-circle').first();

  const classAttr = await status.getAttribute('class');
  if (classAttr?.includes('red')) {
    logger('❌ Something is red, re-running.');

    await page.getByRole('link', { name: 'Go to Manual Claim Run' }).click();
    logger(scriptStatus.ROW_PROGRESS(i + 1, regions.length + 4));
    i++;
    await runClaimLoop(page, logger, 'emails');
    logger(scriptStatus.ROW_PROGRESS(i + 1, regions.length + 4));
    i++;

    await runClaimLoop(page, logger, 'transfers');
    logger(scriptStatus.ROW_PROGRESS(i + 1, regions.length + 4));
    i++;

    await runClaimLoop(page, logger, 'contractmanagerimports');
    logger(scriptStatus.ROW_PROGRESS(i + 1, regions.length + 4));
    i++;

    await runClaimLoop(page, logger, 'contractmanagerexports');

  }
  else {
    logger("✅ All good, nothing to do");
  }
}

async function runClaimLoop(page, logger, type) {
  logger(`▶ Running ${type} claims`);

  await page.locator(`input[name="claim-type"][value="${type}"]`).check();

  const result = page.locator('.warning');
  let attempts = 0;

  while (true) {
    attempts++;

    if (type == "emails" || type == "transfers") await page.locator('#Allowed').selectOption('300');
    await page.getByRole('button', { name: 'Run' }).click();

    await result.waitFor();
    const text = await result.innerText();

    console.log(`${type} result:`, text);

    if (text.includes('More to do')) {
      logger(`⏳ ${type}: more to process (attempt ${attempts})`);
      await page.waitForTimeout(5000);
      continue;
    }

    if (text.includes('Finished') || text.includes('No more')) {
      logger(`✅ ${type}: complete`);
      break;
    }

    throw new Error(`${type}: Unknown state`);
  }
}

// ------------------------------------------------------------
// MAIN RUN FUNCTION
// ------------------------------------------------------------
export default async function run({ logger = defaultLogger } = {}) {
  logger(scriptStatus.RUN_STARTED);

  await initExecution({ logger });

  // Validate required env vars
  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;

  if (!username) {
    logger("❌ Missing USERNAME environment variable");
    throw new Error("Missing USERNAME");
  }
  if (!password) {
    logger("❌ Missing PASSWORD environment variable");
    throw new Error("Missing PASSWORD");
  }

  // Config flags
  const human = process.env.CONFIG_HUMAN === "true" || process.env.HUMAN === "true";
  const intensity = Number(process.env.CONFIG_INTENSITY || 1);
  const headless = process.env.CONFIG_HEADLESS === "true" || process.env.HEADLESS === "true";
  const recordVideo = process.env.CONFIG_RECORD_VIDEO === "true";
  const recordTrace = process.env.CONFIG_RECORD_TRACE === "true";
  const DRY_RUN = process.env.DRY_RUN === "true";

  let browser = null;
  let context = null;
  let page = null;

  try {

    const runDir = process.env.RUN_DIR;
    if (!fs.existsSync(runDir)) {
      fs.mkdirSync(runDir, { recursive: true });
    }

    // Setup Playwright
    ({ browser, context, page } = await setupContext({
      headless,
      human,
      runDir
    }));

    await unlockNHS(logger, page, username, password);
    await checkClaims(logger, page, username, password);


    // Trace
    if (recordTrace) {
      const tracePath = path.join(runDir, "trace.zip");
      await context.tracing.stop({ path: tracePath });
    }

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