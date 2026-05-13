import fs from "fs";
import { decryptEnv } from "./common.mjs";

export async function initExecution({ logger }) {

    logger("🔧 initExecution starting");

    const envPath = process.env.ENV_ENC_PATH;
    const passphrase = process.env.ENV_PASSPHRASE;

    if (!envPath) throw new Error("ENV_ENC_PATH missing");
    if (!passphrase) throw new Error("ENV_PASSPHRASE missing");

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

    logger("🔍 ENV CHECK →");

    const debugEnv = {
        USERNAME: process.env.USERNAME,
        PASSWORD: process.env.PASSWORD ? "****" : undefined,
        SECRET_KEY: process.env.SECRET_KEY ? "****" : undefined,
        ODSCODE: process.env.ODSCODE
    };

    logger(debugEnv);

    logger("✅ Environment loaded");

}
