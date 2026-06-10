import { runScript } from "../../common/runScript.mjs";

import {
  login,
  editCommissioner
} from "../helpers.mjs";

import fs from "node:fs";
import path from "node:path";

export default async function run() {
  await runScript({
    async main({ page, rows, logger, username, password, runAdvanced, config }) {

      const resultsPath = path.join(config.runDir, "meshUpdated.csv");
      fs.writeFileSync(resultsPath, "ODSCode,Timestamp\n");

      const startTime = Date.now();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        const odsCode = row.odscode || row.ODSCode || row.ODS || "";

        logger(`ROW ${i + 1}/${rows.length}`);

        if (!odsCode) {
          logger("⚠️ Skipping row with no ODS code:", row);
          continue;
        }

        logger(`🔄 Updating ${odsCode}`);

        try {
          await login(page, username, password, odsCode);

          await editCommissioner(page, odsCode);

          // ✅ now handled centrally
          await runAdvanced(row, i + 1);

          const csvRow = `"${odsCode}","${new Date().toISOString()}"\n`;
          fs.appendFileSync(resultsPath, csvRow);

          await page.click('[value="Exit"]');

          logger(`✅ Completed: ${odsCode}`);

        } catch (err) {
          logger(`❌ Failed for ${odsCode}: ${err?.message}`);
          continue;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger(`⏱️ Script completed in ${duration} seconds`);

      // ✅ Video (still supported via config)
      if (config.recordVideo && page.saveVideo) {
        await page.saveVideo(`run-${Date.now()}`);
      }

      // ✅ Trace
      if (config.recordTrace) {
        const tracePath = path.join(config.runDir, "trace.zip");
        await page.context().tracing.stop({ path: tracePath });
      }

      // ✅ Human mode (leave browser open)
      if (config.human) {
        logger("🕒 Browser will remain open...");
        await new Promise(() => { });
      }
    }
  });
}

// ✅ REQUIRED (your current runner needs this)
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});