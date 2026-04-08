import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import process from "process";
import { login, setupContext, addJobRole } from "../helpers.mjs";
import { validateRow, writeFailuresCsv } from "../csvValidationHelper.mjs";
import { decryptEnv } from "../../common/common.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("SCRIPT BOOT:", __filename, new Date().toISOString());

process.on("uncaughtException", err =>
    console.error("UNCAUGHT EXCEPTION:", err?.stack || err)
);
process.on("unhandledRejection", r =>
    console.error("UNHANDLED REJECTION:", r?.stack || r)
);

function defaultLogger(...args) {
    console.log(...args);
}

// ------------------------------------------------------------
// CSV PARSER
// ------------------------------------------------------------
function parseCSV(csvText) {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim());

    return lines.slice(1).map(line => {
        const values = line
            .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
            .map(v => v.replace(/^"|"$/g, "").trim());

        return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
    });
}

// ------------------------------------------------------------
// LOG WRAPPER
// ------------------------------------------------------------
async function logAction(actionDesc, fn, logger) {
    const start = Date.now();
    logger(`➡️ ${actionDesc}`);
    try {
        await fn();
        logger(`✅ ${actionDesc} completed in ${Date.now() - start}ms`);
    } catch (err) {
        logger(`❌ ${actionDesc} failed: ${err.message}`);
        throw err;
    }
}

// ------------------------------------------------------------
// VALIDATION OPTIONS
// ------------------------------------------------------------
const validationOpts = {
    requiredFields: ["firstname", "lastname", "email"],
    blockDomains: ["tempmail.com", "mailinator.com"],
    customChecks: [
        row => {
            if (row.jobroles && row.jobroles.split(",").length > 10) {
                return "Too many jobroles";
            }
            if (row.deanery && row.deanery.length > 100) {
                return "Deanery value suspiciously long";
            }
            return null;
        }
    ]
};

