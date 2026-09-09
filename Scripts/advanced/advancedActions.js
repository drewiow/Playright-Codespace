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
                    description: "Reset MFA registration for a user",
                    category: "Security",
                    keywords: [
                        "mfa",
                        "2fa",
                        "multi factor authentication",
                        "multi-factor authentication",
                        "authenticator",
                        "microsoft authenticator",
                        "reset mfa",
                        "reset authentication",
                        "authentication issue",
                        "can't use authenticator",
                        "new phone",
                        "lost phone"
                    ],
                    steps: `check #inResetMFASecret`
                },
                {
                    id: "reset-password",
                    icon: "🔒",
                    label: "Reset Password",
                    steps: `check #inResetPassword`,
                    description: "Reset a user's account password.",
                    category: "Security",
                    keywords: [
                        "password",
                        "reset password",
                        "forgot password",
                        "change password",
                        "password issue",
                        "can't login",
                        "unable to login",
                        "credential reset"
                    ]
                },
                {
                    id: "reset-passcode",
                    icon: "🔑",
                    label: "Reset Passcode",
                    description: "Reset a user's security passcode.",
                    category: "Security",
                    keywords: [
                        "passcode",
                        "security word",
                        "security code",
                        "reset passcode",
                        "forgot passcode",
                        "reset security code",
                        "authentication code"
                    ],
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
                    description: "Update a user's username.",
                    category: "Identity",
                    keywords: [
                        "username",
                        "user name",
                        "change username",
                        "update username",
                        "rename user",
                        "login name",
                        "account name",
                        "change login",
                        "new username"
                    ],
                    steps: `type #inUserName {{USERNAME}}`,
                    questions: [
                        {
                            field: "username",
                            prompt:
                                "What is the user's name?"
                        },
                        {
                            field: "newUsername",
                            prompt:
                                "What is the new username?"
                        }
                    ],
                    buildPlan(collected) {

                        return [
                            {
                                action: "findUser",
                                username: collected.username
                            },
                            {
                                advancedAction: "update-username",
                                variables: {
                                    USERNAME: collected.newUsername
                                }
                            },
                            {
                                advancedAction: "save-user"
                            }
                        ];
                    }
                },
                {
                    id: "update-fullName",
                    icon: "📛",
                    label: "Update Full Name",
                    description: "Update a user's full name.",
                    category: "Identity",
                    keywords: [
                        "full name",
                        "name",
                        "change name",
                        "update name",
                        "rename user",
                        "known name",
                        "display name",
                        "correct name",
                        "user details"
                    ],
                    steps: `type #inKnownName {{FULLNAME}}`,
                    questions: [
                        {
                            field: "username",
                            prompt:
                                "What is the user's name?"
                        },
                        {
                            field: "fullName",
                            prompt:
                                "What is their new full name?"
                        }
                    ],
                    buildPlan(collected) {

                        return [
                            {
                                action: "findUser",
                                username: collected.username
                            },
                            {
                                advancedAction: "update-fullName",
                                variables: {
                                    FULLNAME: collected.fullName
                                }
                            },
                            {
                                advancedAction: "save-user"
                            }
                        ];
                    }
                },
                {
                    id: "update-email",
                    icon: "📧",
                    label: "Update Email Address",
                    description: "Update a user's email address.",
                    category: "Identity",
                    keywords: [
                        "email",
                        "email address",
                        "change email",
                        "update email",
                        "new email",
                        "contact email",
                        "email change",
                        "incorrect email",
                        "user email"
                    ],
                    steps: `type #inContactEmail {{EMAIL}}`,
                    questions: [
                        {
                            field: "username",
                            prompt:
                                "What is the user's name?"
                        },
                        {
                            field: "email",
                            prompt:
                                "What is the new email address?"
                        }
                    ],
                    buildPlan(collected) {

                        return [
                            {
                                action: "findUser",
                                username: collected.username
                            },
                            {
                                advancedAction: "update-email",
                                variables: {
                                    EMAIL: collected.email
                                }
                            },
                            {
                                advancedAction: "save-user"
                            }
                        ];
                    }
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
                    description: "Update a user's telephone number.",
                    category: "Contact Details",
                    keywords: [
                        "phone",
                        "telephone",
                        "phone number",
                        "contact number",
                        "landline",
                        "change phone",
                        "update phone",
                        "change telephone",
                        "contact details"
                    ],
                    steps: `type #inContactPhone {{PHONE}}`,
                    questions: [
                        {
                            field: "username",
                            prompt:
                                "What is the user's name?"
                        },
                        {
                            field: "phone",
                            prompt:
                                "What is the new phone number?"
                        }
                    ],
                    buildPlan(collected) {

                        return [
                            {
                                action: "findUser",
                                username: collected.username
                            },
                            {
                                advancedAction: "update-phone",
                                variables: {
                                    PHONE: collected.phone
                                }
                            },
                            {
                                advancedAction: "save-user"
                            }
                        ];
                    }
                },
                {
                    id: "update-mobile",
                    icon: "📱",
                    label: "Update Mobile Number",
                    description: "Update a user's mobile telephone number.",
                    category: "Contact Details",
                    keywords: [
                        "mobile",
                        "mobile number",
                        "cell phone",
                        "mobile phone",
                        "change mobile",
                        "update mobile",
                        "contact number",
                        "mobile details",
                        "new mobile"
                    ],
                    steps: `type #inContactMobile {{MOBILE}}`,
                    questions: [
                        {
                            field: "username",
                            prompt:
                                "What is the user's name?"
                        },
                        {
                            field: "mobile",
                            prompt:
                                "What is the new mobile number?"
                        }
                    ],
                    buildPlan(collected) {

                        return [
                            {
                                action: "findUser",
                                username: collected.username
                            },
                            {
                                advancedAction: "update-mobile",
                                variables: {
                                    MOBILE: collected.mobile
                                }
                            },
                            {
                                advancedAction: "save-user"
                            }
                        ];
                    }
                },

            ]
        },

        {
            group: "Professional",
            actions: [
                {
                    id: "update-job-title",
                    icon: "💼",
                    label: "Update Job Title",
                    description: "Update a user's job title.",
                    category: "Professional",
                    keywords: [
                        "job title",
                        "role",
                        "position",
                        "employment",
                        "change title",
                        "update title",
                        "job role",
                        "staff role",
                        "designation"
                    ],
                    steps: `type #inJobTitle {{JOB_TITLE}}`,
                    questions: [
                        {
                            field: "username",
                            prompt:
                                "What is the user's name?"
                        },
                        {
                            field: "jobTitle",
                            prompt:
                                "What is the new job title?"
                        }
                    ],
                    buildPlan(collected) {

                        return [
                            {
                                action: "findUser",
                                username: collected.username
                            },
                            {
                                advancedAction: "update-job-title",
                                variables: {
                                    JOB_TITLE: collected.jobTitle
                                }
                            },
                            {
                                advancedAction: "save-user"
                            }
                        ];
                    }
                },
                {
                    id: "update-professional-body",
                    icon: "🏥",
                    label: "Update Professional Body",
                    steps: `select #inGPCProfessionalBody {{PROFESSIONAL_BODY}}`,
                    questions: [
                        {
                            field: "username",
                            prompt:
                                "What is the user's name?"
                        },
                        {
                            field: "professionalBody",
                            prompt:
                                "What is the new professional body?"
                        }
                    ],
                    buildPlan(collected) {

                        return [
                            {
                                action: "findUser",
                                username: collected.username
                            },
                            {
                                advancedAction: "update-professional-body",
                                variables: {
                                    PROFESSIONAL_BODY: collected.professionalBody
                                }
                            },
                            {
                                advancedAction: "save-user"
                            }
                        ];
                    }
                },
                {
                    id: "update-registration-number",
                    icon: "🪪",
                    label: "Update Registration Number",
                    description: "Update a user's professional registration body.",
                    category: "Professional",
                    keywords: [
                        "professional body",
                        "registration body",
                        "governing body",
                        "professional registration",
                        "change professional body",
                        "update professional body",
                        "professional details",
                        "registration authority",
                        "regulatory body"
                    ],
                    steps: `type #inGPCRegistration {{REGISTRATION_NUMBER}}`,
                    questions: [
                        {
                            field: "username",
                            prompt:
                                "What is the user's name?"
                        },
                        {
                            field: "registrationNumber",
                            prompt:
                                "What is the new registration number?"
                        }
                    ],
                    buildPlan(collected) {

                        return [
                            {
                                action: "findUser",
                                username: collected.username
                            },
                            {
                                advancedAction: "update-registration-number",
                                variables: {
                                    REGISTRATION_NUMBER: collected.registrationNumber
                                }
                            },
                            {
                                advancedAction: "save-user"
                            }
                        ];
                    }
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
                    description: "Update a user's professional registration number.",
                    category: "Professional",
                    keywords: [
                        "registration number",
                        "professional registration",
                        "registration id",
                        "professional number",
                        "gphc",
                        "gdc",
                        "nmc",
                        "change registration number",
                        "update registration"
                    ],
                    steps: `type #inDisabled {{DISABLE_REASON}}`,
                    questions: [
                        {
                            field: "username",
                            prompt:
                                "What is the user's name?"
                        },
                        {
                            field: "disableReason",
                            prompt:
                                "What is the reason they are being disabled?"
                        }
                    ],
                    buildPlan(collected) {

                        return [
                            {
                                action: "findUser",
                                username: collected.username
                            },
                            {
                                advancedAction: "disable-user",
                                variables: {
                                    DISABLE_REASON: collected.disableReason
                                }
                            },
                            {
                                advancedAction: "save-user"
                            }
                        ];
                    }
                }
            ]
        },
        {
            group: "Administration",
            actions: [
                {
                    id: "set-password",
                    icon: "🛡️",
                    label: "Set Password",
                    description: "Set a new password for a user account.",
                    category: "Administration",
                    keywords: [
                        "set password",
                        "new password",
                        "change password",
                        "update password",
                        "password reset",
                        "password",
                        "credential",
                        "temporary password",
                        "set user password"
                    ],
                    steps: `
                    type #inNewPassword {{PASSWORD}}
                    type #inRetypePassword {{PASSWORD}}`,
                    questions: [
                        {
                            field: "username",
                            prompt:
                                "What is the user's name?"
                        },
                        {
                            field: "password",
                            prompt:
                                "What is the new password?"
                        }
                    ],
                    buildPlan(collected) {

                        return [
                            {
                                action: "findUser",
                                username: collected.username
                            },
                            {
                                advancedAction: "set-password",
                                variables: {
                                    PASSWORD: collected.password
                                }
                            },
                            {
                                advancedAction: "save-user"
                            }
                        ];
                    }
                },
                {
                    id: "set-security-word",
                    icon: "🔐",
                    label: "Set Security Word",
                    description: "Set or update a user's security word or passcode.",
                    category: "Administration",
                    keywords: [
                        "security word",
                        "passcode",
                        "security passcode",
                        "security code",
                        "change security word",
                        "update security word",
                        "set passcode",
                        "authentication word",
                        "security details"
                    ],
                    steps: `type #inNewPasscode {{SECURITY_WORD}}`,
                    questions: [
                        {
                            field: "username",
                            prompt:
                                "What is the user's name?"
                        },
                        {
                            field: "securityWord",
                            prompt:
                                "What is the new security word?"
                        }
                    ],
                    buildPlan(collected) {

                        return [
                            {
                                action: "findUser",
                                username: collected.username
                            },
                            {
                                advancedAction: "set-security-word",
                                variables: {
                                    SECURITY_WORD: collected.securityWord
                                }
                            },
                            {
                                advancedAction: "save-user"
                            }
                        ];
                    }

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
                    steps: `type #inOrganisationName {{ORGANISATION_NAME}}`,
                    questions: [
                        {
                            field: "odsCode",
                            prompt:
                                "What is the provider's ODS code?"
                        },
                        {
                            field: "organisationName",
                            prompt:
                                "What is the new name?"
                        }
                    ],

                    buildPlan(collected) {
                        return [
                            {
                                action: "editProvider",
                                odsCode: collected.odsCode
                            },
                            {
                                advancedAction: "update-orgname",
                                variables: {
                                    ORGANISATION_NAME: collected.organisationName
                                }
                            },
                            {
                                advancedAction: "save-provider"
                            }
                        ];
                    }
                },
                {
                    id: "update-identifier",
                    icon: "🆔",
                    label: "Update Identifier",
                    steps: `type #inOrganisationIdentifier {{ORGANISATION_IDENTIFIER}}`,
                    questions: [
                        {
                            field: "odsCode",
                            prompt:
                                "What is the provider's ODS code?"
                        },
                        {
                            field: "organisationIdentifier",
                            prompt:
                                "What is the new identifier?"
                        }
                    ],

                    buildPlan(collected) {
                        return [
                            {
                                action: "editProvider",
                                odsCode: collected.odsCode
                            },
                            {
                                advancedAction: "update-identifier",
                                variables: {
                                    ORGANISATION_IDENTIFIER: collected.organisationIdentifier
                                }
                            },
                            {
                                advancedAction: "save-provider"
                            }
                        ];
                    }
                },
                {
                    id: "update-branch-number",
                    icon: "🌿",
                    label: "Update Branch Number",
                    steps: `type #inBranch {{BRANCH_NUMBER}}`,
                    questions: [
                        {
                            field: "odsCode",
                            prompt:
                                "What is the provider's ODS code?"
                        },
                        {
                            field: "branchNumber",
                            prompt:
                                "What is the new branch number?"
                        }
                    ],

                    buildPlan(collected) {
                        return [
                            {
                                action: "editProvider",
                                odsCode: collected.odsCode
                            },
                            {
                                advancedAction: "update-branch-number",
                                variables: {
                                    BRANCH_NUMBER: collected.branchNumber
                                }
                            },
                            {
                                advancedAction: "save-provider"
                            }
                        ];
                    }
                },
                {
                    id: "update-address",
                    icon: "📍",
                    label: "Update Address",
                    steps: `type #inAddress {{ADDRESS}}`,
                    questions: [
                        {
                            field: "odsCode",
                            prompt:
                                "What is the provider's ODS code?"
                        },
                        {
                            field: "address",
                            prompt:
                                "What is the new address?"
                        }
                    ],

                    buildPlan(collected) {
                        return [
                            {
                                action: "editProvider",
                                odsCode: collected.odsCode
                            },
                            {
                                advancedAction: "update-address",
                                variables: {
                                    ADDRESS: collected.address
                                }
                            },
                            {
                                advancedAction: "save-provider"
                            }
                        ];
                    }
                },
                {
                    id: "update-cdb",
                    icon: "🔢",
                    label: "Update CDB Number",
                    steps: `type #inCDBNumber {{CDB_NUMBER}}`,
                    questions: [
                        {
                            field: "odsCode",
                            prompt:
                                "What is the provider's ODS code?"
                        },
                        {
                            field: "cdbNumber",
                            prompt:
                                "What is the new CDB number?"
                        }
                    ],

                    buildPlan(collected) {
                        return [
                            {
                                action: "editProvider",
                                odsCode: collected.odsCode
                            },
                            {
                                advancedAction: "update-cdb",
                                variables: {
                                    CDB_NUMBER: collected.cdbNumber
                                }
                            },
                            {
                                advancedAction: "save-provider"
                            }
                        ];
                    }
                },
                {
                    id: "update-ods",
                    icon: "🏷️",
                    label: "Update ODS Code",
                    steps: `type #inNHSCode {{ODS_CODE}}`,
                    questions: [
                        {
                            field: "odsCode",
                            prompt: "What is the provider's ODS code?"
                        },
                        {
                            field: "newOdsCode",
                            prompt: "What is the new ODS Code?"
                        }
                    ],

                    buildPlan(collected) {
                        return [
                            {
                                action: "editProvider",
                                odsCode: collected.odsCode
                            },
                            {
                                advancedAction: "update-ods",
                                variables: {
                                    ODS_CODE: collected.newOdsCode
                                }
                            },
                            {
                                advancedAction: "save-provider"
                            }
                        ];
                    }
                },
                {
                    id: "update-telephone",
                    icon: "📞",
                    label: "Update Telephone",
                    steps: `type #inOrgTelephone {{TELEPHONE}}`,
                    questions: [
                        {
                            field: "odsCode",
                            prompt: "What is the provider's ODS code?"
                        },
                        {
                            field: "telephone",
                            prompt: "What is the new telephone number?"
                        }
                    ],

                    buildPlan(collected) {
                        return [
                            {
                                action: "editProvider",
                                odsCode: collected.odsCode
                            },
                            {
                                advancedAction: "update-telephone",
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
                    id: "update-secure-email",
                    icon: "📧",
                    label: "Update Secure Email",
                    steps: `type #inSecureEmail {{SECURE_EMAIL}}`,
                    questions: [
                        {
                            field: "odsCode",
                            prompt: "What is the provider's ODS code?"
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
                                advancedAction: "update-secure-email",
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
                    id: "update-account-ref",
                    icon: "💳",
                    label: "Update Account Reference",
                    steps: `type #inAccountRef {{ACCOUNT_REF}}`,
                    questions: [
                        {
                            field: "odsCode",
                            prompt: "What is the provider's ODS code?"
                        },
                        {
                            field: "accountRef",
                            prompt: "What is the new account reference?"
                        }
                    ],

                    buildPlan(collected) {
                        return [
                            {
                                action: "editProvider",
                                odsCode: collected.odsCode
                            },
                            {
                                advancedAction: "update-account-ref",
                                variables: {
                                    ACCOUNT_REF: collected.accountRef
                                }
                            },
                            {
                                advancedAction: "save-provider"
                            }
                        ];
                    }
                },

                {
                    id: "update-mesh",
                    icon: "💳",
                    label: "Update Covid MESH Details",
                    steps: `click text="[+] MESH Mailbox settings"
                            wait 300
                            type input[name="inMESHMailboxIDs[]"]:first-of-type {{MESH_USERNAME}}
                            wait 150
                            type input[name="inMESHMailboxPasswords[]"]:first-of-type {{MESH_PASSWORD}}`,
                    questions: [
                        {
                            field: "odsCode",
                            prompt: "What is the provider's ODS code?"
                        },
                        {
                            field: "meshUsername",
                            prompt: "What is the new MESH username?"
                        },
                        {
                            field: "meshPassword",
                            prompt: "What is the new MESH password?"
                        }
                    ],

                    buildPlan(collected) {
                        return [
                            {
                                action: "editProvider",
                                odsCode: collected.odsCode
                            },
                            {
                                advancedAction: "update-mesh",
                                variables: {
                                    MESH_USERNAME: collected.meshUsername,
                                    MESH_PASSWORD: collected.meshPassword,
                                }
                            },
                            {
                                advancedAction: "save-provider"
                            }
                        ];
                    }
                }
            ]
        },
        {
            group: "Navigation",
            actions: [
                {
                    id: "save-provider",
                    icon: "💾",
                    label: "Save Provider",
                    steps: `click [value="Save"]`
                }
            ]
        },
        {
            group: "Funding",
            actions: [
                {
                    id: "add-service-funding",
                    icon: "💷",
                    label: "Add Service Funding",
                    description: "Add a funding definition to a service.",
                    category: "Funding",
                    steps: `# placeholder`,
                    keywords: [
                        "funding",
                        "payment",
                        "service payment",
                        "provision payment",
                        "flu funding"
                    ],

                    questions: [
                        {
                            field: "commissionerName",
                            prompt: "What is the commissioner's name?"
                        },
                        {
                            field: "serviceSearch",
                            prompt: "What Service would you like to add funding to?"
                        }
                    ],

                    lookups: [
                        {
                            type: "fundingService",
                            sourceField: "commissionerName",
                            resultField: "fundingService"
                        }
                    ],

                    buildPlan(collected) {

                        return [

                            {
                                action: "openFundingService",
                                service: collected.fundingService
                            },
                            {
                                action: "openService",
                                service: collected.fundingService
                            }
                        ];

                    }
                }
            ]
        },
        {
            group: "Service",
            actions: [
                {
                    id: "find-services",
                    icon: "💷",
                    label: "Edit Service",
                    description: "Edit a service.",
                    category: "Service",
                    steps: `# placeholder`,
                    keywords: [
                        "service",
                        "new question"
                    ],

                    questions: [
                        {
                            field: "serviceSearch",
                            prompt: "What is the commissioner's name?"
                        }
                    ],

                    lookups: [
                        {
                            type: "service",
                            sourceField: "serviceSearch",
                            resultField: "service"
                        }
                    ],

                    buildPlan(collected) {

                        return [
                            {
                                action: "openService",
                                service: collected.service
                            }
                        ];

                    }
                }
            ]
        }
    ]
};

// Validate metadata when the application starts
validateActions();

function validateActions() {
    for (const page of Object.values(ADVANCED_ACTION_SETS)) {
        for (const group of page) {
            for (const action of group.actions) {
                if (!action.id) {
                    throw new Error("Missing action id");
                }

                if (!action.label) {
                    throw new Error(`${action.id}: missing label`);
                }

                if (!action.steps) {
                    throw new Error(`${action.id}: missing steps`);
                }

                if (action.questions && !action.buildPlan) {
                    throw new Error(
                        `${action.id}: questions defined but no buildPlan`
                    );
                }
                if (action.questions && !Array.isArray(action.questions)) {
                    throw new Error(
                        `${action.id}: questions must be an array`
                    );
                }

                if (action.questions?.length > 0 && !action.buildPlan) {
                    throw new Error(
                        `${action.id}: questions defined but no buildPlan`
                    );
                }

                if (action.buildPlan && !action.questions) {
                    throw new Error(
                        `${action.id}: buildPlan exists but no questions defined`
                    );
                }

            }
        }
    }
}

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