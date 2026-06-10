import { runScript } from "../../common/runScript.mjs";

import {
  login,
  editViewer
} from "../helpers.mjs";

import { logAction } from "../../common/common.mjs";

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

      const resultsCsvPath = path.join(runDir, "ProvidersLinked.csv");

      if (!fs.existsSync(resultsCsvPath)) {
        fs.writeFileSync(
          resultsCsvPath,
          "odsCode,headOffice,linkedAt\n",
          "utf-8"
        );
      }

      // ✅ Main loop
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        const odsCode = row.odscode ?? row.odsCode ?? "";
        const headOffice = row.headoffice ?? row.headOffice ?? "";

        logger(`\n🏥 Processing ${i + 1}/${rows.length}: ${odsCode} (${headOffice})`);

        if (!odsCode || !headOffice) {
          logger("⚠️ Missing required data, skipping row");
          continue;
        }

        try {
          await logAction("Login", () =>
            login(page, username, password, odsCode),
            logger
          );

          await logAction("Edit viewer", () =>
            editViewer(page, headOffice),
            logger
          );

          await logAction("Fill provider lookup", () =>
            page.fill("#providerlookup", odsCode),
            logger
          );

          await logAction("Wait for autocomplete", () =>
            page.waitForSelector("#ui-id-1", { timeout: 5000 }),
            logger
          );

          await logAction("Select first provider result", () =>
            page.locator("#ui-id-1 li").first().click(),
            logger
          );

          await logAction("Click Add Provider", () =>
            page.locator("#provider_add").click(),
            logger
          );

          const csvRow =
            `"${odsCode}","${headOffice}","${new Date().toISOString()}"\n`;

          fs.appendFileSync(resultsCsvPath, csvRow);

          logger("✅ Logged provider to CSV");

          await logAction("Logout", () =>
            page.click('[value="Exit"]'),
            logger
          );

        } catch (err) {
          logger(`❌ Failed for ${odsCode}: ${err?.message}`);
          continue;
        }
      }

      logger("✅ Script complete");

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