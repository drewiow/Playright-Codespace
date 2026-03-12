import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { login, setupContext } from "./helpers.mjs";
import { fileURLToPath } from "url";

dotenv.config();

(async () => {
  const startTime = new Date();
  const { browser, context, page } = await setupContext();

  // Recreate __dirname
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  //open Odscodes json file and loop through
  const odsPath = path.resolve(__dirname, "./input/findOdsCodes.json");
  const odsCodes = JSON.parse(fs.readFileSync(odsPath, "utf-8"));
  for (const { primaryOdscode } of odsCodes) {
    console.log(`🔍 Checking ODS Code: ${primaryOdscode}`);

    const regionsPath = path.resolve(__dirname, "./input/regions.json");
    const regions = JSON.parse(fs.readFileSync(regionsPath, "utf-8"));

    for (const { name, odscode } of regions) {
      console.log(`🔍 Checking region: ${name} (${odscode})`);

      try {
        await login(page, process.env.USERNAME, process.env.PASSWORD, odscode);
      } catch (err) {
        console.error(`❌ Login failed for ${name}:`, err);
        continue;
      }

      await page.goto("https://outcomes4health.org/o4h/admin/providers");
      await page.fill("#providerlookup", primaryOdscode + "COV");

      try {
        await page.waitForSelector("#ui-id-1", { timeout: 5000 });
      } catch {
        console.log(`⚠️ No results found for ${primaryOdscode} in ${name}`);
        continue;
      }

      const items = await page.$$("#ui-id-1 li");
      for (const item of items) {
        const text = await item.textContent();
        if (text.includes("No matches")) {
          console.log(`🚫 No matches in ${name}`);
          continue;
        }

        const csvRow = `"${primaryOdscode}","${name}","${text.trim()}"`;
        console.log(`✅ Found: ${csvRow}`);

        fs.appendFileSync("results/Regions.csv", csvRow + "\n");
      }
      await page.click('[value="Exit"]');
    }
  }

  const endTime = new Date();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`⏱️ Script completed in ${duration} seconds`);

  await browser.close();
})();
