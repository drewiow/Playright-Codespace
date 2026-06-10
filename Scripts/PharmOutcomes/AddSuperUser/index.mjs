import { runScript } from "../common/runScript.mjs";

import {
  login,
  editProvider
} from "./helpers.mjs";

export default async function run() {
  const ODSCode = process.argv[2];

  if (!ODSCode) {
    console.error("❌ Please provide an ODSCode as a command line argument.");
    process.exit(1);
  }

  await runScript({
    async main({ page, logger, username, password }) {

      logger(`🔄 Processing single ODS: ${ODSCode}`);

      try {
        await login(page, username, password, ODSCode);
        await editProvider(page, ODSCode);

        // Try to find existing super user
        const superUserLink = page.locator(
          'a.full-lock[href^="/o4h/admin/loginas?id="]'
        );

        if ((await superUserLink.count()) > 0) {
          logger("✅ SuperUser already present");
          return;
        }

        logger("❌ No SuperUser found — creating one");

        // Add new user
        await page.locator('a.full-lock[href^="/o4h/admin/users?new"]').click();

        await page.selectOption("#inUserType", "S");
        await page.fill("#inUserName", `Pinnacle.Support@${ODSCode}`);
        await page.fill("#inKnownName", "Pinnacle Support");

        await page.click('input[type="submit"][name="update"]');

        // Permissions
        await page.check("#inCrossLogin");
        await page.click('input[type="button"][value="Tick all"]');

        await page.fill("#inNewPasscode", process.env.SECURITY_WORD);
        await page.click('input[type="submit"][name="update"]');

        logger("✅ SuperUser created");

        // ✅ keep browser open (same behaviour as original)
        logger("🕒 Browser left open intentionally");
        await new Promise(() => { });

      } catch (err) {
        logger(`❌ Failed for ${ODSCode}: ${err?.message}`);
      }
    }
  });
}