import { runScript } from "../../common/runScript.mjs";

import {
  login,
} from "../helpers.mjs";

export default async function run() {
  await runScript({
    async main({ page, rows, logger, username, password, runAdvanced }) {

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        logger(`ROW ${i + 1}/${rows.length}`);

        try {

          // ✅ HARD RESET
          await page.goto("https://direct.pharmoutcomes.org/", {
            waitUntil: "networkidle"
          });

          await page.locator('.hero__button-group')
            .getByRole('button', { name: 'Sign in' })
            .click();

          await login(page, username, password);

          // ✅ advanced feature (centralised)
          await runAdvanced(row, i + 1);

          logger(`✅ Completed: ${odsCode}`);

        } catch (err) {
          logger(`❌ Failed : ${err?.message}`);
          continue;
        }
      }
    }
  });
}
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});