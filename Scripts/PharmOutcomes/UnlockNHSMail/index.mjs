import { runScript } from "../../common/runScript.mjs";
import { login, checkAndUnlock } from "../../pharmoutcomes/helpers.mjs";
import fs from "node:fs";

export default async function run() {
  await runScript({
    async main({ page, logger, username, password, config }) {

      logger("🚀 Starting script...");
      const runDir = config.runDir;
      if (runDir && !fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
      }

      try {
        await login(page, username, password, logger);
        while (true) {
          try {
            const unlocked = await checkAndUnlock(page);

            if (unlocked) {
              console.log(
                `${new Date().toISOString()} 🚨 Unlock action performed`
              );
            }
          } catch (err) {
            console.error(
              `${new Date().toISOString()} ❌ Check failed`,
              err.message
            );
          } 

          await page.waitForTimeout(5 * 60 * 1000);
        }
      } finally {
        await page.browser().close();
      }


    }
  });
}
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});

