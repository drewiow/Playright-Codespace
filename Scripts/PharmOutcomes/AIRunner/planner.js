export async function plan(text) {

    if (text.toLowerCase().includes('edit')) {

        return [
            {
                action: 'editProvider',
                odsCode: text.split(' ').pop()
            }
        ];
    }

    return [];
}