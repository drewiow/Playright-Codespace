export async function clickCommand({ args, page, log, rowIndex }) {
    const selector = args.join(" "); // ✅ FIX

    if (!selector) {
        log(`[Advanced] row ${rowIndex}: click requires selector`);
        return;
    }

    log(`[Advanced] clicking ${selector}`);

    try {
        await page.click(selector);
    } catch (err) {
        log(`[Advanced] row ${rowIndex}: FAILED "${selector}" (${err.message})`);
    }
}