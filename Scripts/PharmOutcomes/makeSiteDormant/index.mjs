import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import {
  login,
  editProvider,
  deaccredit,
  addAudit,
  setupContext,
} from "./helpers.mjs";
import dotenv from "dotenv";
dotenv.config();

(async () => {
  const { browser, context, page } = await setupContext();
  const dataPath = path.resolve(__dirname, "./input/closures.json");
  const closures = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  for (const { odscode, caseref, PIDService } of closures) {
    console.log(`🔍 Processing: ${odscode}`);

    await login(page, process.env.USERNAME, process.env.PASSWORD, odscode);
    await editProvider(page, odscode);


    // Make site dormant
    await deaccredit(page, PIDService);

    const input = await page.$("#inAccountRef");
    const currentValue = await input.inputValue();

    if (!currentValue.includes("EX-COVID")) {
      await input.fill("EX_COVID");
    } else {
      console.log("ℹ️ Input already contains expected text, skipping.");
    }

    await addAudit(page, caseref);
    await page.waitForTimeout(1000);

    // Save provider
    //await page.click('[value="Save"]');

    // Log to CSV
    const csvRow = `"${odscode}","${caseref}","${PIDService}","${new Date().toISOString()}"\n`;
    fs.appendFileSync("results/Closed.csv", csvRow);

    // Logout
    await page.click('[value="Exit"]');
  }

  await browser.close();
})();
