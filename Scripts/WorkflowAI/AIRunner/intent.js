import { ADVANCED_ACTION_SETS } from "../../advanced/advancedActions.js";

export async function intent(text) {

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

        return {
            type: "collect-info",
            action: "change-telephone"

        }
    }

    if (text.toLowerCase().includes("secure email")) {
        const email = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];

        return {
            type: "collect-info",
            action: "change-secure-email"

        }
    }


    if (text.toLowerCase().includes("mfa") && text.toLowerCase().includes("reset")) {

        return {
            type: "collect-info",
            action: "reset-mfa"
        };
    }

    if (text.toLowerCase().includes("password")) {

        return {
            type: "collect-info",
            action: "reset-password"
        };
    }

    if (text.toLowerCase().includes("passcode") || text.toLowerCase().includes("security")) {

        return {
            type: "collect-info",
            action: "reset-passcode"
        };
    }

    console.log(
        "Returning plan:",
        JSON.stringify(plan, null, 2)
    );

    if (plan.length === 0) {

        return {
            type: "unknown-intent",
            message: text,
            suggestions: getSuggestedActions(text)
        };

    }
    return plan;
}

function getSuggestedActions(text) {

    const words =
        text.toLowerCase()
            .split(/\s+/);

    return Object
        .values(ADVANCED_ACTION_SETS)
        .flatMap(page => page)
        .flatMap(group => group.actions)
        .filter(group =>
            group.group !== "Navigation"
        )
        .map(action => ({

            action,

            score: words.filter(
                word =>
                    action.label
                        .toLowerCase()
                        .includes(word)
            ).length

        }))
        .sort(
            (a, b) =>
                b.score - a.score
        )
        .slice(0, 5)
        .map(x => x.action);

}