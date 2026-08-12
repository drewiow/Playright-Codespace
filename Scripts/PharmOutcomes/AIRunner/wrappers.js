import * as helpers from '../helpers.mjs';

export async function editProviderAction(page, step) {

    return helpers.editProvider(
        page,
        step.odsCode
    );
}