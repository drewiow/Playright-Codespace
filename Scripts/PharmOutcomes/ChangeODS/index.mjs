import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { login, editProvider, addAudit, setupContext } from "./helpers.mjs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
dotenv.config();

(async () => {
  const { browser, context, page } = await setupContext();
  // Recreate __dirname
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const dataPath = path.resolve(__dirname, "./input/odsChange.json");
  const changes = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  const caseRef = "CS1615923";

  for (const { oldCode, newCode } of changes) {
    const parentCode = newCode.slice(0, -3);

    console.log(`🔄 Changing ${oldCode} → ${newCode}`);
    // Log in the the site
    await login(page, process.env.USERNAME, process.env.PASSWORD, oldCode);

    // Get to the provider edit screen
    await editProvider(page, oldCode);

    // Change ODS code
    await page.fill("#inNHSCode", newCode);

    // Add an audit
    //await addAudit(page, caseRef);
    //await page.waitForTimeout(1000);

    // Save provider
    await page.click('[value="Save"]');

    // Add migration table record
    await page.goto("https://outcomes4health.org/o4h/admin/web?migrations&new");
    await page.fill("#inODSCode", newCode);
    await page.fill("#inPreviousODSCode", parentCode);
    await page.selectOption("#inPreviousInstance", { index: 1 });
    await page.click("#saveMigration");

    // Log to CSV
    const csvRow = `"${oldCode}","${newCode}","${new Date().toISOString()}"\n`;
    fs.appendFileSync("results/ChangedODS.csv", csvRow);

    // Logout
    await page.click('[value="Exit"]');
  }

  await browser.close();
})();
