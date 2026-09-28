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

export async function resetMfa(
  page,
  username,
  password,
  email,
  logger = console.log
) {

  await page.goto("https://host.emis-x.uk/?emisweb=false", {
    waitUntil: "networkidle"
  });

  logger("STEP 1 - Generate OTP");

  const secret = process.env.SECRET_KEY;

  if (!secret) {
    throw new Error(
      "SECRET_KEY missing from environment"
    );
  }

  const token =
    authenticator.generate(secret);

  logger("STEP 2 - Fill username");

  await page.fill(
    "#signInName",
    username
  );

  logger("STEP 3 - Fill password");

  await page.fill(
    "#password",
    password
  );

  logger("STEP 4 - Waiting for OTP screen");

  await Promise.all([
    page.waitForSelector("#otpCode"),
    page.click("#next")
  ]);

  logger("STEP 5 - OTP screen reached");

  await page.fill(
    "#otpCode",
    token
  );

  logger("STEP 6 - Waiting for role selector");

  await Promise.all([
    page.waitForSelector(".roleName"),
    page.click("#continue")
  ]);

  logger("STEP 7 - Role selector reached");

  logger("STEP 8 - Clicking MFA role");

  await page.locator("a", {
    has: page.locator(
      ".roleName",
      { hasText: "MFA Reset Role" }
    )
  }).click();

  logger("STEP 9 - Waiting for network idle");

  await page.waitForLoadState("networkidle");

  logger("STEP 10 - Navigating to MFA reset");

  await page.goto(
    "https://host.emis-x.uk/mfa-reset"
  );

  logger("STEP 11 - Waiting for network idle");

  await page.waitForLoadState("networkidle");

  logger("STEP 12 - Waiting for email field");

  await page.waitForSelector(
    "#email",
    { timeout: 30000 }
  );

  logger("STEP 13 - Email field found");

  await page.fill(
    "#email",
    email
  );

  await page.getByTestId(
    "find-user-email"
  ).click();

  logger("STEP 15 - Find User clicked");
  await page.waitForFunction(() =>
    document.body.innerText.includes(
      "User account found"
    )
  );

  logger("STEP 15 - User account found");

  logger("STEP 16 - Clicking Reset MFA");

  await page.getByTestId(
    "reset-mfa-button"
  ).click();

  logger("STEP 17 - Complete");
}

