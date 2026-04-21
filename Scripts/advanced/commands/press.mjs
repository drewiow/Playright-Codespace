export async function pressCommand({ args, page }) {
    const key = args.join(" ");

    if (!key) {
        throw new Error("press requires a key");
    }

    await page.keyboard.press(key);
}