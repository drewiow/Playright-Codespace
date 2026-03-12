import { fileURLToPath } from "url";
import path from "path";
import process from "process";

import { login, editProvider, setupContext } from "../helpers.mjs";
import { decryptEnv } from "../../common/common.mjs";

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

  // 🔐 decrypt env.enc
  try {
    logger("🔐 decryptEnv starting...");
    await decryptEnv(process.env.ENV_ENC_PATH, process.env.ENV_PASSPHRASE);
    logger("🔐 decryptEnv complete");
  } catch (err) {
    logger("❌ decryptEnv failed:", err?.stack || err);
    throw err;
  }

  // 🔥 Dynamic input from meta.json → environment variable

  console.log("ENV ODSCODE =", process.env.ODSCODE);
  console.log("ENV odsCode =", process.env.odsCode);
  const odsCode = process.env.ODSCODE;

  if (!odsCode) {
    throw new Error("Missing ODSCODE (dynamic input 'odsCode')");
  }

  const username = process.env.USERNAME;
  const password = process.env.PASSWORD;

  if (!username) throw new Error("Missing USERNAME");
  if (!password) throw new Error("Missing PASSWORD");

  let browser = null;
  let context = null;
  let page = null;

  try {
    logger("🔧 setupContext starting");
    ({ browser, context, page } = await setupContext({
      headless: process.env.CONFIG_HEADLESS === "true",
      human: process.env.CONFIG_HUMAN === "true"
    }));
    logger("✅ Browser/context/page created");

    logger(`➡️ Logging into provider ${odsCode}...`);
    await login(page, username, password, odsCode);
    logger(`✅ Logged into ${odsCode}`);

    logger("➡️ Editing provider...");
    await editProvider(page, odsCode);
    logger("✅ Provider edit complete");

    logger("🕒 Browser will remain open...");
    await new Promise(() => { }); // keep alive

  } catch (err) {
    logger("❌ Run error:", err?.stack || err);
    throw err;

  } finally {
    logger("__RUN_COMPLETE__");
  }
}

run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});