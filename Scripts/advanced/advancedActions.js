export const ADVANCED_ACTION_SETS = {
    default: [
        {
            group: "Navigation",
            actions: [
                { id: "save", label: "Save", steps: `click [value="Save"]` }
            ]
        }
    ],
    adjustmentDetails: [
        {
            group: "Mode",
            actions: [
                {
                    id: "enable-manual",
                    label: "Enable Manual Entry",
                    steps: `click #manual
wait 200`
                },
                {
                    id: "reset-form",
                    label: "Reset Form",
                    steps: `click #reset`
                }
            ]
        },

        {
            group: "Selections",
            actions: [
                {
                    id: "select-service",
                    label: "Select Service",
                    steps: `select #inService {{SERVICE}}`
                },
                {
                    id: "select-provider",
                    label: "Select Provider",
                    steps: `select #inProvider {{PROVIDER}}`
                },
                {
                    id: "select-date-auto",
                    label: "Select Date (Auto)",
                    steps: `select #inDateAuto {{DATE}}`
                },
                {
                    id: "select-funding",
                    label: "Select Invoice Details",
                    steps: `select #inServiceFunding {{FUNDING}}`
                }
            ]
        },

        {
            group: "Manual Date",
            actions: [
                {
                    id: "enable-manual-date",
                    label: "Enable Manual Date Entry",
                    steps: `click #inDateFully
wait 100`
                },
                {
                    id: "enter-manual-date",
                    label: "Enter Manual Date",
                    steps: `type #inDateManual {{DATE_MANUAL}}`
                }
            ]
        },

        {
            group: "Amounts",
            actions: [
                {
                    id: "set-all-amounts",
                    label: "Set All Adjustment Amounts",
                    steps: `type .adjustmentAmountInput {{AMOUNT}}`
                },
                {
                    id: "set-first-amount",
                    label: "Set First Adjustment Amount",
                    steps: `type .adjustmentAmountInput:first-of-type {{AMOUNT}}`
                },
                {
                    id: "set-specific-amount",
                    label: "Set Specific Amount (by ID)",
                    steps: `type #inAmount-{{FUNDING_ID}} {{AMOUNT}}`
                }
            ]
        },

        {
            group: "Description",
            actions: [
                {
                    id: "enter-description",
                    label: "Enter Description",
                    steps: `type #inDescription {{DESCRIPTION}}`
                }
            ]
        },

        {
            group: "Actions",
            actions: [
                {
                    id: "save-adjustment",
                    label: "Save Adjustment",
                    steps: `click #submit`
                },
                {
                    id: "save-and-new",
                    label: "Save & Create Another",
                    steps: `click #save`
                }
            ]
        }
    ],

    providerDetails: [
        {
            group: "Fields",
            actions: [
                { id: "update-orgname", label: "Update Organisation Name", steps: `type #inOrganisationName {{ORGANISATION_NAME}}` },
                { id: "update-identifier", label: "Update Identifier", steps: `type #inOrganisationIdentifier {{ORGANISATION_IDENTIFIER}}` },
                { id: "update-branchNumber", label: "Update Branch Number", steps: `type #inBranch {{BRANCH_NUMBER}}` },
                { id: "update-address", label: "Update Address", steps: `type #inAddress {{ADDRESS}}` },
                { id: "update-cdb", label: "Update CDB Number", steps: `type #inCDBNumber {{CDB_NUMBER}}` },
                { id: "change-ods", label: "Update ODS Code", steps: `type #inNHSCode {{ODS_CODE}}` },
                { id: "change-telephone", label: "Update Telephone", steps: `type #inOrgTelephone {{TELEPHONE}}` },
                { id: "change-secure-email", label: "Update Secure Email", steps: `type #inSecureEmail {{SECURE_EMAIL}}` },
                { id: "change-inAccountRef", label: "Update Account Reference", steps: `type #inAccountRef {{ACCOUNT_REF}}` },
                {
                    id: "update-mesh",
                    label: "Update Covid MESH Details",
                    steps: `click text="[+] MESH Mailbox settings"
wait 300
type input[name="inMESHMailboxIDs[]"]:first-of-type {{MESH_USERNAME}}
wait 150
type input[name="inMESHMailboxPasswords[]"]:first-of-type {{MESH_PASSWORD}}`
                }
            ]
        },
        {
            group: "Navigation",
            actions: [
                { id: "save-provider", label: "Save Provider", steps: `click [value="Save"]` }
            ]
        }
    ]
};