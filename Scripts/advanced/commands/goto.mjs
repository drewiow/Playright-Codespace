export async function gotoCommand({ args, page }) {
    const url = args?.trim();

    if (!url) {
        throw new Error("goto requires a URL or path");
    }

    // If relative, keep it relative (Playwright handles this fine
    // as long as you’re already on the target domain)
    await page.goto(url, {
        waitUntil: "domcontentloaded"
    });
}