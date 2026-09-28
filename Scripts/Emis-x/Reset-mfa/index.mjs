import { runScript } from "../../common/runScript.mjs";
import { resetMfa, } from "../helpers.mjs";

export default async function run() {
  await runScript({
    async main({ page, logger, username, password }) {

      // ✅ HARD RESET

      const email = process.env.EMAIL;
      await resetMfa(page, username, password, email, logger);

    }
  });
}
run().catch(err => {
  console.error("Script failed:", err?.stack || err);
  process.exit(1);
});