import { runScript } from "../../common/runScript.mjs";
import { login, editProvider, addCommissioner, accredit, removeCommissioner } from "../helpers.mjs";
import { logAction, getMappedValue, toTitleCase, parseCSV } from "../../common/common.mjs";
import fs from "node:fs";
import path from "node:path";

export default async function run() {
  await runScript({
    async main({ page, customers, logger, username, password, config }) {

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
      try {
        const raw = fs.readFileSync(inputCsvPath, "utf-8");
        customers = parseCSV(raw);
        logger(`✅ Loaded ${customers.length} customers from CSV`);
      } catch (err) {
        logger("❌ Error reading CSV:", err.message);
        throw err;
      }

      const resultsCsvPath = path.join(runDir, "AddedCustomers.csv");
      const failedCsvPath = path.join(runDir, "FailedCustomers.csv");

      if (!fs.existsSync(resultsCsvPath)) {
        fs.writeFileSync(
          resultsCsvPath,
          "odsCode, action, createdAt\n",
          "utf-8"
        );
      }

      if (!fs.existsSync(failedCsvPath)) {
        fs.writeFileSync(
          failedCsvPath,
          "odsCode, reason\n",
          "utf-8"
        );
      }

      const startTime = Date.now();
      const mappings = JSON.parse(process.env.COLUMN_MAPPINGS || "{}");
      let successCount = 0;
      let failedCount = 0;

      // ✅ env inputs
      const serviceId = process.env.SERVICEID;
      const commissionerId = process.env.COMMISSIONERID;
      const loginStart = Date.now();
      await login(page, username, password);

      const posToken = await page.evaluate(() => {
        return SessionToken()
          .match(/=([^&]+)/)?.[1];
      });

      logger("🚀 Starting Flu 2026 Automation");
      logger(`📦 Loaded ${customers.length} pharmacies`);
      logger(`🎯 Service ID: ${serviceId}`);
      logger(`🏛️ Commissioner ID: ${commissionerId}`);
      logger(`🔐 Login successful (${Date.now() - loginStart}ms)`);
      logger(`🎫 Session Token: ${posToken.substring(0, 12)}...`);
      logger("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      for (let i = 0; i < customers.length; i++) {

        const row = customers[i];
        const odsCode = getMappedValue(row, mappings, "odsCode");
        const addOrRemove =
          (getMappedValue(row, mappings, "addorRemove") || "")
            .toLowerCase(); const sysId = getMappedValue(row, mappings, "sysId");

        if (!odsCode || !addOrRemove) {
          const reason = [!odsCode ? "Missing ODS Code" : null, !addOrRemove ? "Missing Add/Remove value" : null].filter(Boolean).join(", ");
          logger(
            `⚠️ Skip [${i + 1}] ${reason}`
          );

          failedCount++;
          fs.appendFileSync(
            failedCsvPath,
            `"${odsCode || ""}","","${reason}"\n`,
            "utf8"
          );

          continue;
        }

        logger(`🏥 [${i + 1}/${customers.length}] : ${odsCode}`);

        try {

          const removeCommissionerLink = `/pharmoutcomes/admin/commissioners?provider=${sysId}&minister=remove&commissioner=${commissionerId}&POSesTok=${posToken}`;
          const accreditServiceLink = `/pharmoutcomes/admin/providers?id=${sysId}&accredit=${serviceId}&POSesTok=${posToken}`;

          // are they to be added or removed?
          if (addOrRemove === "add") {
            logger(
              `➕ Accrediting Service ${serviceId}`
            );
            const actionStart = Date.now();
            await page.goto(accreditServiceLink);
            logger(`🔗 Accredit URL : 
              ${accreditServiceLink}`);
            logger(
              `✅ Completed (${Date.now() - actionStart}ms)`
            );
          } else if (addOrRemove === "remove") {
            logger(
              `➕ Removing Commissioner ${commissionerId}`
            );
            const actionStart = Date.now();
            await page.goto(removeCommissionerLink);
            logger(`🔗 Remove URL :
               ${removeCommissionerLink}`);
            logger(
              `✅ Completed (${Date.now() - actionStart}ms)`
            );

          } else {
            throw new Error(`Unknown action: ${addOrRemove}`);
          }

          successCount++;
          const CsvLine = `"${odsCode}", ${addOrRemove}, ${Date.now()}\n`;
          fs.appendFileSync(
            resultsCsvPath,
            CsvLine,
            "utf8"
          );
        } catch (err) {
          logger(`❌ Failed for ${odsCode}: ${err?.message}`);
          failedCount++;
          const failedCsvLine = `"${odsCode}",${err?.message}\n`;

          fs.appendFileSync(
            failedCsvPath,
            failedCsvLine,
            "utf8"
          );
          continue;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const rowsPerMinute =
        (
          successCount /
          ((Date.now() - startTime) / 60000)
        ).toFixed(1);



      logger("");
      logger("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      logger("🏁 Flu 2026 Run Complete");
      logger("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      logger(`⏱️ Duration      : ${duration}s`);
      logger(`✅ Successful    : ${successCount}`);
      logger(`❌ Failed        : ${failedCount}`);
      logger(`📦 Total Rows    : ${customers.length}`);
      logger(`⚡ Throughput    : ${rowsPerMinute} rows/min`);

      const processed =
        successCount + failedCount;

      logger(
        `📊 Completion    : ${(
          (processed / customers.length) * 100
        ).toFixed(1)}%`
      );

      logger("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    }
  });
}
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});