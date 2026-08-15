import { runScript } from "../../common/runScript.mjs";
import { login, editProvider } from "../../PharmOutcomes/helpers.mjs";
import { logAction } from "../../common/common.mjs";
import { plan } from './planner.js';
import { executePlan } from "./engine.js";
import fs from "node:fs";
import path from "node:path";

export default async function run() {
  await runScript({
    async main({ page, logger, username, password, config }) {


      logger("🚀 Starting script...");

      // will be switched to input or even AI
      const request = process.env.QUESTION || "{}";
      process.env.DRY_RUN = false; // Set DRY_RUN to false to enable actual execution

      const runDir = config.runDir;
      if (runDir && !fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
      }

      await logAction("Login", () =>
        login(page, username, password, "PRIM"),
        logger
      );


      const executionPlan = await plan(request);
      logger("Generated execution plan:");
      logger(JSON.stringify(executionPlan, null, 2));

      await executePlan(executionPlan, page);

      await page.click('[value="Exit"]');

      logger("🏁 Script finished");
    }
  });
}

// ✅ required for your runner
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});
