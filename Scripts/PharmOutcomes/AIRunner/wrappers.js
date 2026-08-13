import * as helpers from '../../pharmoutcomes/helpers.mjs';
import { ADVANCED_ACTION_SETS } from "../../advanced/advancedActions.js";
import { findAdvancedAction } from "./advancedActionsLookup.js";
import { executeAdvancedSteps } from "../../advanced/executeAdvancedSteps.mjs";
import { parseAdvancedSteps } from "../../advanced/parseAdvancedSteps.mjs";

export async function editProviderAction(page, step) {

    return helpers.editProvider(
        page,
        step.odsCode
    );
}

export async function accreditAction(page, step) {

    return helpers.accredit(
        page,
        step.serviceID
    );
}

export async function executeAdvancedAction(
    page,
    actionId,
    variables = {}
) {

    const action = findAdvancedAction(actionId);

    if (!action) {
        throw new Error(
            `Unknown advanced action: ${actionId}`
        );
    }

    let stepsText = action.steps;

    for (const [key, value] of Object.entries(variables)) {

        stepsText = stepsText.replaceAll(
            `{{${key}}}`,
            String(value)
        );
    }

    console.log(
        `Executing advanced action: ${action.label}`
    );

    const resolvedSteps =
        parseAdvancedSteps(stepsText);

    await executeAdvancedSteps({
        steps: resolvedSteps,
        page,
        rowIndex: 1,
        log: console.log
    });
}