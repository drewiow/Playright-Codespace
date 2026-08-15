export async function plan(text) {

    const plan = [];

    console.log("Input:", text);

    const odsCode =
        text.match(/[A-Z]{3,5}\d{2,3}/i)?.[0];

    console.log("ODS Found:", odsCode);

    if (odsCode) {
        plan.push({
            action: "editProvider",
            odsCode
        });
    }

    if (text.toLowerCase().includes('accredit')) {

        plan.push({
            action: 'accredit',
            serviceID: text.split(' ').pop()
        });

    }

    if (text.toLowerCase().includes("cdb")) {

        const remainingText =
            text.replace(odsCode ?? "", "");
        const numbers = remainingText.match(/\d+/g);
        const cdbNumber = numbers?.at(-1);

        plan.push({
            advancedAction: "update-cdb",
            variables: {
                CDB_NUMBER: cdbNumber
            }
        });
    }

    if (text.toLowerCase().includes("telephone")) {

        const remainingText =
            text.replace(odsCode ?? "", "");

        const phone =
            remainingText.match(
                /(?:\+?\d[\d\s()-]{6,15})/
            )?.[0]?.trim();

        console.log(`Planning telephone update for ${odsCode}: ${phone}`);
        plan.push({
            advancedAction: "change-telephone",
            variables: {
                TELEPHONE: phone
            }
        });
        console.log(`Generated plan: ${JSON.stringify(plan, null, 2)}`);
    }

    if (text.toLowerCase().includes("secure email")) {
        const email = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
        plan.push({
            advancedAction: "change-secure-email",
            variables: {
                SECURE_EMAIL: email
            }
        });

        console.log(`Generated plan: ${JSON.stringify(plan, null, 2)}`);
    }

    return plan;
}