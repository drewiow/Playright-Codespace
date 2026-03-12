import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { login, setupContext } from "./helpers.mjs";
import dotenv from "dotenv";
dotenv.config();

(async () => {
  const { browser, context, page } = await setupContext();
  const regionsPath = path.resolve("./input/SiteCheck.json");
  const pharmacies = JSON.parse(fs.readFileSync(regionsPath, "utf-8"));

  for (const { odsCode } of pharmacies) {
    await login(page, process.env.USERNAME, process.env.PASSWORD, odsCode);
    // Logout
    await page.click('[value="Exit"]');
  }
})();
