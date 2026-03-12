import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { login, setupContext, loginCommissioner } from "./helpers.mjs";
import dotenv from "dotenv";
dotenv.config();

(async () => {
  const { browser, context, page } = await setupContext();
  const regionsPath = path.resolve("./input/NotificationPharmacies.json");
  //const regionsPath = path.resolve("./input/NotificationTest.json");
  const pharmacies = JSON.parse(fs.readFileSync(regionsPath, "utf-8"));

  await login(page, process.env.USERNAME, process.env.PASSWORD, "prim");

  await loginCommissioner(page, "329661");

  await page.click('a[href*="/messages/edit?POSesTok="]');

  await page.fill("#inSubject", "COVID site move");

  // Wait for the iframe to be available
  const frame = await page.frameLocator('iframe[title="Rich Text Area"]');

  // Type into the TinyMCE body
  await frame.locator("body#tinymce").fill("Message here");

  await page.click('input[name="nextStep"]');

  for (const { SysID, Name } of pharmacies) {
    await page.check(`#chkOrg${SysID}`);
  }

  //go back and press save
  await page.click('input.submit.full-lock[value*="Message"]');
  await page.click('input.submit.full-lock[value*="Save"]');

  //await browser.close();
})();
