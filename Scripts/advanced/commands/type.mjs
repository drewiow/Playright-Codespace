// commands/type.mjs
export async function typeCommand({ args, page }) {
    const firstSpace = args.indexOf(" ");

    if (firstSpace === -1) {
        throw new Error("type requires selector and value");
    }

    const selector = args.slice(0, firstSpace);
    const value = args.slice(firstSpace + 1);

    await page.fill(selector, value);
}
``