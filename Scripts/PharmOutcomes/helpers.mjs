import { authenticator } from "otplib";
import { decryptEnv, createBrowserContext, normaliseKey, parseCSV } from "../common/common.mjs";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { LoggerEvent } from "../common/loggerEvents.js";

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

export async function login(page, username, password, logger) {


  await page.goto("/pharmoutcomes/", {
    waitUntil: "networkidle"
  });

  const secret = process.env.SECRET_KEY;
  if (!secret) {
    throw new Error("SECRET_KEY missing from environment");
  }

  console.log("URL:", page.url());
  console.log("Title:", await page.title());

  await page.screenshot({
    path: "before-login.png",
    fullPage: true
  });

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

export async function findUser(page, searchText, logger = console.log) {

  logger(`👤 Searching for user: ${searchText}`);
  await page.goto("/pharmoutcomes/admin/users");
  await page.fill("#inFilter", searchText);

  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.click('[name="inFilter_Submit"]')
  ]);

  const rows = page.locator('a[href*="/admin/users?edit="]');
  const count = await rows.count();
  const results = [];

  for (let i = 0; i < count; i++) {

    const editLink = rows.nth(i);
    const tr = editLink.locator("xpath=ancestor::tr");
    const rowHtml = await tr.innerHTML();
    const primary = rowHtml.includes("PRIMARY");
    const userText = await tr.locator("td:nth-child(2)").innerText();
    const uid = (await tr.locator("td:nth-child(3)").innerText()).trim();
    const editUrl = await editLink.getAttribute("href");
    const disabled = (await tr.innerHTML()).includes("<strike>");
    const parts = userText.split("\n").map(x => x.trim());
    const displayName = parts[0] || "";
    const username = parts[1]?.replace("(", "")?.replace(")", "") || "";
    const search = searchText.toLowerCase();

    let score = 0;

    if (displayName.toLowerCase() === search) { score += 100; }
    if (username.toLowerCase() === search) { score += 100; }
    if (primary) { score += 200; }
    if (disabled) { score -= 1000; }
    if (username.toLowerCase().includes("automation")) { score -= 100; }
    if (/\d+$/.test(username)) { score -= 20; }

    results.push({
      uid,
      displayName,
      username,
      disabled,
      editUrl,
      score
    });
  }

  results.sort((a, b) => b.score - a.score);

  logger(`✅ Found ${results.length} users`);

  return results;

}

export async function openService(page, service, logger) {

  await loginCommissioner(page, service.commissionerName, logger);

  await page.goto(service.editServiceLink);

  await page.waitForLoadState("networkidle");

  const questionHeaders = await page.$$eval(
    "#inAuditOne option",
    options =>
      options
        .map(o => o.textContent?.trim())
        .filter(t => t?.startsWith("Q"))

  );

  return { questionHeaders };
}

export async function checkAndUnlock(page) {
  await page.goto("/pharmoutcomes/admin/web?nhsnetlock", { waitUntil: "networkidle" });
  const unlockButton = page.locator('input[name="submit"][value="Unlock"]');
  const disabled = await unlockButton.isDisabled();

  if (disabled) {
    console.log(`${new Date().toISOString()} ✅ Account not locked`);
    return false;
  }

  console.log(`${new Date().toISOString()} 🔓 Account locked, unlocking...`);
  await Promise.all([page.waitForLoadState("networkidle"), unlockButton.click()]);
  console.log(`${new Date().toISOString()} ✅ Account unlocked`);

  return true;
}

export async function removeCommissioner(page, commissionerId, logger) {

  const link = page.locator(`a[href*="minister=remove"][href*="commissioner=${commissionerId}"]`);

  try {
    await link.first().waitFor({
      state: "visible",
      timeout: 5000
    });
  } catch {
    logger(
      `ℹ️ Commissioner ${commissionerId} not assigned (or already removed)`
    );
    return false;
  }

  await link.first().click();
  logger(`✅ Removed commissioner ${commissionerId}`);

  return true;
}

