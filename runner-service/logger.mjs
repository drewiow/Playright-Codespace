// runner-service/logger.mjs
export function createLogger(jobId) {
  return (...args) => {
    console.log(`[JOB ${jobId}]`, ...args);
  };
}