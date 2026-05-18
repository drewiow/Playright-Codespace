export async function selectCommand({ args, page, log, rowIndex }) {
    const [selector, value] = args;

    if (!selector || !value) {
        log(`[Advanced] row ${rowIndex}: invalid select usage`);
        return;
    }

    log(`[Advanced] selecting ${value} in ${selector}`);

    try {
        await page.selectOption(selector, value);
    } catch (err) {
        log(`[Advanced] row ${rowIndex}: select failed (${err.message})`);
    }
}