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
    line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)
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

export async function selectLoginChoice(page, companyName) {
  const choices = page.locator('#loginChoices .thumbnail');

  const count = await choices.count();

  for (let i = 0; i < count; i++) {
    const choice = choices.nth(i);

    const name = (await choice.locator('h4').textContent())?.trim();

    if (name === companyName) {
      await choice.getByRole('button', { name: 'Select' }).click();
      return;
    }
  }

  throw new Error(`Login choice not found: ${companyName}`);
}

export async function login(page, username, password, log = console.log) {

  const secret = process.env.SECRET_KEY;
  if (!secret) {
    throw new Error("SECRET_KEY missing from environment");
  }

  const token = authenticator.generate(secret);

  await page.fill("#inputEmail", username);
  await page.fill("#inputPassword", password);
  await page.click("[type='submit'][value='Sign in']")


  await page.locator('#loginChoices .thumbnail').first().waitFor({
    state: 'visible'
  });


  await selectLoginChoice(page, 'Pinnacle Health');

  // MFA
  await page.fill("#verificationCode", token);
  await page.click("[type='submit'][value='Sign in']")


  await page.click("[type='submit'][value='Accept']")



}

