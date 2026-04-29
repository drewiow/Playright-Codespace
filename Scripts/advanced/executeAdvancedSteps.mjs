import { clickCommand } from "./commands/click.mjs";
import { typeCommand } from "./commands/type.mjs";
import { waitCommand } from "./commands/wait.mjs";
import { pressCommand } from "./commands/press.mjs";
import { gotoCommand } from "./commands/goto.mjs";

const commandHandlers = {
    click: clickCommand,
    press: pressCommand,
    goto: gotoCommand,
    type: typeCommand,
    wait: waitCommand,
    key: pressCommand, // alias for press
};

export async function executeAdvancedSteps({ steps, page, rowIndex, log }) {
    if (!Array.isArray(steps) || steps.length === 0) {
        return;
    }

    log(`[Advanced] row ${rowIndex}: starting`);

    for (const step of steps) {
        const { command, args, raw } = step;
        const DRY_RUN = process.env.DRY_RUN === "true";
        const isGuarded = step.raw.trim().startsWith("guard ");

        log(`[Advanced] row ${rowIndex}: ${raw}`);

        try {
            if (DRY_RUN) {
                log(`[DRY RUN] Would execute: ${step.action} ${step.selector || ""} ${step.value || ""}`);
                continue;
            }
            const handler = commandHandlers[command];

            if (!handler) {
                log(
                    `[Advanced] row ${rowIndex}: unknown command "${raw}" (skipped)`
                );
                continue;
            }

            await handler({ args, page, log, rowIndex });
        } catch (err) {
            log(
                `[Advanced] row ${rowIndex}: FAILED "${raw}" (${err.message})`
            );
            // log + continue by design
        }
    }

    log(`[Advanced] row ${rowIndex}: finished`);
}
