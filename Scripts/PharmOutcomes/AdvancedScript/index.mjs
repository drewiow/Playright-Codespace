import { runScript } from "../../common/runScript.mjs";
import { getMappedValue } from "../../common/common.mjs";
import { login, editProvider, editCommissioner, editViewer, openOrganisation } from "../../pharmoutcomes/helpers.mjs";

export default async function run() {
  await runScript({
    async main({ page, rows, logger, username, password, runAdvanced }) {

      await login(page, username, password);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const mappings = JSON.parse(process.env.COLUMN_MAPPINGS || "{}");
        const odsCode = getMappedValue(row, mappings, "odsCode");

        if (!odsCode) {
          logger("⚠️ Missing ODS code, skipping row");
          continue;
        }

        logger(`ROW ${i + 1}/${rows.length}`);
        logger(`🔄 Processing ODS: ${odsCode}`);

        try {
          await openOrganisation(
            page,
            odsCode,
            { editProvider, editViewer, editCommissioner }, logger
          );

          await runAdvanced(row, i + 1);

          logger(`✅ Completed: ${odsCode}`);

        } catch (err) {
          logger(`❌ Failed for ${odsCode}: ${err?.message}`);
          continue;
        }


      }
      await page.click('[value="Exit"]');
    }
  });
}
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});