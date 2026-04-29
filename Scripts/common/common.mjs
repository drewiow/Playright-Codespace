// Scripts/common/common.mjs
import fsp from "fs/promises";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { chromium } from "playwright";

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

export async function decryptEnv(encPath, password) {
    if (!password) throw new Error("Missing master password");

    const data = await fsp.readFile(encPath);

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

    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ]).toString("utf8");

    // 🔥 NEW: parse .env content and load into process.env
    decrypted.split(/\r?\n/).forEach(line => {
        const [key, ...rest] = line.split("=");
        if (!key) return;
        const value = rest.join("=");
        process.env[key.trim()] = value.trim();
    });

    return decrypted;
}

// -----------------------------
// 2. Human mode overrides
// -----------------------------
export function enableHumanMode(page, enabled, intensity = 1) {
    if (!enabled) return;

    const baseTypeDelay = 40;
    const baseClickDelay = 80;
    const baseScrollDelay = 120;

    const scale = Math.max(1, Math.min(intensity, 5));

    const typeDelay = baseTypeDelay * scale;
    const clickDelay = baseClickDelay * scale;
    const scrollDelay = baseScrollDelay * scale;

    try {
        const originalType = page.type.bind(page);
        page.type = async (selector, text, options = {}) => {
            const delay = options?.delay ?? typeDelay;
            return originalType(selector, text, { ...options, delay });
        };

        const originalClick = page.click.bind(page);
        page.click = async (selector, options = {}) => {
            await page.waitForTimeout(clickDelay);
            return originalClick(selector, options);
        };

        const originalPress = page.keyboard.press.bind(page.keyboard);
        page.keyboard.press = async (key, options = {}) => {
            await page.waitForTimeout(typeDelay);
            return originalPress(key, options);
        };

        page.humanScroll = async (amount = 400) => {
            await page.mouse.wheel(0, amount);
            await page.waitForTimeout(scrollDelay);
        };

        console.log(`👤 Human Mode enabled (intensity ${intensity})`);
    } catch (err) {
        console.error("❌ Human mode error:", err);
    }
}

// -----------------------------
// 3. Browser context factory
// -----------------------------
export async function createBrowserContext(options = {}) {
    // Resolve options with explicit precedence:
    // 1. options passed programmatically
    // 2. environment variables
    // 3. sensible local default (visible browser)
    const human = typeof options.human === "boolean"
        ? options.human
        : process.env.CONFIG_HUMAN === "true";

    const intensity = typeof options.intensity === "number"
        ? options.intensity
        : Number(process.env.CONFIG_INTENSITY || 1);

    const headless = typeof options.headless === "boolean"
        ? options.headless
        : (process.env.CONFIG_HEADLESS === "true" ? true : false);

    // Default to visible for local development unless explicitly set true
    const effectiveHeadless = headless === true ? true : false;

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

    // Log everything so you can see why headless was chosen
    console.log("createBrowserContext config ->", {
        human, intensity, headless: effectiveHeadless, devtools, recordVideo, recordTrace, runDir
    });

    const browser = await chromium.launch({
        headless: effectiveHeadless,
        slowMo: human ? intensity * 100 : 0,
        devtools: devtools
    });

    console.log("Browser launched version:", await browser.version());
    try {
        const proc = browser.process ? browser.process() : null;
    } catch (err) {
        console.log("Could not read browser.process()", err);
    }

    const context = await browser.newContext({
        recordVideo: recordVideo ? { dir: videoDir, size: { width: 1280, height: 720 } } : undefined
    });

    const page = await context.newPage();
    context.setDefaultTimeout(60000);
    page.setDefaultTimeout(60000);

    page.complete = async (selector, value) => {
        await page.waitForSelector(selector, { timeout: 15000 });
        await page.click(selector);
        await page.fill(selector, "");
        await page.type(selector, value);
    };

    enableHumanMode(page, human, intensity);

    if (recordTrace) await context.tracing.start({ screenshots: true, snapshots: true });

    page.saveVideo = async (name = "run") => {
        const video = page.video();
        if (!video) return;
        const filePath = path.join(videoDir, `${name}.webm`);
        await video.saveAs(filePath);
        await page.close();

    };

    return { browser, context, page, effectiveHeadless, recordTrace };
}