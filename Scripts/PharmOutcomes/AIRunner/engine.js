import { actions } from './actions.js';

export async function executePlan(plan, page) {

    for (const step of plan) {

        console.log(`Running ${step.action}`);

        const fn = actions[step.action];

        if (!fn) {
            throw new Error(
                `Unknown action: ${step.action}`
            );
        }

        await fn(page, step);
    }
}