// runner-service/scriptInvoker.mjs
import path from "path";
import { pathToFileURL } from "url";
import fs from "fs";

export async function invokeScript(job) {
  const {
    productId,
    scriptId,
    envEncPath,
    passphrase,
    options,
    logger
  } = job;

  // 👇 CRITICAL: force headed browser
  process.env.CONFIG_HEADLESS = "false";
  process.env.CONFIG_HUMAN = options.human ? "true" : "false";
  process.env.ENV_ENC_PATH = envEncPath;
  process.env.ENV_PASSPHRASE = passphrase;

  const scriptPath = path.resolve(
  "../Scripts",
  productId,
  scriptId,
  "index.mjs"
);

if (!fs.existsSync(scriptPath)) {
  throw new Error(`Script not found on disk: ${scriptPath}`);
}

logger(`▶️ Launching script: ${scriptPath}`);

const scriptUrl = pathToFileURL(scriptPath).href;
const { default: run } = await import(scriptUrl);

await run({ logger });

  logger("✅ Script finished");
}