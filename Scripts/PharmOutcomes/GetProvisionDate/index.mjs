import { runScript } from "../../common/runScript.mjs";

import {
  login,
  securityWord,
  loginAsProvider
} from "../helpers.mjs";
import fs from "node:fs";
import path from "node:path";
import { logAction, scriptStatus } from "../../common/common.mjs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function run() {
  await runScript({
    async main({ page, rows, logger, username, password, runAdvanced }) {

      await logAction("Login", () =>
        login(page, username, password, "prim"),
        logger
      );

      await loginAsProvider(page, "FTT82");
      const results = [];

      const outputFile = "ProvisionDates.csv";

      // Write header if file doesn't exist
      if (!fs.existsSync(outputFile)) {
        fs.writeFileSync(
          outputFile,
          "csvValue,spid,foundDate\n",
          "utf8"
        );
      }

      //now loop through CSV
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        await page.goto("/services/home");
        logger(`ROW ${i + 1}/${rows.length}`);
        logger(`Processing row: ${JSON.stringify(row)}`);
        const csvValue = row.cascadeid;
        const spid = csvValue.match(/SPID-(\d+)/)?.[1];
        logger(`SPID: ${spid}`);
        await page.fill("#search", `=${spid}`);
        await page.click("[type='submit'][value='submit']");
        await page.locator(`a[href*="edit=${spid}"]`).first().click();

        const provisionDate = await page.locator("#inProvisionDate").inputValue();
        logger(`Provision Date: ${provisionDate}`);
        const csvLine =
          `"${csvValue}","${spid}","${provisionDate}"\n`;

        fs.appendFileSync(
          outputFile,
          csvLine,
          "utf8"
        );

        logger(`✅ Saved ${spid}`);
      }

    }
  });
}

// ✅ required for your runner
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});