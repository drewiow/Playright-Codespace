export async function selectCommand({ args, page, log, rowIndex }) {
    const [selector, value] = args;

    if (!selector || !value) {
        log(`[Advanced] row ${rowIndex}: invalid select usage`);
        return;
    }

    log(`[Advanced] selecting ${value} in ${selector}`);

    try {
        const [selector, value] = args;

        const options = await page.$$(`${selector} option`);

        let matchedValue = null;

        for (const option of options) {
            const text = (await option.textContent())?.trim();
            const val = await option.getAttribute("value");

            if (
                val === value ||                          // exact value match
                text === value ||                         // exact text match
                text?.toLowerCase().includes(value.toLowerCase()) // ✅ partial match
            ) {
                matchedValue = val;
                break;
            }
        }

        if (!matchedValue) {
            throw new Error(`Option not found for: ${value}`);
        }

        await page.selectOption(selector, matchedValue);

    } catch (err) {
        log(`[Advanced] row ${rowIndex}: select failed (${err.message})`);
    }
}