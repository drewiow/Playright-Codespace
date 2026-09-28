import express from "express";
const router = express.Router();
import multer from "multer";
import { runScript } from "../common/runScript.mjs";
import * as pharmOutcomesHelpers from "../pharmoutcomes/helpers.mjs"
import { contexts } from "../state/contexts.mjs";
import { executePlan } from "../common/executePlan.mjs";
import { assessAccountTrust } from "../pharmoutcomes/helpers.mjs";

const upload = multer({ dest: "uploads/" });

export async function getProviderAdmins(page) {

    const admins = await page.evaluate(() => {

        const rows =
            document.querySelectorAll(
                "table tbody tr"
            );

        const results = [];

        for (const row of rows) {

            // Skip disabled users
            if (
                row.classList.contains("hilite4") ||
                row.querySelector("strike")
            ) {
                continue;
            }

            const nameCell =
                row.querySelector("td");

            if (!nameCell) {
                continue;
            }

            // Admin icons
            const adminIcons =
                row.querySelectorAll(
                    '[title="User Admin: YES"]'
                );

            if (!adminIcons.length) {
                continue;
            }

            const name =
                nameCell.childNodes[0]
                    ?.textContent
                    ?.trim();

            const username =
                nameCell.querySelector("span")
                    ?.textContent
                    ?.replace(/[()]/g, "")
                    ?.trim();

            const showInfoLink =
                row.querySelector(
                    '[data-inlinestats="UserLastLoginInfo"]'
                );

            if (!showInfoLink) {
                continue;
            }

            const params =
                JSON.parse(
                    showInfoLink.dataset
                        .inlinestatsParams
                );

            results.push({
                name,
                username,
                uid: params.lUserID
            });
        }

        return results;
    });

    return admins;
}

export async function getProviderServices(page) {

    return await page.evaluate(() => {

        const rows = Array.from(
            document.querySelectorAll(
                "form.service.accreditation table tr"
            )
        );

        const excludedCategories = [
            "Services Archived/Closed",
            "SAMPLE TEMPLATES",
            "Development only",
            "Under Development"
        ];

        const excludedWords = [
            "IMPORT",
            "DO NOT USE",
            "TEST",
            "DEMO",
            "UNWANTED"
        ];

        return rows
            .slice(1)
            .map(row => {

                const cells = row.querySelectorAll("td");

                if (cells.length < 5) {
                    return null;
                }

                const serviceId =
                    cells[0]?.innerText?.trim();

                const category =
                    cells[1]
                        ?.querySelector("em")
                        ?.innerText
                        ?.trim() || "";

                const serviceLink =
                    cells[1]?.querySelector("a");

                const serviceName =
                    serviceLink
                        ?.childNodes[
                        serviceLink.childNodes.length - 1
                    ]
                        ?.textContent
                        ?.trim() || "";

                const types =
                    Array.from(
                        cells[2].querySelectorAll(
                            "ul.indicators li"
                        )
                    )
                        .map(li => li.textContent.trim());

                const accredited =
                    !!cells[3]
                        .querySelector(
                            "a[href*='deaccredit=']"
                        );

                const levels =
                    Array.from(
                        cells[3].querySelectorAll(
                            "ul.indicators li"
                        )
                    )
                        .map(li => li.textContent.trim());

                const commissionerLink =
                    cells[4]?.querySelector("a");

                const commissioner =
                    commissionerLink?.textContent?.trim() || "";

                const commissionerId =
                    commissionerLink
                        ?.getAttribute("href")
                        ?.match(/id=(\d+)/)?.[1] || "";


                return {
                    serviceId,
                    serviceName,
                    category,
                    types,
                    accredited,
                    levels,
                    commissioner,
                    commissionerId
                };

            })

            .filter(Boolean).filter(service => {

                if (
                    excludedCategories.includes(
                        service.category
                    )
                ) {
                    return false;
                }

                const text = (
                    service.serviceName +
                    " " +
                    service.category
                ).toUpperCase();

                return !excludedWords.some(
                    word => text.includes(word)
                );

            })

    });

}

