import { authenticator } from "otplib";
import { decryptEnv, createBrowserContext } from "../common/common.mjs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Decrypt env.enc using ENV_ENC_PATH + ENV_PASSPHRASE
export async function setupContext(options = {}) {
  const envPath = process.env.ENV_ENC_PATH;
  const passphrase = process.env.ENV_PASSPHRASE;

  if (!envPath) throw new Error("ENV_ENC_PATH missing");
  if (!passphrase) throw new Error("ENV_PASSPHRASE missing");

  await decryptEnv(envPath, passphrase);

  return await createBrowserContext(options);
}

export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
    const row = {};
    headers.forEach((h, i) => (row[h] = cols[i]));
    return row;
  });
}

export async function login(page, username, password, odscode) {
  const secret = process.env.SECRET_KEY;
  const token = authenticator.generate(secret);

  await page.goto("https://outcomes4health.org/o4h/");

  if (odscode.toLowerCase() === "prim") {
    await page.getByText("Other", { exact: true }).click();
  } else {
    await page.getByText("COVID", { exact: true }).click();

    await page.fill("#o4hODSCode", odscode);
    await page.click("#o4hCheckODSCode");

    let matched = false;

    try {
      await page.waitForSelector("#ODSResponseContainer li .responseODS", {
        timeout: 3000,
      });

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
          matched = true;
          console.log(`${odscode} : found`);
          break;
        }
      }
    } catch {
      console.log("Element did not appear within 3 seconds.");
      await page.getByText("Other", { exact: true }).click();
    }

    if (!matched) {
      await page.getByText("Other", { exact: true }).click();
    }
  }

  await page.fill("#login_name", username);
  await page.fill("#login_pwd", password);
  await page.click("[type='submit'][value='Go']");

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
  // Find the span with the text and get the next sibling (input or editable element)
  const addButton = page
    .locator("span", { hasText: "+ Add new journal" })
    .nth(0);
  const input = addButton.locator("xpath=following-sibling::*[1]");

  await input.click();
  await input.type(`Case : ${caseRef}`);
  await input.press("Enter");
}

export async function deaccredit(page, PIDService) {
  const links = await page.$$('a[href*="deaccredit"]');

  if (links.length === 0) {
    console.log("ℹ️ No deaccredit links found, continuing...");
    return;
  }

  for (const link of links) {
    const href = await link.getAttribute("href");
    if (href && !href.includes(PIDService)) {
      console.log(`🔗 Visiting: ${href}`);
      await page.goto(href);
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
