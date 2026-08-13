import { actions } from './actions.js';
import { executeAdvancedAction } from './wrappers.js';

export async function executePlan(plan, page) {

    for (const step of plan) {

        if (step.action) {

            const fn = actions[step.action];

            if (!fn) {
                throw new Error(
                    `Unknown action: ${step.action}`
                );
            }

            await fn(page, step);

            continue;
        }

        if (step.advancedAction) {

            console.log(
                `[Engine] Executing advanced action: ${step.advancedAction}`
            );
            await executeAdvancedAction(
                page,
                step.advancedAction,
                step.variables
            );

            continue;
        }

        throw new Error(
            `Unknown plan step: ${JSON.stringify(step)}`
        );
    }
}