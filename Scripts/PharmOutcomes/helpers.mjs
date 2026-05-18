import { authenticator } from "otplib";
import { decryptEnv, createBrowserContext } from "../common/common.mjs";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupContext(options = {}) {
  return await createBrowserContext(options);
}

export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);

  // ✅ CSV-safe split (handles quoted commas)
  const splitLine = (line) =>
    line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
      ?.map(v => v.replace(/^"|"$/g, "").trim()) || [];

  // ✅ Normalize headers
  const rawHeaders = splitLine(lines[0]);
  const headers = rawHeaders.map(h =>
    h.toLowerCase().replace(/[^a-z0-9]/g, "")
  );

  return lines.slice(1).map(line => {
    const cols = splitLine(line);
    const row = {};

    headers.forEach((key, i) => {
      row[key] = cols[i];
    });

    return row;
  });
}

export async function login(page, username, password, odscode, log = console.log) {

  const odsResult = await resolveOdsContext(page, odscode);

  log(`[ODS] Exists: ${odsResult.exists}`);
  log(`[ODS] Region: ${odsResult.region}`);

  await loginWithOds(page, username, password, odscode, odsResult);

}

export async function resolveOdsContext(page, odscode, log = console.log) {

  log("====================================================");
  log(`[ODS] START lookup for: ${odscode}`);

  if (!page || page.isClosed()) {
    throw new Error("Page is not available");
  }

  log(`[ODS] Navigating to O4H homepage...`);

  await page.goto("https://outcomes4health.org/o4h/", {
    waitUntil: "networkidle"
  });

  log(`[ODS] Page loaded: ${await page.title()}`);

  if (odscode.toLowerCase() === "prim") {
    log(`[ODS] Special case: PRIM → using Primary fallback`);

    return {
      exists: true,
      region: "Primary",
      fallback: true
    };
  }

  try {
    log(`[ODS] Clicking COVID pathway...`);
    await page.getByText("COVID", { exact: true }).click();

    log(`[ODS] Filling ODS input: ${odscode}`);
    await page.fill("#o4hODSCode", odscode);

    log(`[ODS] Submitting ODS lookup...`);
    await page.click("#o4hCheckODSCode");

    log(`[ODS] Waiting for ODS response list...`);

    try {
      await page.waitForSelector("#ODSResponseContainer li .responseODS", {
        timeout: 3000
      });
    } catch (waitErr) {
      log(`[ODS] ⚠️ Response list did NOT appear within timeout`);
      throw waitErr;
    }

    const responseItems = page.locator("#ODSResponseContainer li .responseODS");
    const count = await responseItems.count();

    log(`[ODS] Found ${count} response item(s)`);

    for (let i = 0; i < count; i++) {
      const text = await responseItems.nth(i).textContent();
      log(`[ODS] Response[${i}]: "${text}"`);

      if (!text) {
        log(`[ODS] ⚠️ Empty response text at index ${i}`);
        continue;
      }

      const code = text.split(":")[0].trim();
      log(`[ODS] Parsed code: "${code}"`);

      if (code.toLowerCase() === odscode.toLowerCase()) {
        log(`[ODS] ✅ MATCH FOUND for ${odscode}`);

        // ✅ CLICK SELECT FIRST
        const row = responseItems.nth(i).locator("..");
        const selectBtn = row.locator("button.o4hODSConfirm");

        log(`[ODS] Clicking Select button...`);
        await selectBtn.click();

        // ✅ WAIT FOR REGION INFO TO APPEAR
        log(`[ODS] Waiting for region container...`);

        await page.waitForSelector("#odsinstancecontainer", {
          timeout: 5000
        });

        // ✅ NOW extract region
        let regionName = null;

        try {
          const group = await page
            .locator("#odsinstancecontainer .odsinstanceinfo")
            .filter({ hasText: "Group:" })
            .innerText();

          log(`[ODS] Raw group text: ${group}`);

          const match = group.match(/Group:\s*(cvd[a-z])/i);
          const groupCode = match ? match[1] : null;

          const regionLetter = groupCode
            ? groupCode.slice(-1).toUpperCase()
            : "?";

          regionName = `COVD ${regionLetter}`;

          log(`[ODS] ✅ Region resolved: ${regionName}`);

        } catch (regionErr) {
          log(`[ODS] ⚠️ Failed to extract region AFTER select: ${regionErr.message}`);
        }

        return {
          exists: true,
          region: regionName,
          fallback: false
        };
      }
    }

    log(`[ODS] ❌ No matching ODS found in response list`);

    log(`[ODS] END (not found)`);

    return {
      exists: false,
      region: null,
      fallback: true
    };

  } catch (err) {
    log(`[ODS] ❌ Lookup failed: ${err.message}`);
    log(`[ODS] Stack: ${err.stack}`);

    return {
      exists: false,
      region: null,
      fallback: true,
      error: err.message
    };
  }
}

export async function loginWithOds(page, username, password, odscode, odsResult, log = console.log) {
  if (!page || page.isClosed()) {
    throw new Error("Page is not available at login start");
  }

  const secret = process.env.SECRET_KEY;
  if (!secret) {
    throw new Error("SECRET_KEY missing from environment");
  }

  const token = authenticator.generate(secret);

  // -------------------------------
  // ODS selection (based on lookup result)
  // -------------------------------

  if (odsResult.fallback) {
    await page.getByText("Other", { exact: true }).click();
  } else {
    const responseItems = page.locator("#ODSResponseContainer li .responseODS");
    const count = await responseItems.count();

    for (let i = 0; i < count; i++) {
      const text = await responseItems.nth(i).textContent();
      const code = text.split(":")[0].trim();

      if (code.toLowerCase() === odscode.toLowerCase()) {
        await responseItems
          .nth(i)
          .locator("..")
          .locator("button.o4hODSConfirm")
          .click();
        break;
      }
    }
  }

  // -------------------------------
  // LOGIN
  // -------------------------------

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


export async function securityWord(page, passcode = process.env.SECURITY_WORD) {
  const positionMap = {
    first: 0,
    second: 1,
    third: 2,
    fourth: 3,
    fifth: 4,
    sixth: 5,
  };

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

export async function editProvider(page, odsCode) {
  // Navigate to the Manage Providers page
  await page.goto("https://outcomes4health.org/o4h/admin/providers");

  // Search for provider
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
  // Click the edit button
  await page.click("#editProvider");
}

export async function editViewer(page, odsCode) {
  // Navigate to the Manage Providers page
  await page.goto("https://outcomes4health.org/o4h/admin/viewers");

  // Search for provider
  await page.fill("#organisationLookup", odsCode);

  // Wait for the autocomplete dropdown to appear
  await page.waitForSelector("#ui-id-1", { timeout: 5000 });

  // Click the first result
  await page.locator("#ui-id-1 li").first().click();

  // Click the edit button
  await page.click("#organisationEdit");
}

export async function editCommissioner(page, odsCode) {
  // Navigate to the Manage Providers page
  await page.goto("https://outcomes4health.org/o4h/admin/commissioners");

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
  await page.goto("https://outcomes4health.org/o4h/admin/commissioners");

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
