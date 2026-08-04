
import { runScript } from "../../common/runScript.mjs";
import { login, editProvider, parseCSV } from "../helpers.mjs";
import { logAction, normaliseKey } from "../../common/common.mjs";
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

      logger(`Success CSV: ${resultsCsvPath}`);
      logger(`Failed CSV: ${failedCsvPath}`);

      const startTime = Date.now();

      // -----------------------------
      // 1. CREATE ALL ACCOUNTS FIRST
      // -----------------------------
      logger("🔧 BEGIN ACCOUNT CREATION LOOP");

      await logAction("Login", () =>
        login(page, username, password, "PRIM"),
        logger
      );

      const odsColumn = normaliseKey(
        process.env.ODS_COLUMN || "odscode"
      );
      logger(`Using ODS column: ${odsColumn}`);

      let successCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < accounts.length; i++) {

        const row = accounts[i];
        const odsCode = row[odsColumn];
        if (!odsCode) {
          logger(`⚠️ Skipping row ${i + 1}: no value found in column '${odsColumn}'`);
          skippedCount++;
          continue;
        }

        const registrationNumber = row.gphcregistration?.replace(/\s+/g, "") || "";
        const professionalBody = row.professionalbody.trim().toLowerCase();
        const toTitleCase = value =>
          value
            ?.toLowerCase()
            .replace(/(^|[\s'-])\w/g, char => char.toUpperCase())
            .trim() || "";

        const firstName = toTitleCase(row.firstname);
        const lastName = toTitleCase(row.lastname);
        const accountUsername =
          `${firstName}.${lastName}`
            .replace(/\s+/g, "")
            .replace(/[^a-zA-Z0-9.-]/g, "");

        const fullname = `${firstName} ${lastName}`.trim();
        const telephone = row["telnum"]?.trim();
        const cleanEmail = value => {
          const email = value?.trim().toLowerCase();

          if (!email || email === "none") {
            return "";
          }

          return email;
        };

        const nhsEmail = cleanEmail(row.nhsemailaddress);
        const otherEmail = cleanEmail(row.otheremail);

        const isNhsEmail = email =>
          /@nhs\.(net|uk|scot)$/i.test(email || "");

        const email = isNhsEmail(nhsEmail)
          ? nhsEmail
          : otherEmail;
        logger(
          `[ROW ${i + 1}/${accounts.length}] User: ${fullname} | Username: ${accountUsername} | ODS: ${odsCode} | Email: ${email} | Professional Body: ${professionalBody} | Registration: ${registrationNumber} | Tel: ${telephone}`
        );
        const csvLine = `"${accountUsername}","${odsCode}","${fullname}","${email}","${professionalBody}","${registrationNumber}","${telephone}"," ${Date.now()}"\n`;

        // Try and catch to handle any errors during user creation, write errors to the filedCSV
        try {

          await logAction(`Edit provider ${odsCode}`, () =>
            editProvider(page, odsCode),
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
            page.fill("#inKnownName", fullname),
            logger
          );

          if (professionalBody === "gphc") {
            await logAction("Select Gphc Professional Body", () =>
              page.selectOption("#inGPCProfessionalBody", "General Pharmaceutical Council"),
              logger
            );
          }

          if (registrationNumber && registrationNumber !== "N/A") {
            await logAction("Fill GPHC Registration", () =>
              page.fill("#inGPCRegistration", registrationNumber),
              logger
            );
          }

          await logAction("Fill email", () =>
            page.fill("#inContactEmail", email),
            logger
          );

          await logAction("Save user (first save)", () =>
            page.click('input[type="submit"][name="update"]'),
            logger
          );

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

          const duplicateError = page.locator(
            'p.error:has-text("User name already exists")'
          );

          if (await duplicateError.isVisible().catch(() => false)) {
            logger(`⚠️ User already exists → skipping`);
            const failedCsvLine = `"${accountUsername}","${odsCode}","${fullname}","${email}","${professionalBody}","${registrationNumber}","${telephone}","${Date.now()}","Duplicate Username"\n`;
            fs.appendFileSync(
              failedCsvPath,
              failedCsvLine,
              "utf8"
            );
            skippedCount++;
            continue;
          }

          fs.appendFileSync(
            resultsCsvPath,
            csvLine,
            "utf8"
          );
          logger(`✅ Created ${accountUsername} in provider ${odsCode}`);
          successCount++;
        }

        catch (err) {
          logger(`❌ Failed to create user ${accountUsername}: ${err?.message}`);
          const failedCsvLine = `"${accountUsername}","${odsCode}","${fullname}","${email}","${professionalBody}","${Date.now()}","${err?.message}"\n`;
          failedCount++;
          fs.appendFileSync(
            failedCsvPath,
            failedCsvLine,
            "utf8"
          );
        }

      }

      logger("🎉 Finished creating all accounts");

      logger("📊 Summary");
      logger(`✅ Created: ${successCount}`);
      logger(`❌ Failed: ${failedCount}`);
      logger(`⚠️ Skipped: ${skippedCount}`);

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