export async function getProviderUsers(page) {

    await page.waitForFunction(() => {

        const legend = Array.from(
            document.querySelectorAll("legend")
        ).find(x =>
            x.textContent.includes(
                "Users at this provider"
            )
        );

        return !!legend;

    });

    const users = await page.evaluate(() => {

        const legend = Array.from(
            document.querySelectorAll("legend")
        ).find(x =>
            x.textContent.includes(
                "Users at this provider"
            )
        );

        const fieldset =
            legend?.closest("fieldset");

        const table =
            fieldset?.querySelector("table");

        const rows =
            Array.from(
                table?.querySelectorAll("tbody tr") || []
            ).slice(1);

        return rows.map(row => {

            const nameCell =
                row.querySelector("td");

            const fullName =
                nameCell?.childNodes[0]
                    ?.textContent
                    ?.trim();

            const username =
                nameCell
                    ?.querySelector("span")
                    ?.textContent
                    ?.replace(/[()]/g, "")
                    ?.trim();

            const loginLink =
                row.querySelector(
                    '[data-inlinestats="UserLastLoginInfo"]'
                );

            const uid =
                loginLink
                    ? JSON.parse(
                        loginLink.dataset
                            .inlinestatsParams
                    ).lUserID
                    : null;

            const editLink =
                row.querySelector(
                    'a[href*="users?edit="]'
                );

            return {
                uid,
                fullName,
                username,
                editUrl:
                    editLink?.getAttribute(
                        "href"
                    ),
                isAdmin:
                    !!row.querySelector(
                        '[title="User Admin: YES"]'
                    ),
                isSuperUser:
                    !!row.querySelector(
                        '[title="Super User: YES"]'
                    )
            };

        });

    });

    console.log(
        "Users found:",
        users.length
    );

    console.log(
        JSON.stringify(
            users,
            null,
            2
        )
    );

    return users;

}

export async function getAdminsOrderedByLastLogin(page,
    users,
    logger = console.log
) {

    const admins = users.filter(user => user.isAdmin);

    logger(`Found ${admins.length} admins`);

    const adminsWithDetails = [];

    for (const admin of admins) {

        logger(`Loading ${admin.fullName}`);

        const userDetails = await pharmOutcomesHelpers.openUser(
            page,
            admin.uid,
            logger
        );

        adminsWithDetails.push(
            {
                ...userDetails,
                uid: admin.uid,
                name: admin.fullName
            }
        );
    }

    adminsWithDetails.sort((a, b) => {

        const dateA =
            a.lastActive
                ? new Date(a.lastActive)
                : new Date(0);

        const dateB =
            b.lastActive
                ? new Date(b.lastActive)
                : new Date(0);

        return dateB - dateA;
    });

    return adminsWithDetails;
}

router.get("/context", (req, res) => {

    res.json({
        loaded: contexts["pharmoutcomes"] !== null,
        environment: contexts["pharmoutcomes"]?.environment
    });

});

router.post("/load-default-environment",
    (req, res) => {

        contexts["pharmoutcomes"] = {
            environment: "Production",
            envEncPath: "C:\\Users\\Drew.Clarke\\Downloads\\drew.clarke.enc",
            passphrase: "D0ntkn0w1979?!"
        };

        res.json({
            loaded: true
        });

    }
);

router.post("/users/find-user", async (req, res) => {

    const { username } = req.body;

    process.env.ENV_ENC_PATH =
        contexts["pharmoutcomes"].envEncPath;

    process.env.ENV_PASSPHRASE =
        contexts["pharmoutcomes"].passphrase;

    let users = [];

    await runScript({

        logger: console.log,

        main: async ({
            page,
            logger,
            username: loginUsername,
            password
        }) => {

            await pharmOutcomesHelpers.login(
                page,
                loginUsername,
                password,
                logger
            );

            users =
                await pharmOutcomesHelpers.findUser(
                    page,
                    username,
                    logger
                );
        }
    });

    res.json(
        users.filter(
            u => !u.disabled
        )
    );
});

router.post("/users/:uid/verify-securityWord", async (req, res) => {

    const uid = req.params.uid;
    const { letter1, letter2 } = req.body;

    console.log("Verifying security word for user:", uid, "letter1:", letter1, "letter2:", letter2);

    process.env.ENV_ENC_PATH =
        contexts["pharmoutcomes"].envEncPath;

    process.env.ENV_PASSPHRASE =
        contexts["pharmoutcomes"].passphrase;

    let result = false;

    await runScript({

        logger: console.log,

        main: async ({
            page,
            logger,
            username: loginUsername,
            password
        }) => {

            await pharmOutcomesHelpers.login(
                page,
                loginUsername,
                password,
                logger
            );

            await pharmOutcomesHelpers.openUser(
                page,
                uid,
                logger
            );

            result =
                await pharmOutcomesHelpers.verifySecurityWord(
                    page,
                    letter1,
                    letter2,
                    logger
                );

        }
    });

    res.json({
        uid,
        action: "verify-securityWord",
        success: result.success,
        message: result.result
    });


});

router.post("/users/:uid/reset-mfa", async (req, res) => {

    const uid = req.params.uid;

    process.env.ENV_ENC_PATH =
        contexts["pharmoutcomes"].envEncPath;

    process.env.ENV_PASSPHRASE =
        contexts["pharmoutcomes"].passphrase;

    let user = [];

    await runScript({

        logger: console.log,

        main: async ({
            page,
            logger,
            username: loginUsername,
            password
        }) => {

            await pharmOutcomesHelpers.login(
                page,
                loginUsername,
                password,
                logger
            );

            const plan = [
                {
                    action: "openUser",
                    user: {
                        uid
                    }
                },
                {
                    advancedAction: "reset-mfa"
                }
            ];

            await executePlan(
                page,
                plan,
                logger
            );
        }
    });

    res.json({
        success: true,
        uid,
        user,
        action: "reset-mfa"
    });

});