export async function getUserDetails(page) {

  const exists = async (selector) => (await page.locator(selector).count()) > 0;

  const value = async (selector) => {

    if (!await exists(selector)) { return ""; }
    return await page.locator(selector).inputValue();
  };

  let organisation = null;

  if (await exists('input[name="inOrganisationID"]')) {

    organisation = {
      id: await value('input[name="inOrganisationID"]'),
      name: null
    };

  } else if (await exists('#inOrganisationID')) {

    organisation = {
      id: await page.locator('#inOrganisationID').inputValue(),
      name: (
        await page
          .locator('#inOrganisationID option:checked')
          .textContent()
      )?.trim() ?? ""
    };
  }

  const userType =
    await exists('#inUserType')
      ? await page.locator('#inUserType').inputValue()
      : "";

  const mfaText = await page.locator('body').textContent();
  const hasMfa = mfaText.includes("MFA Secret is set");
  const hasPasscode = mfaText.includes("Valid security word in use");

  const lastActive =
    mfaText.match(
      /Last Login:\s*(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/
    )?.[1] || "";

  let roles = [];

  if (await exists('#inUPRoles\\[\\]')) {

    roles = await page.locator(
      '#inUPRoles\\[\\] option'
    ).evaluateAll(
      options =>
        options
          .filter(o => o.selected)
          .map(o => o.textContent.trim())
    );
  }

  const auditLink = page.locator('a[onclick*="User Audit History"]');
  await auditLink.waitFor();
  await auditLink.click();

  await page.waitForSelector(".alertify-inner");
  const auditEntries = await page.evaluate(() => {

    const rows = Array.from(
      document.querySelectorAll(
        ".alertify-inner table tbody tr"
      )
    ).slice(1);

    return rows.map(row => {

      const cells = row.querySelectorAll("td");

      return {
        date: cells[0]?.querySelector("a")?.getAttribute("title"),
        user: cells[1]?.innerText.trim(),
        action: cells[2]?.innerText.trim()
      };

    });

  });

  await page.locator("#alertify-ok").click();

  return {
    uid: new URL(page.url()).searchParams.get("edit") || await value('input[name="id"]'),
    username: await value('#inUserName'),
    fullName: await value('#inKnownName'),
    email: await value('#inContactEmail'),
    telephone: await value('#inContactPhone'),
    mobile: await value('#inContactMobile'),
    jobTitle: await value('#inJobTitle'),
    userType,
    organisation,
    lastActive,
    hasMfa,
    hasPasscode,
    roles,
    auditEntries
  };
}

export function assessAccountTrust(auditEntries, trustedAdmins) {

  const isSecurityAction = (action) => {
    const a = action.toLowerCase();

    return (
      a.includes('reset this user\'s password') ||
      a.includes('set this user\'s password') ||
      a.includes('reset by admin this user\'s mfa') ||
      a.includes('set this user\'s security word') ||
      a.includes('reset this user\'s security word')
    );
  };

  const isValidationAction = (action) => {
    const a = action.toLowerCase();

    return (
      a.includes('registered through pharmoutcomes') ||
      a.includes('changed their password')
    );
  };

  // Newest first

  for (const entry of auditEntries) {

    // Strongest signal:
    // user authenticated after a reset
    if (isValidationAction(entry.action)) {
      return {
        result: 'GREEN',
        confidence: 100,
        reason: `${entry.user} successfully authenticated after a reset.`
      };
    }

    // First security event encountered is the most recent one
    if (isSecurityAction(entry.action)) {

      // Trusted admin performed the reset
      if (trustedAdmins.includes(entry.user)) {
        return {
          result: 'GREEN',
          confidence: 80,
          reason: `Most recent security change was performed by trusted admin '${entry.user}'.`
        };
      }

      // Unknown actor performed the reset
      return {
        result: 'RED',
        confidence: 20,
        reason: `Most recent security change was performed by untrusted user '${entry.user}'.`
      };
    }
  }

  return {
    result: 'RED',
    confidence: 0,
    reason: 'No security or validation history found.'
  };
}

export async function getCommissionerDetails(page) {
  const publicContact = await page.locator("#inPublicContact").inputValue();
  return { publicContact };
}

export async function openUser(page, uid, logger) {
  logger(`👤 Opening user ${uid}`);
  await page.goto(`/pharmoutcomes/admin/users?edit=${uid}`);
  return getUserDetails(page);
}

export async function openCommissioner(page, uid, logger) {
  logger(`👤 Opening commissioner ${uid}`);
  await page.goto(`/pharmoutcomes/admin/commissioners?id=${uid}`);
  return getCommissionerDetails(page);
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

  for (const div of divs) {

    const labelHandle = await div.$("label");
    if (!labelHandle) continue;

    const label = await labelHandle.textContent();
    const match = label.trim().match(/(First|Second|Third|Fourth|Fifth|Sixth)/i);

    if (match) {
      const position = positionMap[match[1].toLowerCase()];
      const letter = passcode[position];
      const input = await div.$("input");
      if (input) await input.type(letter);
    }
  }

  await page.click('[type="submit"][value="Submit"]');
}

export async function verifySecurityWord(page, letter1, letter2, logger = console.log) {

  await page.fill("#verify1", letter1);
  await page.fill("#verify2", letter2);
  await page.click("#verifyUserPasscodeButton");
  await page.waitForFunction(() => {
    const result = document.querySelector("#verificationResult");
    return (result?.classList.contains("verificationSuccess") || result?.classList.contains("verificationFailed"));
  });

  const result = await page.locator("#verificationResult").textContent();
  const success = result?.includes("Successful Verification");
  return { success, result };

}

export async function addAudit(page, caseRef) {
  const button = page.locator('span.usereditbutton:has-text("+ Add new journal")');
  await button.click();
  await page.waitForTimeout(300);
  await page.keyboard.type(`Case : ${caseRef}`);
  await page.keyboard.press("Enter");
}

export async function accreditBySysId(page, sysId, serviceIDs = [], posToken, logger) {

  for (const serviceID of serviceIDs) {
    const accreditServiceLink = `/pharmoutcomes/admin/providers?id=${sysId}&accredit=${serviceID}&POSesTok=${posToken}`;
    logger?.event(LoggerEvent.ACCREDIT, { sysId, service: serviceID, accreditServiceLink });
    await page.goto(accreditServiceLink);

  }
}

export async function removeCommissionerBySysId(page, sysId, commissionerId, posToken, logger) {
  const removeCommissionerLink = `/pharmoutcomes/admin/commissioners?provider=${sysId}&minister=remove&commissioner=${commissionerId}&POSesTok=${posToken}`;
  await page.goto(removeCommissionerLink);

}

export async function accredit(page, serviceIDs = [], logger) {

  for (const serviceID of serviceIDs) {

    let handled = false;

    for (let attempt = 1; attempt <= 5; attempt++) {

      try {

        await page.waitForLoadState("networkidle");

        await page
          .locator("legend")
          .filter({
            hasText: "Service Accreditations"
          })
          .waitFor({
            timeout: 10000
          });

        const row = page.locator(`tr:has(td:first-child:text-is("${serviceID}"))`);

        const rowCount = await row.count();

        if (rowCount === 0) {
          console.log(`ℹ️ Service ${serviceID} not available for this provider`);
          handled = true;
          break;
        }

        const actionLink = row.locator("a").filter({ hasText: /accredit|remove/i });

        const actionCount = await actionLink.count();

        if (actionCount === 0) {

          handled = true;
          break;
        }

        const actionText = (await actionLink.first().textContent())
          ?.trim()
          ?.toLowerCase();

        if (actionText === "remove") {

          handled = true;
          break;
        }

        if (actionText === "accredit") {

          await Promise.all([
            page.waitForLoadState("networkidle"),
            actionLink.first().click()
          ]);

          await page.waitForTimeout(3000);

          handled = true;
          break;
        }

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

export async function deaccredit(page, PIDService, logger) {
  await page.waitForSelector('a[href*="deaccredit="]', { timeout: 10000 });

  while (true) {
    const links = page.locator('a[href*="deaccredit="]');
    const count = await links.count();

    if (count === 0) {

      break;
    }

    let removedSomething = false;

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const href = await link.getAttribute("href");

      if (!href) continue;

      if (href.includes(`deaccredit=${PIDService}`)) {
        continue;
      }

      console.log(`🗑️ Removing service`);

      await link.click();
      await page.waitForLoadState("networkidle");
      await page.waitForSelector('a[href*="deaccredit="]')
      removedSomething = true;

      break;
    }

    if (!removedSomething) {
      break;
    }
  }
}

export async function openOrganisation(page, odsCode, helpers, logger) {
  const type = getOrganisationType(odsCode);

  logger(`🏷️ Detected type: ${type}`);
  if (odsCode.length < 4) { odsCode = odsCode.padStart(4, " ") } // pad to 4 digits if needed
  switch (type) {
    case "provider":
      await helpers.editProvider(page, odsCode);
      break;

    case "viewer":
      await helpers.editViewer(page, odsCode);
      break;

    case "commissioner":
      await helpers.editCommissioner?.(page, odsCode) || helpers.loginCommissioner?.(page, odsCode);
      break;

    default:
      throw new Error(`Unknown ODS type: ${odsCode}`);
  }

  return type;
}

export function getOrganisationType(odsCode, logger) {
  if (!odsCode) return "unknown";

  const code = odsCode.trim().toUpperCase();

  if (/^F[A-Z0-9]{4}$/.test(code)) { return "provider"; }
  if (/^[A-Z]\d{4,5}(\d{3})?$/.test(code)) { return "provider"; }
  if (/^[A-Z0-9]{3}$/.test(code)) { return "commissioner"; S }
  if (/^[A-Z0-9]{4,5}$/.test(code)) { return "viewer"; }

  logger?.(`⚠️ UNKNOWN ODS TYPE → ${code}`);

  return "unknown";
}

export async function findProvider(page, odsCode, logger) {

  await page.goto("/pharmoutcomes/admin/providers");
  if (odsCode.length < 4) { odsCode = odsCode.padStart(4, " ") } // pad to 4 digits if needed
  await page.fill("#providerlookup", odsCode);
  await page.waitForSelector("#ui-id-1", { timeout: 5000 });
  const firstResult = page.locator("#ui-id-1 li").first();

  if (
    firstResult.innerText() == "** No matches. Try typing other search terms ..."
  ) {
    throw new Error("Condition matched: 'No Provider' found in first result");
  } else {
    await firstResult.click();
  }

}

export async function editProvider(page, odsCode, logger) {
  logger?.event(LoggerEvent.OPEN_PROVIDER, { odsCode });
  await findProvider(page, odsCode, logger);
  await page.click("#editProvider");
}

export async function loginAsProvider(page, odsCode, logger) {
  await findProvider(page, odsCode);
  const loginLink = page.locator('#crossloginusers a.full-lock').first();
  await loginLink.click();
  await securityWord(page);
}

export async function editViewer(page, odsCode, log) {
  await page.goto("/pharmoutcomes/admin/viewers");
  await page.fill("#organisationLookup", odsCode);
  await page.waitForSelector("#ui-id-1", { timeout: 5000 });
  await page.locator("#ui-id-1 li").first().click();
  await page.click("#organisationEdit");
}

export async function editCommissioner(page, odsCode, log) {
  await page.goto("/pharmoutcomes/admin/commissioners");
  await page.fill("#organisationLookup", odsCode);
  await page.waitForSelector("#ui-id-1", { timeout: 5000 });
  await page.locator("#ui-id-1 li").first().click();
  await page.click("#organisationEdit");
}

export async function loginCommissioner(page, commissionerName) {

  const loggedInAs = await page.locator("form[action='/pharmoutcomes/system/logout']").textContent();
  if (loggedInAs?.toLowerCase().includes(commissionerName.toLowerCase())) {
    return;
  }

  await page.goto("/pharmoutcomes/admin/commissioners");
  await page.fill("#organisationLookup", commissionerName);
  await page.waitForSelector("#ui-id-1", { timeout: 5000 });
  await page.locator("#ui-id-1 li").first().click();
  await page.locator("#crossloginusers_small a.full-lock").first().click();
  await securityWord(page);
}

export async function addCommissioner(page, commissionerID) {

  const link = page.locator('p:has(strong:has-text("Commissioners"))').locator('a[href*="commissioner="]');

  for (let i = 0; i < 3; i++) {
    try {
      await link.waitFor({ state: "visible", timeout: 5000 });

      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle" }),
        link.click()
      ]);

      break;
    } catch (err) {
      await page.waitForTimeout(300);
    }
  }

  await page.waitForSelector("#inOrganisationID_typedown", { timeout: 5000 });
  await page.fill("#inOrganisationID_typedown", commissionerID);
  await page.waitForSelector("#ui-id-1 li", { timeout: 5000 });
  await page.locator("#ui-id-1 li").first().click();
  await Promise.all([
    page.waitForLoadState("domcontentloaded"),
    page.locator("#submit").click()
  ]);


}

