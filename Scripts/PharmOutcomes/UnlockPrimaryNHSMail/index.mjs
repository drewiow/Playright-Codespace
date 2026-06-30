import { runScript } from "../../common/runScript.mjs";

import {
  login,
  securityWord
} from "../helpers.mjs";

import { logAction, scriptStatus } from "../../common/common.mjs";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function run() {
  await runScript({
    async main({ page, logger, username, password, config }) {

      await logAction("Login", () =>
        login(page, username, password, "prim"),
        logger
      );

      while (true) {

        await page.goto("https://outcomes4health.org/o4h/admin/web?nhsnetlock");

        const submitButton = await page.$('input.submit.full-lock[name="submit"]');

        if (submitButton) {
          const isDisabled = await submitButton.getAttribute("disabled");

          if (!isDisabled) {
            await submitButton.click();
          } else {
            logger("⛔ Button is disabled, skipping.");
          }
        } else {
          logger("⚠️ Submit button not found.");
        }

        await page.waitForTimeout(30000);
      }
    }
  });
}

// ✅ required for your runner
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});