router.post("/users/:uid/reset-password", async (req, res) => {

    const uid = req.params.uid;

    process.env.ENV_ENC_PATH =
        contexts["pharmoutcomes"].envEncPath;

    process.env.ENV_PASSPHRASE =
        contexts["pharmoutcomes"].passphrase;


    let email = "";

    await runScript({

        logger: console.log,

        main: async ({
            page,
            logger,
            username: loginUsername,
            password
        }) => {

            await pharmOutcomesHelpers.login(
                page,
                loginUsername,
                password,
                logger
            );

            const plan = [
                {
                    action: "openUser",
                    user: {
                        uid
                    }
                },
                {
                    advancedAction: "reset-password"
                }
            ];

            await executePlan(
                page,
                plan,
                logger
            );

            const fetchedUser = await pharmOutcomesHelpers.openUser(page, uid, logger);
            email = fetchedUser?.email || "";


        }
    });

    res.json({
        success: true,
        uid,
        email,
        action: "reset-password"
    });

});

router.post("/users/:uid/reset-passcode", async (req, res) => {

    const uid = req.params.uid;

    process.env.ENV_ENC_PATH =
        contexts["pharmoutcomes"].envEncPath;

    process.env.ENV_PASSPHRASE =
        contexts["pharmoutcomes"].passphrase;

    let user = [];

    await runScript({

        logger: console.log,

        main: async ({
            page,
            logger,
            username: loginUsername,
            password
        }) => {

            await pharmOutcomesHelpers.login(
                page,
                loginUsername,
                password,
                logger
            );

            const plan = [
                {
                    action: "openUser",
                    user: {
                        uid
                    }
                },
                {
                    advancedAction: "reset-passcode"
                }
            ];

            await executePlan(
                page,
                plan,
                logger
            );
        }
    });

    res.json({
        success: true,
        uid,
        user,
        action: "reset-passcode"
    });

});

router.get("/users/:uid", async (req, res) => {

    const uid = req.params.uid;

    process.env.ENV_ENC_PATH =
        contexts["pharmoutcomes"].envEncPath;

    process.env.ENV_PASSPHRASE =
        contexts["pharmoutcomes"].passphrase;

    let user = [];

    await runScript({

        logger: console.log,

        main: async ({
            page,
            logger,
            username: loginUsername,
            password
        }) => {

            await pharmOutcomesHelpers.login(
                page,
                loginUsername,
                password,
                logger
            );

            user =
                await pharmOutcomesHelpers.openUser(
                    page,
                    uid,
                    logger
                );
        }
    });

    res.json({
        success: true,
        uid,
        user
    });
});

router.get("/providers/:odsCode", async (req, res) => {

    const odsCode = req.params.odsCode;

    process.env.ENV_ENC_PATH =
        contexts["pharmoutcomes"].envEncPath;

    process.env.ENV_PASSPHRASE =
        contexts["pharmoutcomes"].passphrase;

    let provider = [];

    await runScript({

        logger: console.log,

        main: async ({
            page,
            logger,
            username: loginUsername,
            password
        }) => {

            await pharmOutcomesHelpers.login(
                page,
                loginUsername,
                password,
                logger
            );


            await pharmOutcomesHelpers.editProvider(
                page,
                odsCode,
                logger
            );

            //scrape the screen
            provider = await getProviderDetails(page);

        }
    });

    res.json({
        success: true,
        provider
    });
});

router.post("/providers/:odsCode/find-user", async (req, res) => {

    process.env.ENV_ENC_PATH =
        contexts["pharmoutcomes"].envEncPath;

    process.env.ENV_PASSPHRASE =
        contexts["pharmoutcomes"].passphrase;


    const { username } = req.body;
    const odsCode = req.params.odsCode;

    let users = [];
    let user = {};

    await runScript({

        logger: console.log,

        main: async ({
            page,
            logger,
            username: loginUsername,
            password
        }) => {

            await pharmOutcomesHelpers.login(
                page,
                loginUsername,
                password,
                logger
            );

            await pharmOutcomesHelpers.editProvider(
                page,
                odsCode,
                logger
            );

            users = await getProviderUsers(page);

            console.log("All users:", users);
            console.log("Filtering users for username:", username);
            const matches = users.filter(user =>
                user.username
                    ?.toLowerCase()
                    .includes(
                        `${username}`.toLowerCase()
                    )
            );

            if (matches.length > 0) {
                user = matches[0];
                res.json({
                    success: true,
                    user
                });
            } else {
                res.json({
                    success: false,
                    message: "User not found."
                });
            }
        }

    }

    );
});

