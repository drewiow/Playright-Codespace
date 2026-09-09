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

export async function openService(page, service, logger) {

  await loginCommissioner(page, service.commissionerName, logger);

  await page.goto(service.editServiceLink);

  await page.waitForLoadState(
    "networkidle"
  );

  const questionHeaders = await page.$$eval(
    "#inAuditOne option",
    options =>
      options
        .map(o => o.textContent?.trim())
        .filter(t => t?.startsWith("Q"))

  );


  console.log(questionHeaders);

  return { questionHeaders };
}

export async function openFundingService(page, service, logger) {

  await loginCommissioner(page, service.commissionerName, logger);
  await page.goto("/pharmoutcomes/claims/home/?describe");
  await page.waitForLoadState("networkidle");

  const fundingServices = await page.$$eval(
    "h4.fundingservice",
    services =>
      services.map(service => {

        const link = service.querySelector("a");
        const fullServiceName = link?.textContent?.trim() ?? "";
        const baseServiceName = fullServiceName.replace(/\s*\[\d{4}-\d{2}-\d{2}\s*->\s*[\d-]+\]\s*$/, "");
        const detail = service.nextElementSibling;

        const editServiceLink =
          [...detail.querySelectorAll("a")]
            .find(a =>
              a.textContent?.includes(
                "Go to Service Edit"
              )
            );

        const editFundingLink =
          [...detail.querySelectorAll("a")]
            .find(a =>
              a.textContent?.includes(
                "Edit Funding Detail"
              )
            );

        return {
          fundingId:
            link.id.replace("sfid", ""),
          serviceName:
            fullServiceName,
          baseServiceName,
          editServiceLink: editServiceLink?.getAttribute("href"),
          editFundingLink: editFundingLink?.getAttribute("href")
        };
      })
  );

  console.log("SERVICE : ", service);
  const groupedServices = Object.values(
    fundingServices.reduce(
      (acc, config) => {

        if (!acc[config.baseServiceName]) {
          acc[config.baseServiceName] = {
            serviceName:
              config.baseServiceName,
            fundingDefinitions: []
          };
        }

        acc[
          config.baseServiceName
        ].fundingDefinitions.push(
          config
        );

        return acc;

      },
      {}
    )
  );

  const selectedService =
    groupedServices.find(
      s =>
        service.serviceName.startsWith(
          s.serviceName
        )
    );



  return selectedService;
}

export async function findService(page, logger) {

  await page.goto("/pharmoutcomes/services/home");

  await page.waitForLoadState(
    "networkidle"
  );

  console.log(await page.locator("body").innerText());

  const services = await page.$$eval(
    "tr",
    rows =>
      rows.map(row => ({
        text: row.textContent?.replace(/\s+/g, " ").trim(),
        links: [...row.querySelectorAll("a")].map(a => ({
          text: a.textContent?.trim(),
          href: a.href,
          id: a.id
        }))
      }))
  );

  console.log(JSON.stringify(services, null, 2));

  return services;
}

export async function findFundingService(page, serviceName, logger) {


  await page.goto("/pharmoutcomes/claims/home/?describe");

  await page.waitForLoadState(
    "networkidle"
  );

  const serviceHeaders =
    await page.locator(
      "h4.fundingservice"
    ).all();

  const fundingServices = await page.$$eval(
    "h4.fundingservice",
    services =>
      services.map(service => {

        const link = service.querySelector("a");

        const fullServiceName = link.textContent.trim();

        const baseServiceName =
          fullServiceName.replace(
            /\s*\[\d{4}-\d{2}-\d{2}\s*->\s*[\d-]+\]\s*$/,
            ""
          );

        const detail = service.nextElementSibling;

        const detailText = detail?.innerText ?? "";

        const paymentRules = detail
          ? [...detail.querySelectorAll("ul li")]
            .filter(li =>
              li.textContent?.includes("[Edit]")
            )
            .map(li => {

              const editPaymentRuleLink =
                li.querySelector(
                  "a.orange.full-lock"
                )?.getAttribute("href");

              const question =
                li.querySelector(
                  "a.info.no-lock i"
                )?.textContent?.trim();

              const amountMatch =
                li.textContent.match(
                  /£[\d,.]+/
                );

              return {
                question,
                amount: amountMatch?.[0],
                editPaymentRuleLink
              };
            })
          : [];

        const editServiceLink =
          [...detail.querySelectorAll("a")]
            .find(a =>
              a.textContent?.includes(
                "Go to Service Edit"
              )
            );

        return {
          fundingId: link.id.replace("sfid", ""),
          serviceName: link.textContent.trim(),
          baseServiceName,
          editServiceLink: editServiceLink?.getAttribute("href"),
          serviceId: editServiceLink?.href
            ?.match(/id=(\d+)/)?.[1],
          paymentRules

        };
      })

  );

  const groupedServices = Object.values(
    fundingServices.reduce((acc, service) => {

      if (!acc[service.baseServiceName]) {
        acc[service.baseServiceName] = {
          ...service,
          serviceName: service.baseServiceName,
          fundingDefinitions: []
        };
      }

      acc[service.baseServiceName]
        .fundingDefinitions
        .push(service);

      return acc;

    }, {})
  );
  return groupedServices;
}

