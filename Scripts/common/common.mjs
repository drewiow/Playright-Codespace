import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "path";
import crypto from "crypto";
import { chromium } from "playwright";
import Papa from "papaparse";

// -----------------------------
// 1. Decrypt environment file
// -----------------------------
/**
 * decryptEnv
 * - Supports the existing binary format: [salt (16 bytes)][iv (16 bytes)][ciphertext...]
 * - Derives key with scrypt(password, salt, 32)
 * - Uses AES-256-CBC (compatible with your current encryptor)
 * - Injects variables into process.env (no .env file written by default)
 *
 * @param {string} envPath - path to the encrypted file
 * @param {string} [passphrase] - optional passphrase; if omitted, will read from ENV_PASSPHRASE or DECRYPT_PASSWORD
 */


const ALGO = "aes-256-gcm";
const PBKDF2_ITERATIONS = 310000;

export function parseCSV(text) {

    const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true
    });

    return result.data.map(rawRow => {

        const row = {};

        Object.entries(rawRow).forEach(([key, value]) => {

            const normalisedKey =
                key
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, "");

            row[normalisedKey] =
                typeof value === "string"
                    ? value.trim()
                    : value;

        });

        return row;
    });
}



export async function logAction(actionDesc, fn, logger) {
    const start = Date.now();
    //logger(`➡️ ${actionDesc}`);
    try {
        const result = await fn();
        // logger(`✅ ${actionDesc} completed in ${Date.now() - start}ms`);
        return result;
    } catch (err) {
        logger(`❌ ${actionDesc} failed: ${err.message}`);
        throw err;
    }
}

export function getMappedValue(row, mappings, field, logger = console.log) {

    const actualField =
        Object.keys(mappings).find(
            k => k.toLowerCase() === field.toLowerCase()
        );

    if (!actualField) {
        return "";
    }

    const column = mappings[actualField];

    const normalise = value =>
        value
            ?.toString()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

    const actualColumn =
        Object.keys(row).find(
            k => normalise(k) === normalise(column)
        );

    if (!actualColumn) {
        logger(
            `⚠️ Column "${column}" not present in CSV row`
        );
        return "";
    }

    return String(row[actualColumn] ?? "");
}

export function toTitleCase(value) {
    return value
        ?.toLowerCase()
        .replace(
            /(^|[\s'-])\w/g,
            char => char.toUpperCase()
        )
        .trim() || "";
}

export function cleanEmail(value) {
    const email = value?.trim().toLowerCase();

    if (!email || email === "none") {
        return "";
    }

    return email;
};

export const scriptStatus = {
    // Lifecycle
    RUN_STARTED: "🚀 RUN STARTED",
    RUN_COMPLETE: "__RUN_COMPLETE__",

    // Row lifecycle
    ROW_START: (ods) => `🔄 Processing ODS: ${ods}`,
    ROW_PROGRESS: (i, total) => `ROW ${i}/${total}`,
    ROW_COMPLETE: (ods) => `✅ Row completed: ${ods}`,
    ROW_FAILED: (ods, msg) => `❌ Row failed (${ods}): ${msg}`,

    // Steps
    LOGIN: "🔐 Logging in...",
    OPEN_PROVIDER: "👤 Opening provider...",
    DEACCREDIT: "🔧 Deaccrediting...",
    AUDIT: "📝 Adding audit...",
    SAVE: "💾 Saving...",

    // Misc
    LOOKUP: "🔍 Looking up ODS...",
};

export async function encryptEnv(plaintext, password) {
    if (!password) throw new Error("Missing master password");

    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);

    const key = crypto.pbkdf2Sync(
        password,
        salt,
        PBKDF2_ITERATIONS,
        32,
        "sha256"
    );

    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([salt, iv, tag, encrypted]);
}

export function decryptEnv(data, password) {
    if (!password) throw new Error("Missing master password");

    const salt = data.subarray(0, 16);
    const iv = data.subarray(16, 28);
    const tag = data.subarray(28, 44);
    const ciphertext = data.subarray(44);

    const key = crypto.pbkdf2Sync(
        password,
        salt,
        PBKDF2_ITERATIONS,
        32,
        "sha256"
    );

    const decipher = crypto.createDecipheriv(
        ALGO,
        key,
        iv,
        { authTagLength: 16 }
    );

    decipher.setAuthTag(tag);

    return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ]).toString("utf8");
}


// -----------------------------
// 3. Browser context factory
// -----------------------------
export async function createBrowserContext(options = {}) {
    // Resolve options with explicit precedence:
    // 1. options passed programmatically
    // 2. environment variables
    // 3. sensible local default (visible browser)

    const headless = typeof options.headless === "boolean"
        ? options.headless
        : (process.env.CONFIG_HEADLESS === "true" ? true : false);

    const devtools = typeof options.devtools === "boolean"
        ? options.devtools
        : process.env.CONFIG_DEVTOOLS === "true" || false;

    const recordVideo = typeof options.recordVideo === "boolean"
        ? options.recordVideo
        : process.env.CONFIG_RECORD_VIDEO === "true";

    const recordTrace = typeof options.recordTrace === "boolean"
        ? options.recordTrace
        : process.env.CONFIG_RECORD_TRACE === "true";

    const runDir = options.runDir;
    const videoDir = `${runDir}/videos`;
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

    const browser = await chromium.launch({
        headless: false,
        devtools: devtools,
        executablePath: "C:\\Users\\Drew.Clarke\\AppData\\Local\\ms-playwright\\chromium_1150\\chrome-win\\chrome.exe"
    });

    try {
        const proc = browser.process ? browser.process() : null;
    } catch (err) {
        console.log("Could not read browser.process()", err);
    }

    const context = await browser.newContext({
        baseURL: 'https://pharmoutcomes.org/pharmoutcomes/',
        recordVideo: recordVideo ? { dir: videoDir, size: { width: 1280, height: 720 } } : undefined,
        ignoreHTTPSErrors: true,
        userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        viewport: {
            width: 1920,
            height: 1080
        }
    });

    const page = await context.newPage();
    context.setDefaultTimeout(60000);
    page.setDefaultTimeout(60000);

    console.log(await page.evaluate(() => ({
        userAgent: navigator.userAgent,
        webdriver: navigator.webdriver
    })));


    page.complete = async (selector, value) => {
        await page.waitForSelector(selector, { timeout: 15000 });
        await page.click(selector);
        await page.fill(selector, "");
        await page.type(selector, value);
    };

    if (recordTrace) await context.tracing.start({ screenshots: true, snapshots: true });

    page.saveVideo = async (name = "run") => {
        const video = page.video();
        if (!video) return;
        const filePath = path.join(videoDir, `${name}.webm`);
        await video.saveAs(filePath);
        await page.close();

    };

    return { browser, context, page, headless, recordTrace };
}


export function normaliseKey(key) {
    return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}