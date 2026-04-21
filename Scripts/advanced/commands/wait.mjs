// commands/wait.mjs
export async function waitCommand({ args }) {
    const ms = Number(args);

    if (Number.isNaN(ms) || ms < 0) {
        throw new Error(`Invalid wait duration: ${args}`);
    }

    await new Promise(resolve => setTimeout(resolve, ms));
}
