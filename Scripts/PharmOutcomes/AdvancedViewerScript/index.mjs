import { runScript } from "../../common/runScript.mjs";

import {
  login,
  editViewer,
  normaliseKey
} from "../helpers.mjs";

import fs from "node:fs";
import path from "node:path";

export default async function run() {
  await runScript({
    async main({ page, rows, logger, username, password, runAdvanced, config }) {

      const odsColumnRaw = process.env.ODS_COLUMN || "odscode";
      const odsColumn = normaliseKey(odsColumnRaw);

      const resultsPath = path.join(config.runDir, "meshUpdated.csv");
      fs.writeFileSync(resultsPath, "ODSCode,Timestamp\n");

      const startTime = Date.now();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        logger(`ROW ${i + 1}/${rows.length}`);
        logger("ODS Column:", odsColumn);

        const odsCode = row[odsColumn];

        if (!odsCode) {
          logger("⚠️ Skipping row with no ODS code:", row);
          continue;
        }

        logger(`🔄 Processing ODS: ${odsCode}`);

        try {
          await login(page, username, password, odsCode);

          await editViewer(page, odsCode);

          // ✅ centralised advanced logic
          await runAdvanced(row, i + 1);

          const csvRow = `"${odsCode}","${new Date().toISOString()}"\n`;
          fs.appendFileSync(resultsPath, csvRow);

          await page.click('[value="Exit"]');

          logger(`✅ Row completed: ${odsCode}`);

        } catch (err) {
          logger(`❌ Failed for ${odsCode}: ${err?.message}`);
          continue;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger(`⏱️ Script completed in ${duration} seconds`);

      // ✅ video
      if (config.recordVideo && page.saveVideo) {
        await page.saveVideo(`run-${Date.now()}`);
      }

      // ✅ trace
      if (config.recordTrace) {
        const tracePath = path.join(config.runDir, "trace.zip");
        await page.context().tracing.stop({ path: tracePath });
      }

      // ✅ human mode
      if (config.human) {
        logger("🕒 Browser will remain open...");
        await new Promise(() => { });
      }
    }
  });
}

// ✅ keep this (your runner currently needs it)
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});