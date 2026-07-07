import { runScript } from "../../common/runScript.mjs";
import { formatDateToUKDisplay } from "../../common/dateUtils.mjs";
import { customToBBCode } from "../../common/bbcode.mjs"

import {
  login
} from "../helpers.mjs";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function run() {
  await runScript({
    async main({ page, logger, username, password }) {

      logger("RUN STARTED");

      // ✅ env inputs
      const from = process.env.FROM;
      const to = process.env.TO;
      const until = process.env.UNTIL;
      const title = process.env.TITLE;
      const bodyRaw = process.env.BODY;
      const bodyBBCode = customToBBCode(bodyRaw);

      const primary = ["1", "true", "on", "yes"]
        .includes((process.env.PRIMARY || "").toLowerCase());

      if (!from) throw new Error("Missing FROM");
      if (!until) throw new Error("Missing UNTIL");
      if (!title) throw new Error("Missing TITLE");
      if (!bodyRaw) throw new Error("Missing BODY");

      // ✅ regions
      const regionsPath = path.resolve(__dirname, "../input/regions.json");

      if (!fs.existsSync(regionsPath)) {
        throw new Error("regions.json missing");
      }

      const regions = JSON.parse(fs.readFileSync(regionsPath, "utf-8"));

      if (!Array.isArray(regions)) {
        throw new Error("regions.json must be an array");
      }

      // ✅ loop regions (REUSE same page)
      for (let i = 0; i < regions.length; i++) {

        const { name, odscode } = regions[i];

        logger(`🔄 Processing region ${i + 1}/${regions.length}: ${name} (${odscode})`);

        try {
          // ✅ login
          await login(page, username, password, odscode);

          // ✅ navigate
          await page.goto(
            "https://outcomes4health.org/o4h/home/announcement?id=0",
            { waitUntil: "networkidle" }
          );

          await page.locator('input[name="inFromDate"]').fill(formatDateToUKDisplay(from));
          await page.locator('input[name="inToDate"]').fill(formatDateToUKDisplay(until));

          if (to) {
            await page.locator('input[name="inOrganisationTypes"]').fill(to);
          }

          await page.locator('input[name="inTitle"], input[name="title"]').fill(title);
          await page.locator('textarea[name="inMessage"]').fill(bodyBBCode);

          //await page.pause();

          await page.locator('input[type="submit"][value="Save"]').click();
          logger(`✅ Message saved for ${name}`);

        } catch (err) {
          logger(`❌ Failed for region ${name}: ${err?.message}`);
          continue;
        }

        // ✅ stop early if PRIMARY mode
        if (primary) {
          logger("PRIMARY flag set — stopping after first region");
          break;
        }
      }

      // ✅ exit
      try {
        if (await page.locator('[value="Exit"]').count()) {
          await page.click('[value="Exit"]');
        } else if (await page.locator('a:has-text("Exit")').count()) {
          await page.click('a:has-text("Exit")');
        }
      } catch (err) {
        logger(`⚠️ Exit failed (${name}): ${err?.message}`);
      }

      logger("✅ Script complete");
    }
  });
}

// ✅ runner requirement
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});
