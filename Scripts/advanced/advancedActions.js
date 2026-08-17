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
    userDetails: [
        {
            group: "Security",
            actions: [
                {
                    id: "reset-mfa",
                    icon: "🔐",
                    label: "Reset MFA",
                    steps: `check #inResetMFASecret`,
                    questions: [
                        {
                            field: "username",
                            prompt:
                                "What is the user's name?"
                        }
                    ]
                },
                {
                    id: "reset-password",
                    icon: "🔒",
                    label: "Reset Password",
                    steps: `check #inResetPassword`
                },
                {
                    id: "reset-passcode",
                    icon: "🔑",
                    label: "Reset Passcode",
                    steps: `check #inResetPasscode`
                }
            ]
        }
    ], userDetails: [
        {
            group: "Identity",
            actions: [
                {
                    id: "update-username",
                    icon: "👤",
                    label: "Update Username",
                    steps: `type #inUserName {{USERNAME}}`
                },
                {
                    id: "update-fullname",
                    icon: "📛",
                    label: "Update Full Name",
                    steps: `type #inKnownName {{FULL_NAME}}`
                },
                {
                    id: "update-email",
                    icon: "📧",
                    label: "Update Email Address",
                    steps: `type #inContactEmail {{EMAIL}}`
                }
            ]
        },

        {
            group: "Contact Details",
            actions: [
                {
                    id: "update-phone",
                    icon: "📞",
                    label: "Update Phone Number",
                    steps: `type #inContactPhone {{PHONE}}`
                },
                {
                    id: "update-mobile",
                    icon: "📱",
                    label: "Update Mobile Number",
                    steps: `type #inContactMobile {{MOBILE}}`
                },
                {
                    id: "update-job-title",
                    icon: "💼",
                    label: "Update Job Title",
                    steps: `type #inJobTitle {{JOB_TITLE}}`
                }
            ]
        },

        {
            group: "Professional",
            actions: [
                {
                    id: "update-professional-body",
                    icon: "🏥",
                    label: "Update Professional Body",
                    steps: `select #inGPCProfessionalBody {{PROFESSIONAL_BODY}}`
                },
                {
                    id: "update-registration-number",
                    icon: "🪪",
                    label: "Update Registration Number",
                    steps: `type #inGPCRegistration {{REGISTRATION_NUMBER}}`
                }
            ]
        },

        {
            group: "Account",
            actions: [
                {
                    id: "disable-user",
                    icon: "⛔",
                    label: "Disable User",
                    steps: `
type #inDisabled {{DISABLE_REASON}}
click input[name="update"][value="Save"]
`
                },
                {
                    id: "enable-user",
                    icon: "✅",
                    label: "Enable User",
                    steps: `
type #inDisabled
click input[name="update"][value="Save"]
`
                }
            ]
        },
        {
            group: "Administration",
            actions: [
                {
                    id: "enable-cross-login",
                    icon: "🔄",
                    label: "Enable Cross Login",
                    steps: `check #inCrossLogin`
                },
                {
                    id: "set-password",
                    icon: "🛡️",
                    label: "Set Password",
                    steps: `
                    type #inNewPassword {{PASSWORD}}
                    type #inRetypePassword {{PASSWORD}}`
                },
                {
                    id: "set-security-word",
                    icon: "🔐",
                    label: "Set Security Word",
                    steps: `type #inNewPasscode {{SECURITY_WORD}}`
                }
            ]
        },

        {
            group: "Navigation",
            actions: [
                {
                    id: "save-user",
                    icon: "💾",
                    label: "Save User",
                    steps: `click input[name="update"][value="Save"]`
                }
            ]
        }
    ]
    ,
    providerDetails: [
        {
            group: "Fields",
            actions: [
                {
                    id: "update-orgname",
                    icon: "🏢",
                    label: "Update Organisation Name",
                    steps: `type #inOrganisationName {{ORGANISATION_NAME}}`
                },
                {
                    id: "update-identifier",
                    icon: "🆔",
                    label: "Update Identifier",
                    steps: `type #inOrganisationIdentifier {{ORGANISATION_IDENTIFIER}}`
                },
                {
                    id: "update-branchNumber",
                    icon: "🌿",
                    label: "Update Branch Number",
                    steps: `type #inBranch {{BRANCH_NUMBER}}`
                },
                {
                    id: "update-address",
                    icon: "📍",
                    label: "Update Address",
                    steps: `type #inAddress {{ADDRESS}}`
                },
                {
                    id: "update-cdb",
                    icon: "🔢",
                    label: "Update CDB Number",
                    steps: `type #inCDBNumber {{CDB_NUMBER}}`
                },
                {
                    id: "change-ods",
                    icon: "🏷️",
                    label: "Update ODS Code",
                    steps: `type #inNHSCode {{ODS_CODE}}`
                },
                {
                    id: "change-telephone",
                    icon: "📞",
                    label: "Update Telephone",
                    steps: `type #inOrgTelephone {{TELEPHONE}}`,
                    questions: [
                        {
                            field: "odsCode",
                            prompt:
                                "Which provider?"
                        },
                        {
                            field: "telephone",
                            prompt:
                                "What is the new telephone number?"
                        }
                    ]
                },
                {
                    id: "change-secure-email",
                    icon: "📧",
                    label: "Update Secure Email",
                    steps: `type #inSecureEmail {{SECURE_EMAIL}}`
                },
                {
                    id: "change-inAccountRef",
                    icon: "💳",
                    label: "Update Account Reference",
                    steps: `type #inAccountRef {{ACCOUNT_REF}}`
                },

                {
                    id: "update-mesh",
                    icon: "💳",
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