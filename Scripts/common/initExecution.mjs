import fs from "fs";
import { decryptEnv } from "./common.mjs";

export async function initExecution({ logger, requireEnv = true } = {}) {

    const envPath = process.env.ENV_ENC_PATH;
    const passphrase = process.env.ENV_PASSPHRASE;

    // ✅ Case 1: ENV not provided
    if (!envPath) {
        if (requireEnv) {
            throw new Error("ENV_ENC_PATH missing");
        } else {
            logger?.("ℹ️ No ENV file provided (not required for this script)");
            return; // ✅ EXIT EARLY — nothing else runs
        }
    }

    // ✅ From here on, ENV is REQUIRED
    if (!passphrase) {
        throw new Error("ENV_PASSPHRASE missing");
    }

    // ✅ read file
    const encryptedBuffer = fs.readFileSync(envPath);

    // ✅ decrypt
    const decrypted = await decryptEnv(encryptedBuffer, passphrase);

    // ✅ inject env
    decrypted.split(/\r?\n/).forEach(line => {
        const [key, ...rest] = line.split("=");
        if (!key) return;

        process.env[key.trim()] = rest.join("=").trim();
    });

    logger?.("✅ Environment variables loaded from env.enc");
}