import { runScript } from "../../common/runScript.mjs";

import {
  login,
  securityWord
} from "../helpers.mjs";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function run() {
  await runScript({
    async main({ page, logger, username, password, config }) {

      const startTime = new Date();

      logger(`🚀 Starting COVID accreditation count script...`);
      logger(`📅 Start time: ${startTime.toLocaleString()}`);

      // ✅ results folder
      const resultsDir = path.resolve(__dirname, "results");
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }

      const csvPath = path.join(resultsDir, "CovidCount.csv");

      // ✅ regions input
      const regionsPath = path.resolve(__dirname, "../input/regions.json");

      logger(`Resolved paths: csvPath=${csvPath} regionsPath=${regionsPath}`);

      if (!fs.existsSync(regionsPath)) {
        logger("❌ ERROR: regions.json not found at", regionsPath);
        return;
      }

      const regions = JSON.parse(fs.readFileSync(regionsPath, "utf-8"));
      logger(`📁 Loaded ${regions.length} regions`);

      fs.appendFileSync(csvPath, `"Date","${new Date().toISOString()}"\n`);

      let totalAccredited = 0;
      let findings = [];

      for (const { name, odscode } of regions) {

        const regionStart = Date.now();

        logger(`\n🔍 Checking region: ${name} (${odscode})`);

        try {
          await login(page, username, password, odscode);
          logger("✅ Login successful");
        } catch (err) {
          logger(`❌ Login failed for ${name}:`, err?.message || err);
          continue;
        }

        try {
          await page.goto(
            "https://outcomes4health.org/o4h/admin/loginas?id=881686",
            { waitUntil: "networkidle" }
          );

          await securityWord(page);

          await page.goto(
            "https://outcomes4health.org/o4h/admin/accreditations?category=COVID%20Vaccination%202025/26",
            { waitUntil: "networkidle" }
          );

          const accredited = await page.evaluate(() => {
            return Array.from(
              document.querySelectorAll(
                'tr:not(.green):not(.rosybrown) td[cat="accredit"] input[type="checkbox"]'
              )
            ).filter(cb => cb.checked).length;
          });

          logger(`🧮 Accredited count for ${name}: ${accredited}`);

          fs.appendFileSync(csvPath, `"${name}",${accredited}\n`);

          totalAccredited += accredited;
          findings.push({ name, accredited });

          await page.click('[value="Exit"]');

        } catch (err) {
          logger(`❌ Error while processing region ${name}:`, err?.message || err);
        }

        const duration = ((Date.now() - regionStart) / 1000).toFixed(2);
        logger(`⏱️ Region completed in ${duration} seconds`);
      }

      logger("------------------------------------------------------------");
      logger(`📊 Total accredited across all regions: ${totalAccredited}`);

      fs.appendFileSync(csvPath, `"Total",${totalAccredited}\n`);

      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

      logger("------------------------------------------------------------");
      logger(`🎉 All regions processed`);
      logger(`⏱️ Total script duration: ${totalDuration} seconds`);
      logger("📁 Results saved to CovidCount.csv");

      // ✅ summary
      logger("\n📋 Accreditation summary:");
      logger("----------------------------------------------");
      logger("Region".padEnd(40) + "Accredited");
      logger("----------------------------------------------");

      for (const f of findings) {
        logger(f.name.padEnd(40) + f.accredited);
      }

      logger("----------------------------------------------");
      logger(`TOTAL`.padEnd(40) + totalAccredited);
      logger("----------------------------------------------");

    }
  });
}

// ✅ required for your current runner
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});