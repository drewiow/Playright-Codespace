import { ADVANCED_ACTION_SETS } from "../../common/advancedActions.js";

export function findAdvancedAction(actionId) {

    const actions =
        Object.values(ADVANCED_ACTION_SETS)
            .flat()
            .flatMap(group => group.actions);

    return actions.find(
        x => x.id === actionId
    );
}