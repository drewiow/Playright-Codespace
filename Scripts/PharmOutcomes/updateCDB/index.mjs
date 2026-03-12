import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { login, editProvider, setupContext } from "./helpers.mjs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
dotenv.config();

// Recreate __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  const { browser, context, page } = await setupContext();
  const dataPath = path.resolve(__dirname, "./input/cdbUpdates.json");
  console.log("📁 Looking for cdbUpdates.json at:", dataPath);

  let changes;
  try {
    const raw = fs.readFileSync(dataPath, "utf-8");
    changes = JSON.parse(raw);
  } catch (err) {
    console.error("❌ Error reading cdbUpdates.json:", err.message);
    process.exit(1);
  }

  console.log(changes);

  for (const { odsCode, cdbNumber } of changes) {
    console.log(`🔄 Updating ${odsCode}`);
    // Log in the the site
    await login(page, process.env.USERNAME, process.env.PASSWORD, odsCode);

    try {
      await await editProvider(page, odsCode);
      console.log("Check passed, continuing...");
    } catch (err) {
      console.error("Caught error:", err.message);
      const csvRow = `"ERROR : ${odsCode}","${cdbNumber}","${emailAddress}"\n`;
      fs.appendFileSync("results/cdbUpdates.csv", csvRow);
    }

    // Update ODB
    await page.fill("#inCDBNumber", cdbNumber);

    //grab Email address and log it
    let emailAddress = await page.inputValue("#inManagementEmail");
    const csvRow = `"${odsCode}","${cdbNumber}","${emailAddress}"\n`;
    fs.appendFileSync("results/cdbUpdates.csv", csvRow);

    // Save provider
    await page.click('[value="Save"]');
    // Logout
    await page.click('[value="Exit"]');
  }

  await browser.close();
})();