router.post("/providers/:odsCode/users", async (req, res) => {

    console.log(
        "Getting users for provider",
        req.params.odsCode
    );

    // options to filter down the list by Admins, and the current username
    const onlyAdmins = req.body.onlyAdmins === "true";
    const currentUsername = req.body.currentUsername;
    const odsCode = req.params.odsCode;

    process.env.ENV_ENC_PATH =
        contexts["pharmoutcomes"].envEncPath;

    process.env.ENV_PASSPHRASE =
        contexts["pharmoutcomes"].passphrase;

    let allUsers = [];
    let admins = [];
    let currentUser = {};

    await runScript({

        logger: console.log,

        main: async ({
            page,
            logger,
            username: loginUsername,
            password
        }) => {

            await pharmOutcomesHelpers.login(
                page,
                loginUsername,
                password,
                logger
            );

            await pharmOutcomesHelpers.editProvider(
                page,
                odsCode,
                logger
            );

            await page.waitForSelector(
                "legend"
            );

            await page.waitForFunction(() => {

                return document.body.innerText
                    .includes("Users at this provider");

            });

            //get all of the users first 
            allUsers = await getProviderUsers(page);


            if (onlyAdmins) {

                admins =
                    await getAdminsOrderedByLastLogin(
                        page,
                        allUsers,
                        logger
                    );
                console.log("Admins ordered by last login:", admins);
            }

            if (currentUsername && currentUsername != "") {

                console.log("Filtering users for username:", currentUsername);
                const matches = allUsers.filter(user =>
                    user.username?.toLowerCase() === currentUsername.toLowerCase()
                );
                if (matches.length === 0) {
                    console.log("No matching users found for username:", currentUsername);
                } else {

                    console.log("Matching users found for username:", currentUsername);
                    currentUser = await pharmOutcomesHelpers.openUser(
                        page,
                        matches[0].uid,
                        logger
                    );

                }

            }

        }

    });

    const adminNames = (admins || []).map(a => a.fullName);

    let confidence = assessAccountTrust(currentUser.auditEntries, adminNames);
    currentUser.confidence = confidence;

    res.json({
        success: true,
        count: onlyAdmins ? admins.length : allUsers.length,
        users: onlyAdmins ? admins : allUsers,
        currentUser
    });
});

router.get("/providers/:odsCode/services", async (req, res) => {


    console.log("Getting services for provider", req.params.odsCode);

    const odsCode = req.params.odsCode;

    process.env.ENV_ENC_PATH =
        contexts["pharmoutcomes"].envEncPath;

    process.env.ENV_PASSPHRASE =
        contexts["pharmoutcomes"].passphrase;

    let services = [];

    await runScript({

        logger: console.log,

        main: async ({
            page,
            logger,
            username: loginUsername,
            password
        }) => {

            await pharmOutcomesHelpers.login(
                page,
                loginUsername,
                password,
                logger
            );


            await pharmOutcomesHelpers.editProvider(
                page,
                odsCode,
                logger
            );

            await page.waitForSelector(
                "legend"
            );

            await page.waitForFunction(() => {

                return document.body.innerText
                    .includes("Service Accreditations");

            });

            services =
                await getProviderServices(
                    page,
                    logger
                );


        }
    });

    res.json({
        success: true,
        services
    });
});

router.get("/commissioners/:uid", async (req, res) => {

    const uid = req.params.uid;

    process.env.ENV_ENC_PATH =
        contexts["pharmoutcomes"].envEncPath;

    process.env.ENV_PASSPHRASE =
        contexts["pharmoutcomes"].passphrase;

    let commissioner = [];

    await runScript({

        logger: console.log,

        main: async ({
            page,
            logger,
            username: loginUsername,
            password
        }) => {

            await pharmOutcomesHelpers.login(
                page,
                loginUsername,
                password,
                logger
            );

            commissioner =
                await pharmOutcomesHelpers.openCommissioner(
                    page,
                    uid,
                    logger
                );
        }
    });

    res.json({
        success: true,
        commissioner
    });
});

router.post("/load-environment",
    upload.single("envFile"),
    (req, res) => {

        if (!req.file) {
            return res.status(400).json({
                error: "No env file uploaded"
            });
        }

        contexts["pharmoutcomes"] = {
            id: crypto.randomUUID(),
            environment: "Production",
            envEncPath: req.file.path,
            passphrase: req.body.passphrase
        };

        console.log({
            id: contexts["pharmoutcomes"].id,
            environment: contexts["pharmoutcomes"].environment,
            envEncPath: contexts["pharmoutcomes"].envEncPath,
            passphraseProvided: !!contexts["pharmoutcomes"].passphrase
        });

        res.json(contexts["pharmoutcomes"]);
    }
);

export default router;