import { runScript } from "../../common/runScript.mjs";

import { login } from "../helpers.mjs";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function run() {
  await runScript({
    async main({ page, logger, username, password }) {

      const targetOdsCode = process.env.ODSCODE;

      if (!targetOdsCode) {
        throw new Error("Missing ODSCODE dynamic input");
      }

      // ✅ load regions
      const regionsPath = path.resolve(__dirname, "../input/regions.json");
      const regions = JSON.parse(fs.readFileSync(regionsPath, "utf-8"));

      const startTime = Date.now();

      for (const { name, odscode } of regions) {

        logger(`🔍 Checking region: ${name} (${odscode})`);

        try {
          await login(page, username, password, odscode);
        } catch (err) {
          logger(`❌ Login failed for ${name}: ${err?.message}`);
          continue;
        }

        await page.goto("https://outcomes4health.org/o4h/admin/providers");

        await page.fill("#providerlookup", targetOdsCode);

        try {
          await page.waitForSelector("#ui-id-1", { timeout: 5000 });
        } catch {
          logger(`⚠️ No results found for ${targetOdsCode} in ${name}`);
          continue;
        }

        const items = await page.$$("#ui-id-1 li");

        for (const item of items) {
          const text = (await item.textContent())?.trim() || "";

          if (text.includes("No matches")) {
            logger(`🚫 No matches in ${name}`);
          } else {
            logger(`✅ Found match in ${name}: ${text}`);
          }
        }

        await page.click('[value="Exit"]');
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger(`⏱️ Script completed in ${duration} seconds`);
    }
  });
}

// ✅ required for your runner
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});