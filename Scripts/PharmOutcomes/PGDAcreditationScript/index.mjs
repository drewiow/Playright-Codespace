import { runScript } from "../../common/runScript.mjs";

import {
  login,
  editProvider,
  addCommissioner,
  accredit
} from "../helpers.mjs";

export default async function run() {
  await runScript({
    async main({ page, rows, logger, username, password, runAdvanced }) {

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const odsCode = row.odscode;

        logger(`ROW ${i + 1}/${rows.length}`);

        if (!odsCode) {
          logger("⚠️ Missing ODS code, skipping row");
          continue;
        }

        logger(`🔄 Processing ${odsCode}`);

        try {
          await login(page, username, password, odsCode);

          await editProvider(page, odsCode);

          await addCommissioner(page, "46871614");

          /*
          COVID Vaccine - 167009
          Meningitis B Vaccination - 166874
          Period Delay - 167126
          Pneumococcal Vaccine PCV - 167139
          */
          await accredit(page, ["167009", "166874", "167126", "167139"]);

          // ✅ optional advanced feature
          await runAdvanced(row, i + 1);

          await page.click('[value="Exit"]');

          logger(`✅ Completed: ${odsCode}`);

        } catch (err) {
          logger(`❌ Failed for ${odsCode}: ${err?.message}`);
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