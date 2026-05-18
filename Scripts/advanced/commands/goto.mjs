export async function gotoCommand({ args, page, log, rowIndex }) {
    const url = args.join(" ").replace(/&amp;/g, "&"); // ✅ FIX

    if (!url) {
        log?.(`[Advanced] row ${rowIndex}: invalid goto usage`);
        return;
    }

    log?.(`[Advanced] navigating to ${url}`);

    await page.goto(url, { waitUntil: "networkidle" });
}
``