export async function typeCommand({ args, page, log, rowIndex }) {
    const [selector, ...rest] = args;
    const value = rest.join(" ");

    if (!selector || !value) {
        log(`[Advanced] row ${rowIndex}: type requires selector and value`);
        return;
    }

    log(`[Advanced] typing "${value}" into ${selector}`);

    try {
        await page.fill(selector, value);
    } catch (err) {
        log(`[Advanced] row ${rowIndex}: FAILED "${selector}" (${err.message})`);
    }
}