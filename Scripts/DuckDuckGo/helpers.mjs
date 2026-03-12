import { decryptEnv, createBrowserContext } from "../common/common.mjs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Decrypt env.enc using ENV_ENC_PATH + ENV_PASSPHRASE
export async function setupContext(options = {}) {

  return await createBrowserContext(options);
}


