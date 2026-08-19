import { authenticator } from "otplib";
import { decryptEnv, createBrowserContext, normaliseKey, parseCSV } from "../common/common.mjs";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupContext(options = {}) {
  return await createBrowserContext(options);
}

export function compareImages(
  baselinePath,
  actualPath,
  diffPath
) {
  const baseline =
    PNG.sync.read(
      fs.readFileSync(baselinePath)
    );

  const actual =
    PNG.sync.read(
      fs.readFileSync(actualPath)
    );

  if (
    baseline.width !== actual.width ||
    baseline.height !== actual.height
  ) {
    throw new Error(
      "Images are different sizes"
    );
  }

  const diff = new PNG({
    width: baseline.width,
    height: baseline.height
  });

  const mismatchPixels =
    pixelmatch(
      baseline.data,
      actual.data,
      diff.data,
      baseline.width,
      baseline.height,
      {
        threshold: 0.1
      }
    );

  fs.writeFileSync(
    diffPath,
    PNG.sync.write(diff)
  );

  const totalPixels =
    baseline.width * baseline.height;

  const mismatchPercent =
    (
      mismatchPixels /
      totalPixels
    ) * 100;

  return {
    mismatchPixels,
    mismatchPercent
  };
}

export async function login(page, username, password, logger = console.log) {

  await page.goto("/pharmoutcomes/", {
    waitUntil: "networkidle"
  });

  const secret = process.env.SECRET_KEY;
  if (!secret) {
    throw new Error("SECRET_KEY missing from environment");
  }

  const token = authenticator.generate(secret);
  await page.fill("#login_name", username);
  await page.fill("#login_pwd", password);

  await Promise.all([
    page.waitForSelector("#formCode", { timeout: 10000 }),
    page.click("[type='submit'][value='Go']")
  ]);

  // MFA
  await page.fill("#formCode", token);
  await page.click("#submitMFA");

}

export async function findUser(
  page,
  searchText,
  logger = console.log
) {

  logger(`👤 Searching for user: ${searchText}`);

  await page.goto("/pharmoutcomes/admin/users");

  await page.fill("#inFilter", searchText);

  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.click('[name="inFilter_Submit"]')
  ]);

  const rows = page.locator(
    'a[href*="/admin/users?edit="]'
  );

  const count = await rows.count();

  const results = [];

  for (let i = 0; i < count; i++) {

    const editLink = rows.nth(i);

    const tr = editLink.locator("xpath=ancestor::tr");

    const rowHtml =
      await tr.innerHTML();

    const primary =
      rowHtml.includes("PRIMARY");

    const userText =
      await tr.locator("td:nth-child(2)")
        .innerText();

    const uid =
      (
        await tr.locator("td:nth-child(3)")
          .innerText()
      ).trim();

    const editUrl =
      await editLink.getAttribute(
        "href"
      );

    const disabled =
      (await tr.innerHTML())
        .includes("<strike>");

    const parts =
      userText
        .split("\n")
        .map(x => x.trim());

    const displayName =
      parts[0] || "";

    const username =
      parts[1]
        ?.replace("(", "")
        ?.replace(")", "")
      || "";

    let score = 0;

    const search = searchText.toLowerCase();

    if (
      displayName.toLowerCase() === search
    ) {
      score += 100;
    }

    if (
      username.toLowerCase() === search
    ) {
      score += 100;
    }

    if (
      primary
    ) {
      score += 200;
    }

    if (
      disabled
    ) {
      score -= 1000;
    }

    if (
      username.toLowerCase().includes(
        "automation"
      )
    ) {
      score -= 100;
    }

    if (
      /\d+$/.test(username)
    ) {
      score -= 20;
    }

    results.push({
      uid,
      displayName,
      username,
      disabled,
      editUrl,
      score
    });
  }
  results.sort(
    (a, b) => b.score - a.score
  );

  logger(
    `✅ Found ${results.length} users`
  );

  return results;

}

export async function openUser(
  page,
  user,
  logger = console.log
) {

  logger(
    `👤 Opening user ${user.displayName}`
  );

  await page.goto(user.editUrl);

  await page.waitForLoadState(
    "networkidle"
  );

  logger(
    `✅ User opened`
  );
}


