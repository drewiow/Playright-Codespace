function buildUsername(
    text,
    wordsToRemove = []
) {

    let username = text;

    for (const word of wordsToRemove) {

        username =
            username.replace(
                new RegExp(word, "ig"),
                ""
            );

    }

    return username
        .replace(/'s$/i, "")
        .replace(/\?/g, "")
        .trim();
}

export async function plan(text) {

    const plan = [];

    console.log("Input:", text);

    const odsCode =
        text.match(/[A-Z]{3,5}\d{2,3}/i)?.[0];

    if (odsCode) {
        plan.push({
            action: "editProvider",
            odsCode
        });
    }

    if (text.toLowerCase().includes('accredit')) {
        plan.push({ action: 'accredit', serviceID: text.split(' ').pop() });
        plan.push({ advancedAction: "save-provider" });
    }

    if (text.toLowerCase().includes("cdb")) {

        const remainingText = text.replace(odsCode ?? "", "");
        const numbers = remainingText.match(/\d+/g);
        const cdbNumber = numbers?.at(-1);

        plan.push({
            advancedAction: "update-cdb",
            variables: {
                CDB_NUMBER: cdbNumber
            }
        });
        plan.push({ advancedAction: "save-provider" });
    }

    if (text.toLowerCase().includes("telephone")) {

        const remainingText = text.replace(odsCode ?? "", "");

        const phone =
            remainingText.match(
                /(?:\+?\d[\d\s()-]{6,15})/
            )?.[0]?.trim();

        plan.push({ advancedAction: "change-telephone", variables: { TELEPHONE: phone } });
        plan.push({ advancedAction: "save-provider" });
    }

    if (text.toLowerCase().includes("secure email")) {
        const email = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
        plan.push({ advancedAction: "change-secure-email", variables: { SECURE_EMAIL: email } });
        plan.push({ advancedAction: "save-provider" });
    }


    if (text.toLowerCase().includes("mfa") && text.toLowerCase().includes("reset")) {

        const username =
            buildUsername(
                text,
                ["reset", "mfa"]
            );

        if (!username) {

            return {
                type: "collect-info",
                action: "reset-mfa",
                question: "What is the user's name?"
            };
        }

        plan.push({
            action: "findUser",
            username
        });

        plan.push({
            advancedAction: "reset-mfa"
        });

        plan.push({
            advancedAction: "save-user"
        });
    }

    if (text.toLowerCase().includes("password")) {

        let username = buildUsername(text, ["reset", "password", "i need to", "can you", "?"]);

        plan.push({ action: "findUser", username });
        plan.push({ advancedAction: "reset-Password" });
        plan.push({ advancedAction: "save-user" });

    }

    if (text.toLowerCase().includes("passcode") || text.toLowerCase().includes("security")) {

        let username = buildUsername(text, ["reset", "passcode", "security", "need to", "can you"]);

        plan.push({ action: "findUser", username });
        plan.push({ advancedAction: "reset-Password" });
        plan.push({ advancedAction: "save-user" });

    }

    console.log(
        "Returning plan:",
        JSON.stringify(plan, null, 2)
    );

    return plan;
}