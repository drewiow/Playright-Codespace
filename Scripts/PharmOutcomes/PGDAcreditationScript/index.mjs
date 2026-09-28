import { runScript } from "../../common/runScript.mjs";
import { login, editProvider, accredit } from "../../pharmoutcomes/helpers.mjs";
import { getMappedValue, toTitleCase, parseCSV } from "../../common/common.mjs";
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
          "odsCode, requestedAt, createdAt\n",
          "utf-8"
        );
      }

      if (!fs.existsSync(failedCsvPath)) {
        fs.writeFileSync(
          failedCsvPath,
          "odsCode, requestedAt, reason\n",
          "utf-8"
        );
      }

      const startTime = Date.now();
      const mappings = JSON.parse(process.env.COLUMN_MAPPINGS || "{}");
      let successCount = 0;
      let failedCount = 0;

      logger("🔧 BEGIN CUSTOMER CREATION LOOP");

      const SERVICE_IDS = {
        covidVaccination: "167009",
        meningitisBVaccination: "166874",
        periodDelay: "167126",
        pneumococcalVaccination: "167139",
        shinglesVaccination: "167027",
        seasonalFluVaccination: "167598",
        allergicRhinitisAzelastine: "167133",
        allergicRhinitisDymista: "167606",
        allergicRhinitisFexofenadine: "167620",
        antimalariasMefloquine: "167656",
        chickenpoxVaccination: "167577",
        mounjaroWegovyInitialSupply: "166865",
        mounjaroWegovySubsequentSupplies: "167051"

      };

      for (let i = 0; i < customers.length; i++) {

        const row = customers[i];

        const request = {
          sysId: getMappedValue(row, mappings, "sysId"),
          odsCode: getMappedValue(row, mappings, "odsCode"),
          provisionDate: getMappedValue(row, mappings, "provisionDate"),
          provider: getMappedValue(row, mappings, "provider"),
          covidVaccination: getMappedValue(row, mappings, "covidVaccination"),
          seasonalFluVaccination: getMappedValue(row, mappings, "seasonalFluVaccination"),
          meningitisBVaccination: getMappedValue(row, mappings, "meningitisBVaccination"),
          periodDelay: getMappedValue(row, mappings, "periodDelay"),
          pneumococcalVaccination: getMappedValue(row, mappings, "pneumococcalVaccination"),
          shinglesVaccination: getMappedValue(row, mappings, "shinglesVaccination"),
          allergicRhinitisAzelastine: getMappedValue(row, mappings, "allergicRhinitisAzelastine"),
          allergicRhinitisDymista: getMappedValue(row, mappings, "allergicRhinitisDymista"),
          allergicRhinitisFexofenadine: getMappedValue(row, mappings, "allergicRhinitisFexofenadine"),
          antimalariasMefloquine: getMappedValue(row, mappings, "antimalariasMefloquine"),
          chickenpoxVaccination: getMappedValue(row, mappings, "chickenpoxVaccination"),
          mounjaroWegovyInitialSupply: getMappedValue(row, mappings, "mounjaroWegovyInitialSupply"),
          mounjaroWegovySubsequentSupplies: getMappedValue(row, mappings, "mounjaroWegovySubsequentSupplies"),
          otherService: getMappedValue(row, mappings, "otherService"),
          pharmacistName: toTitleCase(getMappedValue(row, mappings, "pharmacistName")),
          telephoneNumber: getMappedValue(row, mappings, "telephoneNumber").replace(/[^\d+]/g, "").trim(),
          notificationStatus: getMappedValue(row, mappings, "notificationStatus"),
          recordStatus: getMappedValue(row, mappings, "recordStatus")
        };


        logger.rowStart(
          i + 1,
          customers.length,
          request.odsCode
        );

        const servicesToAccredit = [];

        Object.entries(SERVICE_IDS).forEach(([field, serviceId]) => {

          const value = request[field];

          if (!value) return;

          const selected =
            ["yes", "true", "y", "1"]
              .includes(
                String(value || "")
                  .trim()
                  .toLowerCase()
              );

          if (selected) {
            servicesToAccredit.push(serviceId);
          }
        });

        try {
          await login(page, username, password, logger);
          const posToken = await page.evaluate(() => {
            return SessionToken()
              .match(/=([^&]+)/)?.[1];
          });

          await editProvider(page, request.odsCode, logger);

          if (servicesToAccredit.length > 0) {
            await accredit(page, servicesToAccredit, logger);
          }
          else {
            logger(`⚠️ No services selected for ${request.odsCode}`);
          }
          await page.click('[value="Exit"]');
          successCount++;
          const CsvLine = `"${request.odsCode}",${request.provisionDate},${Date.now()}\n`;
          fs.appendFileSync(
            resultsCsvPath,
            CsvLine,
            "utf8"
          );
        } catch (err) {

          logger(
            `❌ Failed for ${request.odsCode}: ${err?.message}`
          );

          logger(
            err?.stack || String(err)
          );

          failedCount++;

          const failedCsvLine = `"${request.odsCode}",${request.provisionDate},${err?.message}\n`;
          fs.appendFileSync(
            failedCsvPath,
            failedCsvLine,
            "utf8"
          );
          continue;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger(`⏱️ Script completed in ${duration} seconds`);
      logger(`✅ Created: ${successCount}`);
      logger(`❌ Failed: ${failedCount}`);

    }
  });
}
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});