export async function securityWord(page, passcode = process.env.SECURITY_WORD) {
  console.log("passcode", passcode);
  const positionMap = {
    first: 0,
    second: 1,
    third: 2,
    fourth: 3,
    fifth: 4,
    sixth: 5,
  };

  await page.waitForSelector("div.required input", {
    state: "visible",
    timeout: 10000
  });

  const divs = await page.$$("div.required");
  console.log(`🔑 Found ${divs.length} security word input fields`);
  for (const div of divs) {
    console.log("🔑 Processing security word input field...");
    const labelHandle = await div.$("label");
    if (!labelHandle) continue;

    const label = await labelHandle.textContent();
    console.log(`🔑 Label text: ${label}`);
    const match = label.trim().match(/(First|Second|Third|Fourth|Fifth|Sixth)/i);

    if (match) {
      console.log(`🔑 Entering ${match[1]} character of security word`);
      const position = positionMap[match[1].toLowerCase()];
      const letter = passcode[position];
      const input = await div.$("input");
      if (input) await input.type(letter);
    }
  }

  await page.click('[type="submit"][value="Submit"]');
}

export async function addAudit(page, caseRef) {
  const button = page.locator('span.usereditbutton:has-text("+ Add new journal")');

  console.log("📝 Opening journal editor...");
  await button.click();

  // Small delay to allow JS to attach handler
  await page.waitForTimeout(300);

  console.log("✏️ Typing via keyboard...");

  await page.keyboard.type(`Case : ${caseRef}`);
  await page.keyboard.press("Enter");

  console.log("✅ Journal entry submitted");
}

export async function accredit(page, serviceIDs = []) {

  for (const serviceID of serviceIDs) {

    let handled = false;

    for (let attempt = 1; attempt <= 5; attempt++) {

      try {

        // Allow the page to settle after previous accreditation
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(2000);

        const row = page.locator(
          `tr:has(td:first-child:text-is("${serviceID}"))`
        );

        await row.waitFor({
          state: "visible",
          timeout: 10000
        });

        const actionLink = row.locator("a").filter({
          hasText: /accredit|remove/i
        });

        const actionText = (
          await actionLink.first().textContent()
        )
          ?.trim()
          .toLowerCase();

        if (actionText === "remove") {
          console.log(
            `ℹ️ Service ${serviceID} already accredited`
          );
          handled = true;
          break;
        }

        if (actionText !== "accredit") {
          console.log(
            `⚠️ Service ${serviceID} has unexpected action: ${actionText}`
          );
          handled = true;
          break;
        }

        console.log(`✅ Accrediting service ${serviceID}`);

        await Promise.all([
          page.waitForLoadState("networkidle"),
          actionLink.first().click()
        ]);

        // Give the server time to rebuild the table
        await page.waitForTimeout(3000);

        handled = true;
        break;

      } catch (err) {

        console.log(
          `🔄 Retry ${attempt}/5 for ${serviceID}: ${err.message}`
        );

        await page.waitForTimeout(3000);
      }
    }

    if (!handled) {
      console.log(
        `❌ Service ${serviceID} could not be processed after 5 attempts`
      );
    }
  }
}

export async function deaccredit(page, PIDService) {
  await page.waitForSelector('a[href*="deaccredit="]', { timeout: 10000 });

  while (true) {
    const links = page.locator('a[href*="deaccredit="]');
    const count = await links.count();

    console.log(`🔍 Found ${count} removable services`);

    if (count === 0) {
      console.log("✅ No more services to remove");
      break;
    }

    let removedSomething = false;

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const href = await link.getAttribute("href");

      console.log(`➡️ Checking: ${href}`);

      if (!href) continue;

      if (href.includes(`deaccredit=${PIDService}`)) {
        console.log(`⏭️ Skipping PID service: ${PIDService}`);
        continue;
      }

      console.log(`🗑️ Removing service`);

      await link.click();

      // ✅ Wait for page update
      await page.waitForLoadState("networkidle");

      // ✅ Wait for DOM to stabilise again
      await page.waitForSelector('a[href*="deaccredit="]');

      removedSomething = true;

      // ✅ KEY: break and restart from fresh DOM
      break;
    }

    if (!removedSomething) {
      console.log("✅ Only PID service remains, done.");
      break;
    }
  }
}

export async function openOrganisation(page, odsCode, helpers, logger = console.log) {
  const type = getOrganisationType(odsCode);

  logger(`🏷️ Detected type: ${type}`);

  switch (type) {
    case "provider":
      await helpers.editProvider(page, odsCode);
      break;

    case "viewer":
      await helpers.editViewer(page, odsCode);
      break;

    case "commissioner":
      await helpers.editCommissioner?.(page, odsCode)
        || helpers.loginCommissioner?.(page, odsCode);
      break;

    default:
      throw new Error(`Unknown ODS type: ${odsCode}`);
  }

  return type;
}

