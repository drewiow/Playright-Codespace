export const ADVANCED_ACTION_SETS = {
    default: [
        {
            group: "Navigation",
            actions: [
                { id: "save", label: "Save", steps: `click [value="Save"]` }
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
                    ],
                    buildPlan(collected) {

                        return [
                            {
                                action: "findUser",
                                username: collected.username
                            },
                            {
                                advancedAction: "reset-mfa"
                            },
                            {
                                advancedAction: "save-user"
                            }
                        ];
                    }
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
            ],
        }, {
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
                    ],

                    buildPlan(collected) {
                        return [
                            {
                                action: "editProvider",
                                odsCode: collected.odsCode
                            },
                            {
                                advancedAction: "change-telephone",
                                variables: {
                                    TELEPHONE: collected.telephone
                                }
                            },
                            {
                                advancedAction: "save-provider"
                            }
                        ];
                    }
                },
                {
                    id: "change-secure-email",
                    icon: "📧",
                    label: "Update Secure Email",
                    steps: `type #inSecureEmail {{SECURE_EMAIL}}`,
                    questions: [
                        {
                            field: "odsCode",
                            prompt: "Which provider?"
                        },
                        {
                            field: "email",
                            prompt: "What is the new email address?"
                        }
                    ],

                    buildPlan(collected) {
                        return [
                            {
                                action: "editProvider",
                                odsCode: collected.odsCode
                            },
                            {
                                advancedAction: "change-secure-email",
                                variables: {
                                    SECURE_EMAIL: collected.email
                                }
                            },
                            {
                                advancedAction: "save-provider"
                            }
                        ];
                    }
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

export function findAction(actionId) {

    for (const page of Object.values(ADVANCED_ACTION_SETS)) {

        for (const group of page) {

            const action =
                group.actions.find(
                    x => x.id === actionId
                );

            if (action) {
                return action;
            }
        }
    }

    return null;
}