// ------------------------------------------------------------
// MAIN RUN FUNCTION
// ------------------------------------------------------------
export default async function run({ logger = defaultLogger } = {}) {
    logger("RUN STARTED");

    // 🔐 decrypt env.enc
    try {
        logger("🔐 decryptEnv starting...");
        await decryptEnv(process.env.ENV_ENC_PATH, process.env.ENV_PASSPHRASE);
        logger("🔐 decryptEnv complete");
    } catch (err) {
        logger("❌ decryptEnv failed:", err?.stack || err);
        throw err;
    }

    // Validate required env vars
    const username = process.env.USERNAME;
    const password = process.env.PASSWORD;

    if (!username) throw new Error("Missing USERNAME");
    if (!password) throw new Error("Missing PASSWORD");

    // Config flags
    const human = process.env.CONFIG_HUMAN === "true" || process.env.HUMAN === "true";
    const intensity = Number(process.env.CONFIG_INTENSITY || 1);
    const headless = process.env.CONFIG_HEADLESS === "true" || process.env.HEADLESS === "true";
    const recordVideo = process.env.CONFIG_RECORD_VIDEO === "true";
    const recordTrace = process.env.CONFIG_RECORD_TRACE === "true";

    logger("CONFIG → human:", human);
    logger("CONFIG → intensity:", intensity);
    logger("CONFIG → headless:", headless);
    logger("CONFIG → recordVideo:", recordVideo);
    logger("CONFIG → recordTrace:", recordTrace);

    let browser = null;
    let context = null;
    let page = null;

    try {
        logger("🚀 Starting script...");

        const runDir = process.env.RUN_DIR
            ? process.env.RUN_DIR
            : path.resolve(__dirname, "runs", "manual-run");

        const inputCsvPath =
            process.env.INPUT_CSV_PATH ||
            path.resolve(__dirname, "input", "users.csv");

        logger("📂 Run directory:", runDir);
        logger("📁 CSV path:", inputCsvPath);

        if (!fs.existsSync(runDir)) {
            fs.mkdirSync(runDir, { recursive: true });
        }

        // Load CSV
        let users;
        try {
            const raw = fs.readFileSync(inputCsvPath, "utf-8");
            users = parseCSV(raw);
            logger(`✅ Loaded ${users.length} users from CSV`);
        } catch (err) {
            logger("❌ Error reading users.csv:", err.message);
            throw err;
        }

        // Setup Playwright
        logger("🔧 setupContext starting");
        ({ browser, context, page } = await setupContext({
            headless,
            human,
            runDir
        }));
        logger("✅ Browser/context/page created");

        // Login
        await logAction("Login", () => login(page, username, password), logger);

        // Prepare output CSV
        const resultsCsvPath = path.join(runDir, "UsersAdded.csv");
        if (!fs.existsSync(resultsCsvPath)) {
            fs.writeFileSync(resultsCsvPath, "firstname,lastname,addedAt\n", "utf-8");
        }

        // Main loop
        const failures = [];
        const seenEmails = new Set();

        for (const row of users) {
            const firstname = row.firstname ?? "";
            const lastname = row.lastname ?? "";
            const email = (row.email ?? "").toLowerCase().trim();
            const deanery = row.deanery ?? "";
            const jobroles = row.jobroles ?? "";

            logger(`\n👤 Processing user: ${firstname} ${lastname} (${email})`);

            // Duplicate detection (Per run)
            if (email) {
                if (seenEmails.has(email)) {
                    failures.push({ row, reasons: ["Duplicate email in input"] });
                    continue;
                }
                seenEmails.add(email);
            }

            // Validation
            const reasons = validateRow(row, validationOpts);
            if (reasons.length > 0) {
                failures.push({ row, reasons });
                continue;
            }

            await logAction("Navigate to create person page", () =>
                page.goto("https://fishbase.rcp-uat.14fishish.com/people/create"),
                logger
            );

            await logAction("Fill Salutation", () =>
                page.complete("#Person_Salutation", "Dr"),
                logger
            );

            await logAction("Fill First Name", () =>
                page.complete("#Person_OfficialFirstName", firstname),
                logger
            );

            await logAction("Fill Last Name", () =>
                page.complete("#Person_LastName", lastname),
                logger
            );

            await logAction("Fill Email", () =>
                page.complete("#Person_LMCEmail1", email),
                logger
            );

            await logAction("Select Deanery", () =>
                page.selectOption('select[name="CustomField499"]', { label: deanery }),
                logger
            );

            await logAction("Save user", () =>
                page.click('[value="Save"]'),
                logger
            );

            await logAction("Invite user", async () => {
                await page.getByRole("link", { name: "Invite to FourteenFish" }).click();
                await page.click("[type='submit'][value='Send the email']");
            }, logger);

            // Job roles
            const jobs = jobroles
                .split(",")
                .map(j => j.trim())
                .filter(j => j.length > 0);

            logger("🧪 Job roles parsed:", jobs);

            const Org = "Test TP1";

            for (let i = 0; i < jobs.length; i++) {
                const job = jobs[i];

                await logAction(`Add job role: ${job}`, () =>
                    addJobRole(page, job, Org, human),
                    logger
                );

                if (i === 0 && jobs.length > 1) {
                    await logAction("Navigate back to Person details", () =>
                        page.click('a:has-text("Person page")'),
                        logger
                    );
                }
            }

            // Log to CSV
            const csvRow = `"${firstname}","${lastname}","${new Date().toISOString()}"\n`;
            fs.appendFileSync(resultsCsvPath, csvRow);
            logger(`✅ Logged user to CSV`);
        }

        // Failures CSV
        const failuresPath = path.join(runDir, `validation_failures_${Date.now()}.csv`);
        writeFailuresCsv(failures, failuresPath);
        logger(`Wrote ${failures.length} validation failures to ${failuresPath}`);

        // Video
        if (recordVideo && page.saveVideo) {
            await page.saveVideo(`run-${Date.now()}`);
        }

        // Trace
        if (recordTrace) {
            const tracePath = path.join(runDir, "trace.zip");
            await context.tracing.stop({ path: tracePath });
        }

        logger("🏁 Script finished");

    } catch (err) {
        logger("❌ Unhandled error:", err?.stack || err);
        throw err;

    } finally {
        logger("__RUN_COMPLETE__");
        await new Promise(r => setTimeout(r, 50));

        try { if (page && !page.isClosed()) await page.close(); } catch { }
        try { if (context) await context.close(); } catch { }
        try { if (browser) await browser.close(); } catch { }

        logger("👋 Cleanup complete");
    }
}

// Runner always invokes this script directly
run().catch(err => {
    console.error("Script failed:", err?.stack || err);
    process.exit(1);
});