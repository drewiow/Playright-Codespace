import { authenticator } from "otplib";
import promptSync from "prompt-sync";
const prompt = promptSync({ sigint: true });
import { decryptEnv, createBrowserContext } from "../common/common.mjs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// replace your existing setupContext with this
export async function setupContext(options = {}) {
    // Prefer per-run uploaded file if provided by the server, otherwise use local .env.enc
    const envPath = process.env.ENV_ENC_PATH || path.join(__dirname, ".env.enc");

    // Passphrase: prefer ENV_PASSPHRASE (set by server), otherwise DECRYPT_PASSWORD for local runs
    const passphrase = process.env.ENV_PASSPHRASE || process.env.DECRYPT_PASSWORD;

    try {
        // decryptEnv must accept (envPath, passphrase)
        await decryptEnv(envPath, passphrase);
        console.log("✅ decryptEnv succeeded for", envPath);
    } catch (err) {
        // make sure errors are visible in stderr.log and server console
        console.error("❌ decryptEnv failed:", err && err.message ? err.message : err);
        // rethrow so the run fails visibly
        throw err;
    }

    return await createBrowserContext(options);
}

export async function login(page, username, password) {
    console.log("🔍 login() entered");

    const secret = process.env.SECRET_KEY;
    const token = authenticator.generate(secret);

    console.log("🔍 About to call first Playwright action: goto");
    console.log("🔍 goto starting…");
    await page.goto("htt.ps://fishbase.rcp-uat.14fishish.com", {
        waitUntil: "domcontentloaded",
        timeout: 20000
    });
    console.log("🔍 goto finished");

    console.log("🔍 About to fill email");
    console.log("🔍 About to complete email field");
    await page.complete('input[name="email"]', username);
    console.log("🔍 Completed email field");

    console.log("🔍 About to click Next");
    await page.click("[type='submit'][value='Next']");

    console.log("🔍 About to fill password");
    await page.complete('input[name="password"]', password);

    console.log("🔍 About to click Submit");
    await page.click("[type='submit'][value='Submit']");

    console.log("🔍 About to fill Google token");
    await page.type("#googletoken", token);

    console.log("🔍 About to click checkgoogletoken");
    await page.click("#checkgoogletoken");

    console.log("🔍 About to goto /people");
    await page.goto("https://fishbase.rcp-uat.14fishish.com/people");
}

export async function addJobRole(page, job, org, human) {
    const rand = (min, max) => Math.floor(Math.random() * (max - min)) + min;

    console.log(`🛠 Adding job role: ${job}`);

    // 1. Click "New job"
    await page.getByRole("link", { name: "New job" }).click();
    if (human) await page.waitForTimeout(rand(300, 700));

    // 2. Select job from dropdown
    await page.locator("#jobid").selectOption({ label: job });
    if (human) await page.waitForTimeout(rand(200, 500));

    // 3. Handle Chosen dropdown for Organisation
    await page.click("#OrganisationId_chosen");

    const searchInput = page.locator("#OrganisationId_chosen .chosen-search input");

    // Clear input
    await searchInput.fill("");
    if (human) await page.waitForTimeout(rand(150, 350));

    // Type organisation name
    if (human) {
        for (const char of org) {
            await searchInput.type(char, { delay: rand(120, 280) });
        }
    } else {
        await searchInput.fill(org);
    }

    await searchInput.type(" ");

    // Wait for result to appear
    await page.waitForSelector(
        `#OrganisationId_chosen .chosen-results li:has-text("${org}")`
    );

    // Select organisation
    await page.click(
        `#OrganisationId_chosen .chosen-results li:has-text("${org}")`
    );

    if (human) await page.waitForTimeout(rand(200, 500));

    // 4. Submit job form
    await page.click("[type='submit'][value='Save']");
    if (human) await page.waitForTimeout(rand(300, 700));
}