export async function removeCommissioner(page, commissionerId, logger) {

  const link = page.locator(
    `a[href*="minister=remove"][href*="commissioner=${commissionerId}"]`
  );

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

  logger(
    `✅ Removed commissioner ${commissionerId}`
  );

  return true;
}

export async function getUserDetails(page) {

  const exists = async (selector) =>
    (await page.locator(selector).count()) > 0;

  const value = async (selector) => {

    if (!await exists(selector)) {
      return "";
    }

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

  const mfaText = await page
    .locator('body')
    .textContent();

  const hasMfa =
    mfaText.includes("MFA Secret is set");

  const hasPasscode =
    mfaText.includes("Valid security word in use");

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

  const permissions = await page.locator(
    '#fieldsetpermissions input[type="checkbox"]:checked'
  ).evaluateAll(
    checkboxes => {

      return checkboxes
        .map(cb => {

          const label =
            cb.parentElement.querySelector(
              "label"
            );

          return label
            ? label.textContent.trim()
            : null;

        })
        .filter(Boolean);

    }
  );

  return {
    uid: await value('input[name="id"]'),
    username: await value('#inUserName'),
    fullName: await value('#inKnownName'),
    email: await value('#inContactEmail'),
    telephone: await value('#inContactPhone'),
    mobile: await value('#inContactMobile'),
    jobTitle: await value('#inJobTitle'),
    userType,
    organisation,
    hasMfa,
    hasPasscode,
    roles,
    permissions

  };
}

export async function openUser(page, uid, logger) {
  logger(`👤 Opening user ${uid}`);
  await page.goto(`/pharmoutcomes/admin/users?edit=${uid}`);
  return getUserDetails(page);
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

export async function accreditBySysId(page, sysId, serviceIDs = [], posToken, logger) {

  for (const serviceID of serviceIDs) {
    const accreditServiceLink = `/pharmoutcomes/admin/providers?id=${sysId}&accredit=${serviceID}&POSesTok=${posToken}`;
    logger?.event(LoggerEvent.ACCREDIT, { sysId, service: serviceID, accreditServiceLink });

    const createdAt = new Date().toISOString();

    logger(`➕ Accrediting Service ${serviceID}`);
    const actionStart = Date.now();
    await page.goto(accreditServiceLink);
    logger(`✅ Completed (${Date.now() - actionStart}ms)`);
  }
}

export async function removeCommissionerBySysId(page, sysId, commissionerId, posToken, logger) {

  const removeCommissionerLink = `/pharmoutcomes/admin/commissioners?provider=${sysId}&minister=remove&commissioner=${commissionerId}&POSesTok=${posToken}`;
  const createdAt = new Date().toISOString();
  logger(`➕ Removing Commissioner ${commissionerId}`);
  const actionStart = Date.now();
  await page.goto(removeCommissionerLink);
  logger(`✅ Completed (${Date.now() - actionStart}ms)`);

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

        const row = page.locator(
          `tr:has(td:first-child:text-is("${serviceID}"))`
        );

        const rowCount = await row.count();

        if (rowCount === 0) {

          console.log(
            `ℹ️ Service ${serviceID} not available for this provider`
          );

          handled = true;
          break;
        }

        const actionLink = row.locator("a").filter({
          hasText: /accredit|remove/i
        });

        const actionCount =
          await actionLink.count();

        if (actionCount === 0) {

          console.log(
            `⚠️ Service ${serviceID} found but no accreditation action exists`
          );

          handled = true;
          break;
        }

        const actionText = (
          await actionLink.first().textContent()
        )
          ?.trim()
          ?.toLowerCase();

        if (actionText === "remove") {

          console.log(
            `ℹ️ Service ${serviceID} already accredited`
          );

          handled = true;
          break;
        }

        if (actionText === "accredit") {

          console.log(
            `✅ Accrediting service ${serviceID}`
          );

          await Promise.all([
            page.waitForLoadState("networkidle"),
            actionLink.first().click()
          ]);

          await page.waitForTimeout(3000);

          handled = true;
          break;
        }

        console.log(
          `⚠️ Service ${serviceID} has unexpected action: ${actionText}`
        );

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

export async function openOrganisation(page, odsCode, helpers, logger) {
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

export function getOrganisationType(odsCode, logger) {
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

export async function findProvider(page, odsCode, logger) {

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

export async function editProvider(page, odsCode, logger) {
  logger?.event(LoggerEvent.OPEN_PROVIDER, { odsCode });
  await findProvider(page, odsCode, logger);
  await page.click("#editProvider");
}

export async function loginAsProvider(page, odsCode, logger) {

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

export async function editViewer(page, odsCode, log) {
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

export async function editCommissioner(page, odsCode, log) {
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

export async function loginCommissioner(
  page,
  commissionerName,
  logger = console.log
) {

  const loggedInAs =
    await page.locator(
      "form[action='/pharmoutcomes/system/logout']"
    ).textContent();

  if (
    loggedInAs
      ?.toLowerCase()
      .includes(
        commissionerName.toLowerCase()
      )
  ) {

    logger(
      `Already logged into ${commissionerName}`
    );

    return;
  }

  await page.goto("/pharmoutcomes/admin/commissioners");

  // Search for provider
  await page.fill("#organisationLookup", commissionerName);

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

