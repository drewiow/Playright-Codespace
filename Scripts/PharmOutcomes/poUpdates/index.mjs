import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { login, securityWord, setupContext } from "./helpers.mjs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

(async () => {
  const startTime = new Date();
  const { browser, context, page } = await setupContext();
  const service = "140834";
  const commissioner = "1505394";

  try {
    await login(page, process.env.USERNAME, process.env.PASSWORD, "PRIM");
    console.log(`✅ Logged into PRIM`);
  } catch (err) {
    console.error(`❌ Failed to log in:`, err);
    process.exit(1);
  }

  // Login as commissioner
  await page.goto(
    `https://outcomes4health.org/o4h/admin/loginas?id=${commissioner}`
  );

  // Security word step
  await securityWord(page);

  // Go to accreditation page
  await page.goto(
    `https://outcomes4health.org/o4h/admin/accreditations/?service=${service}`
  );

  // Read CSV
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const csvPath = path.resolve(__dirname, "./input/poUpdates.csv");

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const rows = csvContent
    .split("\n")
    .slice(1)
    .map((row) => row.trim());
  const poMap = Object.fromEntries(
    rows
      .map((row) => row.split(",").map((col) => col.trim()))
      .filter(([odsCode, poNumber]) => odsCode && poNumber)
  );

  // Update PO numbers in checked rows
  const checkedRows = await page.$$("table tbody tr");
  for (const row of checkedRows) {
    const isChecked = await row.$('input[type="checkbox"]:checked');
    if (isChecked) {
      const codeElement = await row.$("td small");
      const codeText = await codeElement?.innerText();
      const match = codeText?.match(/^[A-Z]+\d+/);
      const odsCode = match?.[0];
      const poNumber = poMap[odsCode];

      console.log(`Row ODS: ${odsCode}, PO: ${poNumber}`);

      if (odsCode && poNumber) {
        const allInputs = await row.$$("input");
        const visibleInputs = [];

        for (const input of allInputs) {
          const type = await input.getAttribute("type");
          const isHidden = await input.evaluate(
            (el) => el.offsetParent === null
          );
          if (!isHidden && type !== "hidden") {
            visibleInputs.push(input);
          }
        }

        if (visibleInputs.length >= 2) {
          await visibleInputs[2].fill("");
          await visibleInputs[2].type(poNumber);
          console.log(`✅ Filled PO for ${odsCode}`);
        } else {
          console.warn(`⚠️ Not enough visible inputs found for ${odsCode}`);
        }
      } else {
        console.warn(`No match or PO number for code: ${codeText}`);
      }
    }
  }

  const endTime = new Date();
  const durationMs = endTime - startTime;

  console.log(`🕒 Start: ${startTime.toLocaleTimeString()}`);
  console.log(`🕒 End: ${endTime.toLocaleTimeString()}`);
  console.log(`⏱️ Duration: ${(durationMs / 1000).toFixed(2)} seconds`);

  // Optionally save
  // await page.click('[value="Save"]');

  // Keep browser open
  await browser.close();
})();
