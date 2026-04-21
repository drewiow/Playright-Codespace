import { decryptEnv } from "../common/common.mjs";

let initialized = false;

export async function initExecution({ logger = console.log } = {}) {
    if (initialized) return;

    if (process.env.ENV_ENC_PATH) {
        if (!process.env.ENV_PASSPHRASE) {
            throw new Error("ENV_PASSPHRASE missing for provided ENV_ENC_PATH");
        }

        await decryptEnv(
            process.env.ENV_ENC_PATH,
            process.env.ENV_PASSPHRASE
        );
    }
    if (!process.env.USERNAME) throw new Error("USERNAME missing after decrypt");
    if (!process.env.PASSWORD) throw new Error("PASSWORD missing after decrypt");
    if (!process.env.SECRET_KEY) throw new Error("SECRET_KEY missing after decrypt");

    initialized = true;
}
