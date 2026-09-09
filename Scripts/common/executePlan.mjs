import * as helpers from "../pharmoutcomes/helpers.mjs";
import { executeAdvancedAction } from "../advanced/executeAdvancedAction.mjs";

export async function executePlan(
    page,
    plan,
    logger
) {

    for (const step of plan) {

        logger(
            `⚙️ ${step.action ?? step.advancedAction}`
        );

        if (step.action === "openUser") {

            await helpers.openUser(
                page,
                step.user.uid,
                logger
            );

            continue;
        }

        if (step.advancedAction) {

            await executeAdvancedAction(
                page,
                step.advancedAction,
                step.variables ?? {}
            );

            continue;
        }

        throw new Error(
            `Unknown step: ${JSON.stringify(step)
            }`
        );
    }
}