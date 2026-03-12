// runner-service/jobManager.mjs
import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { invokeScript } from "./scriptInvoker.mjs";
import { createLogger } from "./logger.mjs";

const JOB_ROOT = path.resolve(".runner-jobs");
if (!fs.existsSync(JOB_ROOT)) fs.mkdirSync(JOB_ROOT);

export async function createJob(payload) {

    console.log("DEBUG typeof envEncBase64:", typeof payload.envEncBase64);
    console.log("DEBUG envEncBase64 constructor:", payload.envEncBase64?.constructor?.name);

  const {
    productId,
    scriptId,
    envEncBase64,
    passphrase,
    options = {}
  } = payload;

  if (!productId || !scriptId) {
    throw new Error("Missing productId or scriptId");
  }

  const id = uuid();
  const jobDir = path.join(JOB_ROOT, id);
  fs.mkdirSync(jobDir);

  const envEncPath = path.join(jobDir, "env.enc");
  fs.writeFileSync(envEncPath, Buffer.from(envEncBase64, "base64"));

  return {
    id,
    productId,
    scriptId,
    envEncPath,
    passphrase,
    options,
    logger: createLogger(id),
  };
}

export async function runJob(job) {
  try {
    await invokeScript(job);
  } catch (err) {
    job.logger("❌ Job failed:", err.stack || err);
  }
}
``