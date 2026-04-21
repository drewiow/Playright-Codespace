
export async function clickCommand({ args, page }) {
    const selector = args;

    if (!selector) {
        throw new Error("missing selector");
    }

    // Playwright auto-waits for element to be attached + actionable
    await page.click(selector, {
        timeout: 5000
    });
}
