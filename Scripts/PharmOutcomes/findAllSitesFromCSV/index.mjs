import { runScript } from "../../common/runScript.mjs";

import {
  resolveOdsContext
} from "../helpers.mjs";

import fs from "node:fs";
import path from "node:path";

export default async function run() {
  await runScript({
    async main({ page, rows, logger, config }) {

      const odsKey = process.env.ODS_COLUMN;

      if (!odsKey) {
        throw new Error("ODS_COLUMN environment variable not set");
      }

      const notFoundResultsPath = path.join(config.runDir, "notFound.csv");
      const foundResultsPath = path.join(config.runDir, "Found.csv");

      fs.writeFileSync(notFoundResultsPath, "ODSCode,Timestamp\n");
      fs.writeFileSync(foundResultsPath, "ODSCode,Region,Timestamp\n");

      const startTime = Date.now();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const odsCode = row[odsKey];

        if (!odsCode) {
          logger(`⚠️ Missing ODS in column "${odsKey}"`);
          continue;
        }

        logger(`\n==============================`);
        logger(`🔄 Processing ${i + 1}/${rows.length}: ${odsCode}`);

        try {
          // ✅ always reset state
          await page.goto("/", {
            waitUntil: "networkidle"
          });

          const result = await resolveOdsContext(page, odsCode, logger);

          logger(`✅ Exists: ${result.exists}`);
          logger(`📍 Region: ${result.region || "Unknown"}`);

          if (!result.exists) {
            const csvRow = `"${odsCode}","${new Date().toISOString()}"\n`;
            fs.appendFileSync(notFoundResultsPath, csvRow);
          } else {
            const csvRow = `"${odsCode}","${result.region || "Unknown"}","${new Date().toISOString()}"\n`;
            fs.appendFileSync(foundResultsPath, csvRow);
          }

        } catch (err) {
          logger(`❌ ODS lookup failed for ${odsCode}: ${err?.message}`);

          const csvRow = `"${odsCode}","${new Date().toISOString()}"\n`;
          fs.appendFileSync(notFoundResultsPath, csvRow);
        }

        // ✅ isolate sessions between rows
        await page.context().clearCookies();
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

// ✅ required for your runner
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});