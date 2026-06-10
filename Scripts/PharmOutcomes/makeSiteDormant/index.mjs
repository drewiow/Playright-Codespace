import { runScript } from "../../common/runScript.mjs";

import {
  login,
  editProvider,
  deaccredit,
  addAudit
} from "../helpers.mjs";

import fs from "node:fs";
import path from "node:path";

export default async function run() {
  await runScript({
    async main({ page, rows, logger, username, password, config }) {

      // ✅ timestamped logger wrapper (kept)
      const log = (msg, ...rest) =>
        logger(`${new Date().toISOString()} ${msg}`, ...rest);

      const odsColumn = process.env.ODS_COLUMN || "ODSCode";
      const DRY_RUN = config.dryRun;

      log(`⚙️ ODS Column: ${odsColumn}`);
      log(`⚙️ Dry Run: ${DRY_RUN}`);
      log(`⚙️ Headless: ${config.headless}`);
      log(`⚙️ Human Mode: ${config.human}`);

      const resultsPath = path.join(config.runDir, "Closed.csv");
      fs.writeFileSync(resultsPath, "ODSCode,CaseRef,PIDService,Timestamp\n");

      const startTime = Date.now();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowStart = Date.now();

        log(`──────────── ROW ${i + 1}/${rows.length} ────────────`);

        const odsCode = row[odsColumn];
        const caseref = row.caseref || row.CaseRef;
        const PIDService = row.PIDService || row.pidservice;

        if (!odsCode) {
          log(`⚠️ Missing ODS (${odsColumn}) → skipping row`);
          continue;
        }

        log(`🔄 Processing ODS: ${odsCode}`);
        log(`📌 CaseRef: ${caseref}, PIDService: ${PIDService}`);

        try {
          // ✅ LOGIN
          log("🔐 Logging in...");
          await login(page, username, password, odsCode);
          log("✅ Login successful");

          // ✅ EDIT PROVIDER
          log("👤 Opening provider...");
          await editProvider(page, odsCode);
          log("✅ Provider opened");

          // ✅ DEACCREDIT
          try {
            log(`🔧 Deaccrediting PIDService: ${PIDService}`);
            await deaccredit(page, PIDService);
            log("✅ Deaccredit complete");
          } catch (err) {
            log(`❌ Deaccredit failed: ${err?.message}`);
          }

          // ✅ ACCOUNT REF CHECK
          try {
            log("🔎 Checking Account Reference...");

            const input = page.locator("#inAccountRef");
            const currentValue = await input.inputValue();

            log(`📋 Current Account Ref: ${currentValue}`);

            if (!currentValue.includes("EX-COVID")) {
              await input.fill("EX-COVID");
              log("✅ Updated Account Ref → EX-COVID");
            } else {
              log("ℹ️ Already contains EX-COVID, skipping");
            }
          } catch (err) {
            log(`⚠️ Failed to update Account Ref: ${err?.message}`);
          }

          // ✅ AUDIT
          try {
            log(`📝 Adding audit entry: ${caseref}`);
            await addAudit(page, caseref);
            log("✅ Audit entry added");
          } catch (err) {
            log(`❌ Audit failed: ${err?.message}`);
          }

          await page.waitForTimeout(1000);

          // ✅ SAVE
          if (!DRY_RUN) {
            log("💾 Saving provider...");
            await page.click('[value="Save"]');
            log("✅ Save successful");
          } else {
            log("[DRY RUN] Skipping save");
          }

          // ✅ WRITE CSV
          fs.appendFileSync(
            resultsPath,
            `"${odsCode}","${caseref}","${PIDService}","${new Date().toISOString()}"\n`
          );

          log(`📄 Result written for ${odsCode}`);

          // ✅ EXIT
          try {
            log("↩️ Exiting provider...");
            await page.click('[value="Exit"]');
            log("✅ Exit successful");
          } catch (err) {
            log(`⚠️ Exit failed (continuing): ${err?.message}`);
          }

          const rowDuration = ((Date.now() - rowStart) / 1000).toFixed(2);
          log(`✅ Row completed in ${rowDuration}s`);

        } catch (err) {
          log(`❌ Failed for ${odsCode}: ${err?.message}`);
          continue;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      log(`⏱️ Script completed in ${duration}s`);

      // ✅ video
      if (config.recordVideo && page.saveVideo) {
        log("🎥 Saving video...");
        await page.saveVideo(`run-${Date.now()}`);
      }

      // ✅ trace
      if (config.recordTrace) {
        const tracePath = path.join(config.runDir, "trace.zip");
        log("📦 Saving trace...");
        await page.context().tracing.stop({ path: tracePath });
      }

      // ✅ human mode
      if (config.human) {
        log("🕒 Keeping browser open (human mode)");
        await new Promise(() => { });
      }
    }
  });
}

// ✅ required for your runner
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});