import { runScript } from "../../common/runScript.mjs";
import { login, loginAsProvider, compareImages } from "../../pharmoutcomes/helpers.mjs";
import { logAction } from "../../common/common.mjs";
import fs from "node:fs";
import { createTestLogger } from "../../common/testLogger.mjs";

export default async function run() {
  await runScript({
    async main({ page, logger, username, password, config }) {

      logger("🚀 Starting script...");


      const runDir = config.runDir;
      if (runDir && !fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
      }

      const test = createTestLogger(logger);

      test.step("Loggin into PharmOutcomes");
      await logAction("Login", () =>
        helpers.login(page, username, password),
        logger
      );

      test.step("Opening Pharmacy First provision");
      await logAction("Login as provider", () =>
        helpers.loginAsProvider(page, process.env.ODSCODE),
        logger
      );

      test.step("Opening Pharmacy First Supply Token");

      await page.goto(
        // "/pharmoutcomes/services/enter/?edit=671414467&xid=164488&xact=provisionedit",
        "/pharmoutcomes/services/enter/?edit=737350211&xid=164506&xact=provisionedit",
        {
          waitUntil: "networkidle"
        }
      );

      const downloadPromise = page.waitForEvent("download");

      await page.getByRole("link", {
        name: /Pharmacy First Supply Token/i
      }).click();

      const download = await downloadPromise;
      const pdfPath = `${runDir}/PharmacyFirstSupplyToken.pdf`
      await download.saveAs(pdfPath);

      await page.screenshot({
        path: `${runDir}/provision.png`,
        fullPage: true
      });

      test.pass("Provision Loaded");

      const context = page.context();
      const pdfPage = await context.newPage();
      await pdfPage.goto(`file:///${pdfPath.replace(/\\/g, "/")}`);
      await pdfPage.waitForLoadState("networkidle");
      await pdfPage.waitForTimeout(2000);

      const previewPath = `${runDir}/PharmacyFirstSupplyToken.png`
      await pdfPage.screenshot({
        path: previewPath,
        fullPage: true
      });

      const result =
        compareImages(
          "../input/PharmacyFirstSupplyToken.png",
          previewPath,
          `${runDir}/diff.png`
        );

      console.log(
        `Difference: ${result.mismatchPercent.toFixed(2)}%`
      );

      if (result.mismatchPercent > 10) {
        test.fail(`Visual regression detected (${result.mismatchPercent.toFixed(2)}%)`);
      } else {
        test.pass("Token Looks Fine")
      }
      logger("🏁 Script finished");
    }
  });
}

run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});
