export async function checkCommand({
    args,
    page
}) {

    await page.check(args[0]);

}