export function getOrganisationType(odsCode, logger = console.log) {
  if (!odsCode) return "unknown";

  const code = odsCode.trim().toUpperCase();

  // ✅ Provider (Pharmacy: Fxxxx)
  if (/^F[A-Z0-9]{4}$/.test(code)) {
    return "provider";
  }

  // ✅ Provider (GP + child codes)
  if (/^[A-Z]\d{4,5}(\d{3})?$/.test(code)) {
    return "provider";
  }

  // ✅ Commissioner (3 chars)
  if (/^[A-Z0-9]{3}$/.test(code)) {
    return "commissioner";
  }

  // ✅ Viewer (fallback for 4–5 char orgs)
  if (/^[A-Z0-9]{4,5}$/.test(code)) {
    return "viewer";
  }

  logger?.(`⚠️ UNKNOWN ODS TYPE → ${code}`);

  return "unknown";
}

export async function findProvider(page, odsCode, logger = console.log) {
  console.log("Received:", odsCode);

  logger(`🏥 Opening provider ${odsCode}`);

  // Navigate to the Manage Providers page
  await page.goto("/pharmoutcomes/admin/providers");

  // Search for provider
  if (odsCode.length < 4) { odsCode = odsCode.padStart(4, " ") } // pad to 4 digits if needed
  await page.fill("#providerlookup", odsCode);

  // Wait for the autocomplete dropdown to appear
  await page.waitForSelector("#ui-id-1", { timeout: 5000 });

  // Click the first result
  const firstResult = page.locator("#ui-id-1 li").first();

  //need some logic here to check for No matches, then throw an error for the calling script to log and carry on
  if (
    firstResult.innerText() ==
    "** No matches. Try typing other search terms ..."
  ) {
    throw new Error("Condition matched: 'No Provider' found in first result");
  } else {
    await firstResult.click();
  }

}

export async function editProvider(page, odsCode, logger = console.log) {

  await findProvider(page, odsCode);
  await page.click("#editProvider");
}

export async function loginAsProvider(page, odsCode, logger = console.log) {

  await findProvider(page, odsCode);

  logger("🔐 Opening provider login");

  const loginLink =
    page.locator(
      '#crossloginusers a.full-lock'
    ).first();

  await loginLink.click();

  logger("🔑 Entering security code");

  await securityWord(page);

}

export async function editViewer(page, odsCode, log = console.log) {
  log("👤 Opening viewer");

  // Navigate to the Manage Providers page
  await page.goto("/pharmoutcomes/admin/viewers");

  // Search for provider
  await page.fill("#organisationLookup", odsCode);

  // Wait for the autocomplete dropdown to appear
  await page.waitForSelector("#ui-id-1", { timeout: 5000 });

  // Click the first result
  await page.locator("#ui-id-1 li").first().click();

  // Click the edit button
  await page.click("#organisationEdit");
}

export async function editCommissioner(page, odsCode, log = console.log) {
  log("👤 Opening commissioner");

  // Navigate to the Manage Providers page
  await page.goto("/pharmoutcomes/admin/commissioners");

  // Search for provider
  await page.fill("#organisationLookup", odsCode);

  // Wait for the autocomplete dropdown to appear
  await page.waitForSelector("#ui-id-1", { timeout: 5000 });

  // Click the first result
  await page.locator("#ui-id-1 li").first().click();

  // Click the edit button
  await page.click("#organisationEdit");
}

export async function loginCommissioner(page, odsCode) {
  // Navigate to the Manage Providers page
  await page.goto("/pharmoutcomes/admin/commissioners");

  // Search for provider
  await page.fill("#organisationLookup", odsCode);

  // Wait for the autocomplete dropdown to appear
  await page.waitForSelector("#ui-id-1", { timeout: 5000 });

  // Click the first result
  await page.locator("#ui-id-1 li").first().click();

  // Click the edit button
  await page.locator("#crossloginusers_small a.full-lock").first().click();

  await securityWord(page);
}

export async function addCommissioner(page, commissionerID, services, log = console.log) {
  log("👤 Adding commissioner");

  const link = page
    .locator('p:has(strong:has-text("Commissioners"))')
    .locator('a[href*="commissioner="]');

  // ✅ retry-safe click (handles DOM redraws)
  for (let i = 0; i < 3; i++) {
    try {
      await link.waitFor({ state: "visible", timeout: 5000 });

      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle" }),
        link.click()
      ]);

      break;
    } catch (err) {
      log("🔄 Retry clicking commissioner add link...");
      await page.waitForTimeout(300);
    }
  }

  // ✅ wait for typedown to be ready
  await page.waitForSelector("#inOrganisationID_typedown", { timeout: 5000 });

  // ✅ type value
  await page.fill("#inOrganisationID_typedown", commissionerID);

  // ✅ wait for dropdown results
  await page.waitForSelector("#ui-id-1 li", { timeout: 5000 });

  // ✅ click first result safely
  await page.locator("#ui-id-1 li").first().click();

  // ✅ submit form (wait for navigation)
  await Promise.all([
    page.waitForLoadState("domcontentloaded"),
    page.locator("#submit").click()
  ]);

  log("✅ Commissioner added");
}

