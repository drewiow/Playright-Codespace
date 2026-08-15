import { runScript } from "../../common/runScript.mjs";
import { login, editProvider } from "../helpers.mjs";
import { logAction, getMappedValue, toTitleCase, cleanEmail, parseCSV } from "../../common/common.mjs";
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

      const resultsCsvPath = path.join(runDir, "UserAccounts.csv");
      const failedCsvPath = path.join(runDir, "FailedAccounts.csv");

      if (!fs.existsSync(resultsCsvPath)) {
        fs.writeFileSync(
          resultsCsvPath,
          "username,odsCode,fullname,email,professionalBody, registrationNumber, telephone,createdAt\n",
          "utf-8"
        );
      }

      if (!fs.existsSync(failedCsvPath)) {
        fs.writeFileSync(
          failedCsvPath,
          "username,odsCode,fullname,email,professionalBody, registrationNumber, telephone,failedAt,reason\n",
          "utf-8"
        );
      }

      const startTime = Date.now();
      const mappings = JSON.parse(process.env.COLUMN_MAPPINGS || "{}");
      let successCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      await logAction("Login", () =>
        login(page, username, password, "PRIM"),
        logger
      );

      logger("🔧 BEGIN ACCOUNT CREATION LOOP");


      for (let i = 0; i < accounts.length; i++) {

        const row = accounts[i];
        const user = {
          odsCode: getMappedValue(row, mappings, "odsCode"),
          firstName: toTitleCase(getMappedValue(row, mappings, "firstname")),
          lastName: toTitleCase(getMappedValue(row, mappings, "lastname")),
          email: getMappedValue(row, mappings, "email"),
          otherEmail: getMappedValue(row, mappings, "otherEmail"),
          telephone: getMappedValue(row, mappings, "telephone").trim().replace(/[^\d+]/g, ""),
          registrationNumber: getMappedValue(row, mappings, "registrationNumber").replace(/\s+/g, ""),
          professionalBody: getMappedValue(row, mappings, "professionalBody").trim().toLowerCase()
        };

        if (!user.odsCode) {
          logger(`⚠️ Skipping row ${i + 1}: no ODS code provided`);
          skippedCount++;
          continue;
        }

        const validFormat = /^(\+44\d{10}|0\d{9,10})$/.test(user.telephone);
        const allZeros = /^0+$/.test(user.telephone);

        if (!validFormat || allZeros) {
          user.telephone = "";
        }

        const accountUsername = `${user.firstName}.${user.lastName}`.replace(/\s+/g, "").replace(/[^a-zA-Z0-9.-]/g, "");
        const nhsEmail = cleanEmail(user.email);
        const otherEmail = cleanEmail(user.otherEmail);
        const isNhsEmail = email => /@nhs\.(net|uk|scot)$/i.test(email || "");
        const email = isNhsEmail(nhsEmail) ? nhsEmail : otherEmail;
        const csvLine = `"${accountUsername}","${user.odsCode}","${user.firstName} ${user.lastName}","${email}","${user.professionalBody}","${user.registrationNumber}","${user.telephone}"," ${Date.now()}"\n`;

        // Try and catch to handle any errors during user creation, write errors to the filedCSV
        try {

          await logAction(`Edit provider ${user.odsCode}`, () =>
            editProvider(page, user.odsCode),
            logger
          );

          await logAction("Click New User", () =>
            page.locator('a.full-lock[href^="/o4h/admin/users?new"]').click(),
            logger
          );

          await logAction("Fill username", () =>
            page.fill("#inUserName", accountUsername),
            logger
          );

          await logAction("Fill full name", () =>
            page.fill("#inKnownName", `${user.firstName} ${user.lastName}`),
            logger
          );

          await logAction("Fill contact phone", () =>
            page.fill("#inContactPhone", user.telephone),
            logger
          );

          if (user.professionalBody === "gphc") {
            await logAction("Select Gphc Professional Body", () =>
              page.selectOption("#inGPCProfessionalBody", "General Pharmaceutical Council"),
              logger
            );
          }

          if (user.registrationNumber && user.registrationNumber !== "N/A") {
            await logAction("Fill GPHC Registration", () =>
              page.fill("#inGPCRegistration", user.registrationNumber),
              logger
            );
          }

          if (email && email != "") {
            await logAction("Fill email", () =>
              page.fill("#inContactEmail", email),
              logger
            );
          }

          await logAction("Save user (first save)", () =>
            page.click('input[type="submit"][name="update"]'),
            logger
          );

          await page.waitForTimeout(1000);

          const errors = await page.locator('p.error').allTextContents();
          const duplicateError = page.locator(
            'p.error:has-text("User name already exists")'
          );

          if (await duplicateError.isVisible().catch(() => false)) {
            logger(`⚠️ User already exists → skipping`);
            const failedCsvLine = `"${accountUsername}","${user.odsCode}","${user.firstName} ${user.lastName}","${email}","${user.professionalBody}","${user.registrationNumber}","${user.telephone}","${Date.now()}","Duplicate Username"\n`;
            fs.appendFileSync(
              failedCsvPath,
              failedCsvLine,
              "utf8"
            );
            skippedCount++;
            continue;
          }

          await logAction("Uncheck Cross Login", () =>
            page.uncheck('input[name="inCrossLogin"]'),
            logger
          );

          await logAction("Tick all permissions", () =>
            page.click('input[type="button"][value="Tick all"]'),
            logger
          );


          await logAction("Save user (permissions save)", () =>
            page.click('input[type="submit"][name="update"]'),
            logger
          );


          fs.appendFileSync(
            resultsCsvPath,
            csvLine,
            "utf8"
          );
          logger(`✅ Created ${accountUsername} in provider ${user.odsCode}`);
          successCount++;
        }

        catch (err) {
          logger(`❌ Failed to create user ${accountUsername}: ${err?.message}`);
          const failedCsvLine = `"${accountUsername}","${user.odsCode}","${user.firstName} ${user.lastName}","${email}","${user.professionalBody}","${Date.now()}","${err?.message}"\n`;
          failedCount++;
          fs.appendFileSync(
            failedCsvPath,
            failedCsvLine,
            "utf8"
          );
        }

      }
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger(`⏱️ Script completed in ${duration} seconds`);

      logger("🎉 Finished creating all accounts");
      logger("📊 Summary");
      logger(`✅ Created: ${successCount}`);
      logger(`❌ Failed: ${failedCount}`);
      logger(`⚠️ Skipped: ${skippedCount}`);

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
