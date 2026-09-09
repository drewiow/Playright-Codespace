import { runScript } from "../../common/runScript.mjs";
import { login, editProvider, accreditBySysId, removeCommissionerBySysId } from "../helpers.mjs";
import { logAction, getMappedValue, toTitleCase, parseCSV } from "../../common/common.mjs";
import { LoggerEvent } from "../../common/loggerEvents.js";
import fs from "node:fs";
import path from "node:path";

export default async function run() {
  await runScript({
    async main({ page, rows, logger, username, password, config }) {

      logger("🚀 Starting script...");
      const runDir = config.runDir;
      if (runDir && !fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
      }

      const inputCsvPath = process.env.INPUT_CSV_PATH || process.env.CSV_PATH;

      if (!inputCsvPath) { throw new Error("No CSV path provided (INPUT_CSV_PATH or CSV_PATH)"); }

      try {
        const raw = fs.readFileSync(inputCsvPath, "utf-8");
        rows = parseCSV(raw);
        logger(`✅ Loaded ${rows.length} rows from CSV`);
      } catch (err) {
        logger("❌ Error reading CSV:", err.message);
        throw err;
      }

      const successCsvPath = path.join(runDir, "Addedrows.csv");
      const failedCsvPath = path.join(runDir, "Failedrows.csv");

      if (!fs.existsSync(successCsvPath)) {
        fs.writeFileSync(successCsvPath, "odsCode, action, createdAt\n", "utf-8");
      }

      if (!fs.existsSync(failedCsvPath)) {
        fs.writeFileSync(failedCsvPath, "odsCode, reason\n", "utf-8");
      }

      const startTime = Date.now();
      const mappings = JSON.parse(process.env.COLUMN_MAPPINGS || "{}");
      let successCount = 0;
      let failedCount = 0;
      const serviceId = process.env.SERVICEID;
      const commissionerId = process.env.COMMISSIONERID;

      await login(page, username, password);

      const posToken = await page.evaluate(() => { return SessionToken().match(/=([^&]+)/)?.[1]; });

      logger("🚀 Starting Flu 2026 Automation");
      logger(`📦 Loaded ${rows.length} Pharmacies`);
      logger(`🎯 Service ID: ${serviceId}`);
      logger(`🏛️ Commissioner ID: ${commissionerId}`);
      logger(`🎫 Session Token: ${posToken.substring(0, 12)}...`);
      logger("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      for (let i = 0; i < rows.length; i++) {

        const row = rows[i];
        const odsCode = getMappedValue(row, mappings, "odsCode");
        const addOrRemove = (getMappedValue(row, mappings, "addorRemove") || "").toLowerCase(); const sysId = getMappedValue(row, mappings, "sysId");

        if (!odsCode || !addOrRemove) {
          const reason = [!odsCode ? "Missing ODS Code" : null, !addOrRemove ? "Missing Add/Remove value" : null].filter(Boolean).join(", ");
          logger(`⚠️ Skip [${i + 1}] ${reason}`);

          failedCount++;
          fs.appendFileSync(failedCsvPath, `"${odsCode || i}","${reason}"\n`, "utf8");
          continue;
        }

        logger(`🏥 [${i + 1}/${rows.length}] : ${odsCode}`);

        try {

          const createdAt = new Date().toISOString();

          if (addOrRemove === "add") {
            await accreditBySysId(page, sysId, [serviceId], posToken, logger);
          } else if (addOrRemove === "remove") {
            await removeCommissionerBySysId(page, sysId, commissionerId, posToken, logger);
          } else {
            throw new Error(`Unknown action: ${addOrRemove}`);
          }

          successCount++;
          const CsvLine = `"${odsCode}", ${addOrRemove}, ${createdAt}\n`;
          fs.appendFileSync(successCsvPath, CsvLine, "utf8");
        } catch (err) {
          logger(`❌ Failed for ${odsCode}: ${err?.message}`);
          failedCount++;
          const failedCsvLine = `"${odsCode}",${err?.message}\n`;
          fs.appendFileSync(failedCsvPath, failedCsvLine, "utf8");
          continue;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const rowsPerMinute = (successCount / ((Date.now() - startTime) / 60000)).toFixed(1);
      const processed = successCount + failedCount;

      logger("");
      logger("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      logger("🏁 Flu 2026 Run Complete");
      logger("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      logger(`⏱️ Duration      : ${duration}s`);
      logger(`✅ Successful    : ${successCount}`);
      logger(`❌ Failed        : ${failedCount}`);
      logger(`📦 Total Rows    : ${rows.length}`);
      logger(`⚡ Throughput    : ${rowsPerMinute} rows/min`);
      logger(`📊 Completion    : ${((processed / rows.length) * 100).toFixed(1)}%`);
      logger("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    }
  });
}
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});