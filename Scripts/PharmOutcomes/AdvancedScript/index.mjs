import { runScript } from "../../common/runScript.mjs";

import {
  login,
  editProvider,
  editCommissioner,
  editViewer,
  openOrganisation
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

        logger(`🔄 Processing ODS: ${odsCode}`);

        try {

          // ✅ HARD RESET
          await page.goto("https://outcomes4health.org/o4h/", {
            waitUntil: "networkidle"
          });

          await login(page, username, password, odsCode);
          const type = await openOrganisation(
            page,
            odsCode,
            { editProvider, editViewer, editCommissioner },
            logger
          );

          // ✅ advanced feature (centralised)
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