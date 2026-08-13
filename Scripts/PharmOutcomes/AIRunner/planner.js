export async function plan(text) {

    if (text.toLowerCase().includes('edit')) {

        return [
            {
                action: 'editProvider',
                odsCode: text.split(' ').pop()
            }
        ];
    }

    if (text.toLowerCase().includes('accredit')) {

        return [
            {
                action: 'accredit',
                serviceID: text.split(' ').pop()
            }
        ];
    }

    if (text.toLowerCase().includes("cdb")) {

        const odsMatch = text.match(/\b[A-Z0-9]{5}\b/i);
        const numbers = text.match(/\d+/g);
        const cdbNumber = numbers?.at(-1);

        console.log(
            `Planning advanced action for ODS: ${odsMatch?.[0]}, CDB: ${cdbNumber}`
        );

        return [
            {
                action: "editProvider",
                odsCode: odsMatch?.[0]
            },
            {
                advancedAction: "update-cdb",
                variables: {
                    CDB_NUMBER: cdbNumber
                }
            }
        ];
    }

    return [];
}