import { chromium } from "playwright";
import dotenv from "dotenv";
import { login, editProvider, setupContext } from "./helpers.mjs";
dotenv.config();

(async () => {
  const { browser, context, page } = await setupContext();

  const childCode = "PSMR01COV";
  const parentCode = childCode.slice(0, -3);
  const orgName = "Test Provider";
  const orgAddress = "12 High street\nRyde\nIsle of Wight\nPO33 2SA";
  const SNType = "Install";
  const orgSector = "Community Pharmacy";
  const regionAllocation = "COVIDK";
  let cdbNumber = 999;

  // Login as parent to get CDB number
  await login(page, process.env.username, process.env.password, parentCode);
  await editProvider(page, parentCode);
  cdbNumber = await page.inputValue("#inCDBNumber");
  await page.click('[value="Exit"]');

  // Login to region
  await login(
    page,
    process.env.username,
    process.env.password,
    regionAllocation
  );
  await page.goto("/o4h/admin/providers?create&new&commissioner=157");

  // Fill provider form
  await page.fill("#inOrganisationName", orgName);
  await page.fill("#inOrganisationIdentifier", orgName);
  await page.fill("#inAddress", orgAddress);
  await page.fill("#inCDBNumber", cdbNumber);
  await page.selectOption("#inTerritory", { index: 1 });
  await page.fill("#inNHSCode", childCode);
  await page.selectOption("#inOrganisationSectorID", { label: orgSector });
  await page.fill('[name="inStartDate"]', "");

  await page.click('[value="Save"]');

  // Add ServiceNow details
  await page.click('[href*="/o4h/admin/providers?id="]');
  await page.check('[type="radio"]#inCSMRequired_yes');
  await page.selectOption("#inCSMAccountType", { label: SNType });
  await page.click("#ExtractServiceNowAddress");

  await page.waitForSelector("#inServiceNowStreet", { timeout: 10000 });
  const snStreet = await page.inputValue("#inServiceNowStreet");
  if (!snStreet) throw new Error("ServiceNow address not populated");

  await page.click('[value="Save"]');

  // Add to commissioner
  await page.click('[href*="/o4h/admin/providers?id="]');
  await page
    .locator('strong:has-text("Commissioners")')
    .locator("xpath=following-sibling::a")
    .click();
  await page.fill("#inOrganisationID_typedown", "329661");
  await page.waitForSelector("#ui-id-1", { timeout: 5000 });
  await page.click("#ui-id-1 li:first-child");
  await page.click("#submit");

  // await page.click('[value="Exit"]');
  await browser.close();
})();
