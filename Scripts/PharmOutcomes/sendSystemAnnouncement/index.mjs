import { runScript } from "../../common/runScript.mjs";
import { formatDateToUKDisplay } from "../../common/dateUtils.mjs";
import { login } from "../helpers.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function run() {
  await runScript({
    async main({ page, logger, username, password }) {

      // ✅ env inputs
      const from = process.env.FROM;
      const to = process.env.TO;
      const until = process.env.UNTIL;
      const title = process.env.TITLE;
      const bodyRaw = process.env.BODY;

      if (!from) throw new Error("Missing FROM");
      if (!until) throw new Error("Missing UNTIL");
      if (!title) throw new Error("Missing TITLE");
      if (!bodyRaw) throw new Error("Missing BODY");

      try {

        await login(page, username, password);
        await page.goto("/home/announcement?id=0", { waitUntil: "networkidle" });
        await page.locator('input[name="inFromDate"]').fill(formatDateToUKDisplay(from));
        await page.locator('input[name="inToDate"]').fill(formatDateToUKDisplay(until));
        if (to) { await page.locator('input[name="inOrganisationTypes"]').fill(to); }
        await page.locator('input[name="inTitle"], input[name="title"]').fill(title);
        await page.locator('textarea[name="inMessage"]').fill(bodyRaw);
        await page.locator('input[type="submit"][value="Save"]').click();

      } catch (err) {
        logger(`❌ Failed : ${err?.message}`);
        continue;
      }

      await page.click('[value="Exit"]');

      logger("✅ Script complete");
    }
  });
}

// ✅ runner requirement
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});
