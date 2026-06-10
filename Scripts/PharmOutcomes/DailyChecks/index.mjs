import { runScript } from "../../common/runScript.mjs";

import {
  login,
  securityWord
} from "../helpers.mjs";

import { logAction, scriptStatus } from "../../common/common.mjs";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Load regions once (unchanged)
const regionsPath = path.resolve(__dirname, "../input/regions.json");
const regions = JSON.parse(fs.readFileSync(regionsPath, "utf-8"));

let i = 0;

// ------------------------------------------------------------
// EXISTING HELPERS (unchanged)
// ------------------------------------------------------------

async function unlockNHS(logger, page, username, password) {
  logger("📊 Checking NHS Lock status...");

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

  // ✅ Switch to primary and loop
  await logAction("Login", () =>
    login(page, username, password, "prim"),
    logger
  );

  while (true) {

    await page.goto("https://outcomes4health.org/o4h/admin/web?nhsnetlock");

    const button = page.locator('input.submit.full-lock[name="submit"]');

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

async function runClaimLoop(page, logger, type) {
  logger(`▶ Running ${type} claims`);

  await page.locator(`input[name="claim-type"][value="${type}"]`).check();

  const result = page.locator('.warning');
  let attempts = 0;

  while (true) {
    attempts++;

    if (type === "emails" || type === "transfers") {
      await page.locator('#Allowed').selectOption('300');
    }

    await page.getByRole('button', { name: 'Run' }).click();

    await result.waitFor();
    const text = await result.innerText();

    if (text.includes('More to do')) {
      logger(`⏳ ${type}: more to process (${attempts})`);
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

async function checkClaims(logger, page, username, password) {
  logger("📊 Checking claim system status...");

  await logAction("Login", () =>
    login(page, username, password, "PRIM"),
    logger
  );

  await page.goto("https://outcomes4health.org/o4h/claims/home");

  const latestClaims = page
    .locator('li')
    .filter({
      has: page.locator('.cronResponseDetailItemHeader:has-text("Claims")')
    })
    .first();

  await latestClaims.waitFor({ state: 'attached' });

  const statusIcon = latestClaims.locator('.status-circle');
  const statusClass = await statusIcon.getAttribute('class');

  if (!statusClass?.includes('green')) {
    logger('❌ Status is red — stopping script');
    return;
  }

  logger('✅ Claim Status is green — checking details...');

  const status = await page.locator('.cronLastestOverall .status-circle').first();
  const classAttr = await status.getAttribute('class');

  if (classAttr?.includes('red')) {
    logger('❌ Something is red, re-running.');

    await page.getByRole('link', { name: 'Go to Manual Claim Run' }).click();

    logger(scriptStatus.ROW_PROGRESS(++i, regions.length + 4));
    await runClaimLoop(page, logger, 'emails');

    logger(scriptStatus.ROW_PROGRESS(++i, regions.length + 4));
    await runClaimLoop(page, logger, 'transfers');

    logger(scriptStatus.ROW_PROGRESS(++i, regions.length + 4));
    await runClaimLoop(page, logger, 'contractmanagerimports');

    logger(scriptStatus.ROW_PROGRESS(++i, regions.length + 4));
    await runClaimLoop(page, logger, 'contractmanagerexports');

  } else {
    logger("✅ All good, nothing to do");
  }
}

// ------------------------------------------------------------
// MAIN (refactored)
// ------------------------------------------------------------

export default async function run() {
  await runScript({
    async main({ page, logger, username, password, config }) {

      logger(scriptStatus.RUN_STARTED);

      const runDir = process.env.RUN_DIR;
      if (runDir && !fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
      }

      try {
        await unlockNHS(logger, page, username, password);
        await checkClaims(logger, page, username, password);

      } catch (err) {
        logger("❌ Unhandled error:", err?.stack || err);
        throw err;
      }

      // ✅ trace (still works)
      if (config.recordTrace) {
        const tracePath = path.join(config.runDir, "trace.zip");
        await page.context().tracing.stop({ path: tracePath });
      }
    }
  });
}

// ✅ required for your runner
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});