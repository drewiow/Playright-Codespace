import { runScript } from "../../common/runScript.mjs";

import {
  login,
  securityWord
} from "../helpers.mjs";

export default async function run() {
  await runScript({
    async main({ page, rows, logger, username, password }) {

      const service = process.env.SERVICE_ID || "140834";
      const commissioner = process.env.COMMISSIONER_ID || "1505394";

      const startTime = Date.now();

      // ✅ login once
      await login(page, username, password, "PRIM");
      logger("✅ Logged into PRIM");

      // ✅ switch to commissioner
      await page.goto(
        `/admin/loginas?id=${commissioner}`
      );

      await securityWord(page);

      // ✅ go to accreditation page
      await page.goto(
        `/admin/accreditations/?service=${service}`
      );

      // ✅ build lookup map from CSV (now using rows)
      const poMap = Object.fromEntries(
        rows
          .map(r => [
            (r.odscode || r.ODSCode || "").trim(),
            (r.ponumber || r.poNumber || "").trim()
          ])
          .filter(([odsCode, po]) => odsCode && po)
      );

      logger(`📦 Loaded ${Object.keys(poMap).length} PO mappings`);

      // ✅ process checked rows
      const tableRows = page.locator("table tbody tr");
      const rowCount = await tableRows.count();

      for (let i = 0; i < rowCount; i++) {
        const row = tableRows.nth(i);

        const checkbox = row.locator('input[type="checkbox"]');

        if (!(await checkbox.isChecked().catch(() => false))) {
          continue;
        }

        // ✅ get ODS code
        const codeText = await row.locator("td small").innerText().catch(() => "");
        const match = codeText.match(/^[A-Z]+\d+/);
        const odsCode = match?.[0];

        const poNumber = poMap[odsCode];

        logger(`Row ODS: ${odsCode}, PO: ${poNumber}`);

        if (!odsCode || !poNumber) {
          logger(`⚠️ No mapping found for ${codeText}`);
          continue;
        }

        // ✅ find visible inputs
        const inputs = row.locator("input");
        const inputCount = await inputs.count();

        let visibleInputs = [];

        for (let j = 0; j < inputCount; j++) {
          const input = inputs.nth(j);

          const type = await input.getAttribute("type");
          const isVisible = await input.isVisible();

          if (isVisible && type !== "hidden") {
            visibleInputs.push(input);
          }
        }

        if (visibleInputs.length >= 3) {
          await visibleInputs[2].fill(poNumber);
          logger(`✅ Filled PO for ${odsCode}`);
        } else {
          logger(`⚠️ Not enough visible inputs for ${odsCode}`);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      logger(`⏱️ Script completed in ${duration}s`);

      // ✅ optional save (keep commented like original)
      // await page.click('[value="Save"]');

    }
  });
}

// ✅ keep for your runner
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});