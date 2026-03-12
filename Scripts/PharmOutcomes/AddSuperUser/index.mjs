// login-provider.js
import { chromium } from "playwright";
import dotenv from "dotenv";
import { login, editProvider, setupContext } from "./helpers.mjs";
dotenv.config();

// Get ODSCode from command line arguments
const ODSCode = process.argv[2]; // e.g., node login-provider.js A12345

if (!ODSCode) {
  console.error("❌ Please provide an ODSCode as a command line argument.");
  process.exit(1);
}

(async () => {
  const { browser, context, page } = await setupContext();

  await login(page, process.env.username, process.env.password, ODSCode);
  await editProvider(page, ODSCode);

  try {
    await page.waitForSelector('a.full-lock[href^="/o4h/admin/loginas?id="]', {
      timeout: 2000,
    });
    // Optionally interact with the element if it appears
    await page.click('a.full-lock[href^="/o4h/admin/loginas?id="]');
  } catch (error) {
    console.log("Login-as link did not appear within 2 seconds, continuing...");
  }

  // Now get the locator (do NOT await this)
  const superUserLink = page.locator(
    'a.full-lock[href^="/o4h/admin/loginas?id="]'
  );

  // Use the locator
  if ((await superUserLink.count()) > 0) {
    console.log("✅ SuperUser is present");
    await browser.close();
  } else {
    console.log("❌ No SuperUser found");

    //adding new user
    await page.locator('a.full-lock[href^="/o4h/admin/users?new"]').click();

    // Fill out the form
    await page.selectOption("#inUserType", "S");
    await page.fill("#inUserName", `Pinnacle.Support@${ODSCode}`);
    await page.fill("#inKnownName", "Pinnacle Support");

    //Hit save
    await page.click('input[type="submit"][name="update"]');

    // Cross login
    await page.check("#inCrossLogin");
    // Do the permissions
    await page.click('input[type="button"][value="Tick all"]');
    // enter security word
    await page.fill("#inNewPasscode", process.env.SECURITY_WORD);
    // save
    await page.click('input[type="submit"][name="update"]');
  }

  // Keep browser open
  await new Promise(() => {});
})();
