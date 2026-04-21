import { fileURLToPath } from "url";
import path from "path";
import { createBrowserContext } from "../../common/common.mjs";
import { parseAdvancedSteps, resolveCsvTokens } from "../../advanced/parseAdvancedSteps.mjs";
import { executeAdvancedSteps } from "../../advanced/executeAdvancedSteps.mjs";
import process from "process";

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

export default async function run({ logger = defaultLogger } = {}) {
    logger("RUN STARTED");

    const advancedStepsText = process.env.ADVANCED_STEPS || "";
    const steps = parseAdvancedSteps(advancedStepsText);
    logger(`[Advanced] Parsed ${steps.length} step(s)`);

    const term = process.env.TERM;

    if (!term) throw new Error("Missing TERM");

    let browser = null;
    let context = null;
    let page = null;


    try {
        logger("🔧 setupContext starting");
        ({ browser, context, page } = await createBrowserContext({
            headless: process.env.CONFIG_HEADLESS === "true",
            human: process.env.CONFIG_HUMAN === "true"
        }));

        logger("✅ Browser/context/page created");

        await page.goto("https://duckduckgo.com/");
        logger("✅ Navigated to DuckDuckGo website");
        await page.fill('input[name="q"]', term);

        await page.keyboard.press("Enter");
        logger("✅ Searched for term : " + term);

        await page.waitForSelector('a[data-testid="result-title-a"]', {
            timeout: 5000
        });

        //Do the advanced script
        const resolvedStepsText = resolveCsvTokens(
            advancedStepsText,
            row
        );

        const resolvedSteps = parseAdvancedSteps(resolvedStepsText);

        if (steps.length > 0) {
            logger(`🚀 Executing advanced steps`);
            await executeAdvancedSteps({
                steps: resolvedSteps,
                page,
                rowIndex: 1, // no row index in this script, but keeping for consistency
                log: logger
            });
        }

        if (process.env.CONFIG_HUMAN === "true") {
            logger("🕒 Browser will remain open...");
            await new Promise(() => { });
        }


    } catch (err) {
        logger("❌ Run error:", err?.stack || err);
        throw err;

    } finally {
        logger("__RUN_COMPLETE__");
    }
}

// Runner always invokes this script directly
run().catch(err => {
    console.error("Script failed:", err?.stack || err);
    process.exit(1);
});