
function findAdvancedAction(id) {

    return Object
        .values(ADVANCED_ACTION_SETS)
        .flatMap(set => set)
        .flatMap(group => group.actions)
        .find(action => action.id === id);

}
export function convertToWorkflow(plan) {

    return plan.map(step => {

        if (step.action === "openUser") {

            return {
                icon: "👤",
                text:
                    `Open User ${step.user.displayName}`
            };

        }
        if (
            step.action === "editProvider"
        ) {

            return {
                icon: "🏥",
                text: `Open Provider ${step.odsCode}`
            };
        }

        if (step.action === "findUser") {

            return {
                icon: "👤",
                text: `Find User ${step.username}`
            };
        }

        if (step.action === "resetMfa") {

            return {
                icon: "🔐",
                text: "Reset MFA"
            };
        }

        if (step.action === "resetPasscode") {
            return {
                icon: "🔑",
                text: "Reset Passcode"
            };
        }

        if (step.action === "resetPassword") {
            return {
                icon: "🔒",
                text: "Reset Password"
            };
        }
        if (step.advancedAction) {

            const action = findAdvancedAction(step.advancedAction);
            let text = action?.label ?? step.advancedAction;
            if (step.variables?.TELEPHONE) {
                text += ` to ${step.variables.TELEPHONE}`;
            }
            if (
                step.variables?.SECURE_EMAIL
            ) {
                text += ` to ${step.variables.SECURE_EMAIL}`;
            }

            if (
                step.variables?.CDB_NUMBER
            ) {
                text += ` to ${step.variables.CDB_NUMBER}`;
            }

            return {
                icon: action?.icon ?? "⚙️",
                text: text
            };
        }

        return {
            icon: "⚙️",
            text: step.action ?? step.advancedAction
        };

    });
}