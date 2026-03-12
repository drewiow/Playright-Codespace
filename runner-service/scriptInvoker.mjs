// runner-service/scriptInvoker.mjs
import path from "path";

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

  logger(`▶️ Launching script: ${scriptPath}`);

  const { default: run } = await import(scriptPath);

  await run({ logger });

  logger("✅ Script finished");
}