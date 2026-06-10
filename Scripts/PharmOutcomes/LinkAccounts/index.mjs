import { runScript } from "../../common/runScript.mjs";

import {
  login,
  editProvider,
  parseCSV
} from "../helpers.mjs";

import { logAction } from "../../common/common.mjs";

import fs from "node:fs";
import path from "node:path";

export default async function run() {
  await runScript({
    async main({ page, logger, username, password, config }) {

      logger("🚀 Starting script...");

      const runDir = config.runDir;
      if (runDir && !fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
      }

      const inputCsvPath =
        process.env.INPUT_CSV_PATH ||
        process.env.CSV_PATH;

      if (!inputCsvPath) {
        throw new Error("No CSV path provided (INPUT_CSV_PATH or CSV_PATH)");
      }

      // ✅ Load CSV
      let accounts;
      try {
        const raw = fs.readFileSync(inputCsvPath, "utf-8");
        accounts = parseCSV(raw);
        logger(`✅ Loaded ${accounts.length} accounts from CSV`);
      } catch (err) {
        logger("❌ Error reading CSV:", err.message);
        throw err;
      }

      // ✅ Prepare output CSV
      const resultsCsvPath = path.join(runDir, "LinkedAccounts.csv");

      if (!fs.existsSync(resultsCsvPath)) {
        fs.writeFileSync(
          resultsCsvPath,
          "username,odsCode,fullname,email,linkedAt\n",
          "utf-8"
        );
      }

      const startTime = Date.now();

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

        const {
          odscode,
          newuser,
          fullname,
          email
        } = accounts[i];

        const computedUsername = i === 0
          ? newuser
          : `${newuser}.${odscode}`;

        logger(`\n🧑‍💻 Creating user ${i + 1}/${accounts.length}`);
        logger(`   Provider ODS: ${odscode}`);
        logger(`   Full name: ${fullname}`);
        logger(`   Email: ${email}`);
        logger(`   Username: ${computedUsername}`);

        await logAction(`Edit provider ${odscode}`, () =>
          editProvider(page, odscode),
          logger
        );

        if (i === 0) {
          baseUser = { username: computedUsername, odscode };
          logger(`⭐ Base user set: ${JSON.stringify(baseUser)}`);
        } else {

          await logAction("Click New User", () =>
            page.locator('a.full-lock[href^="/o4h/admin/users?new"]').click(),
            logger
          );

          await logAction("Fill username", () =>
            page.fill("#inUserName", computedUsername),
            logger
          );

          await logAction("Fill full name", () =>
            page.fill("#inKnownName", fullname),
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

          const duplicateError = page.locator(
            'p.error:has-text("User name already exists")'
          );

          if (await duplicateError.isVisible().catch(() => false)) {
            logger(`⚠️ User already exists → skipping`);
            continue;
          }

          created.push({
            username: computedUsername,
            odscode,
            fullname,
            email
          });
        }
      }

      logger("🎉 Finished creating all accounts");

      // -----------------------------
      // 2. FINAL LINKING PASS
      // -----------------------------
      logger("\n🔗 BEGIN FINAL LINKING PASS");

      if (!baseUser) {
        throw new Error("baseUser was never set!");
      }

      await logAction(`Return to base provider ${baseUser.odscode}`, () =>
        editProvider(page, baseUser.odscode),
        logger
      );

      const row = page.locator(
        `tr:has(span:has-text("(${baseUser.username})"))`
      );

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

        const csvRow =
          `"${entry.username}","${entry.odscode}","${entry.fullname}","${entry.email}","${new Date().toISOString()}"\n`;

        fs.appendFileSync(resultsCsvPath, csvRow);
      }

      logger("🎉 All accounts linked successfully");

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger(`⏱️ Script completed in ${duration} seconds`);

      // ✅ Trace
      if (config.recordTrace) {
        const tracePath = path.join(config.runDir, "trace.zip");
        await page.context().tracing.stop({ path: tracePath });
      }

      logger("🏁 Script finished");
    }
  });
}

// ✅ required for your runner
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});