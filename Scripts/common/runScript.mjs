import fsp from "node:fs/promises";
import process from "node:process";
import { initExecution } from "./initExecution.mjs";
import { setupContext } from "../pharmoutcomes/helpers.mjs";
import { parseAdvancedSteps, resolveCsvTokens } from "../advanced/parseAdvancedSteps.mjs";
import { executeAdvancedSteps } from "../advanced/executeAdvancedSteps.mjs";
import { parseCSV } from "./common.mjs";
export async function runScript({ logger = console.log, main }) {

    // logger("SCRIPT BOOT");

    // ✅ prevent duplicate handlers
    if (!process.__handlersAttached) {
        process.on("uncaughtException", err =>
            logger("UNCAUGHT EXCEPTION:", err?.stack || err)
        );

        process.on("unhandledRejection", r =>
            logger("UNHANDLED REJECTION:", r?.stack || r)
        );

        process.__handlersAttached = true;
    }

    await initExecution({ logger });

    const username = process.env.USERNAME;
    const password = process.env.PASSWORD;

    if (!username) throw new Error("Missing USERNAME");
    if (!password) throw new Error("Missing PASSWORD");

    const config = {
        human: process.env.CONFIG_HUMAN === "true" || process.env.HUMAN === "true",
        headless: process.env.CONFIG_HEADLESS === "true" || process.env.HEADLESS === "true",
        recordVideo: process.env.CONFIG_RECORD_VIDEO === "true",
        recordTrace: process.env.CONFIG_RECORD_TRACE === "true",
        dryRun: process.env.DRY_RUN === "true",
        runDir: process.env.RUN_DIR
    };

    // ✅ OPTIONAL CSV
    const csvPath = process.env.CSV_PATH;
    let rows = [];
    let hasCSV = false;

    if (csvPath) {
        logger(`📄 Reading CSV: ${csvPath}`);

        const csvText = await fsp.readFile(csvPath, "utf8");
        rows = parseCSV(csvText);

        logger(`📦 Loaded ${rows.length} rows`);
        hasCSV = true;
    }

    const { browser, context, page } = await setupContext(config);

    const columnMappings =
        JSON.parse(
            process.env.COLUMN_MAPPINGS || "{}"
        );
    const advancedStepsText = process.env.ADVANCED_STEPS || "";
    const isAdvanced = process.env.ADVANCED === "true";
    const baseSteps = parseAdvancedSteps(advancedStepsText);

    try {
        await main({
            page,
            rows,
            hasCSV, // ✅ NEW
            logger,
            username,
            password,
            config,
            columnMappings,
            advancedStepsText,
            isAdvanced,
            baseSteps,

            runAdvanced: async (row = {}, rowIndex = 1) => {
                if (baseSteps.length === 0) return;

                await page.waitForLoadState("networkidle");

                const resolvedStepsText = resolveCsvTokens(advancedStepsText, row);
                const resolvedSteps = parseAdvancedSteps(resolvedStepsText);

                if (resolvedSteps.length > 0) {
                    await executeAdvancedSteps({
                        steps: resolvedSteps,
                        page,
                        rowIndex,
                        log: logger
                    });
                }
            }
        });

    } finally {
        logger("__RUN_COMPLETE__");

        await page?.close().catch(() => { });
        await context?.close().catch(() => { });
        await browser?.close().catch(() => { });

        logger("👋 Cleanup complete");
    }
}