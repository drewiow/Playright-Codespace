import express from "express";
const router = express.Router();
import { runScript } from "../common/runScript.mjs";
import * as emisxHelpers from "../Emis-x/helpers.mjs"
import { contexts } from "../state/contexts.mjs";

router.post("/users/:email/reset-mfa", async (req, res) => {

    console.log("================================");
    console.log("RESETTING MFA FOR EMIS-X");
    console.log("Email:", req.params.email);
    console.log("================================");

    try {

        const email = req.params.email;

        console.log("Setting ENV vars...");

        console.log(
            "[EMIS-X] RESET CONTEXT",
            contexts["emis-x"]
        );

        process.env.ENV_ENC_PATH =
            contexts["emis-x"].envEncPath;

        process.env.ENV_PASSPHRASE =
            contexts["emis-x"].passphrase;

        console.log("ENV path:",
            process.env.ENV_ENC_PATH);

        console.log("Calling runScript()...");

        let user = [];

        await runScript({

            logger: (...args) => {
                console.log(
                    "[RUNSCRIPT]",
                    ...args
                );
            },

            main: async ({
                page,
                logger,
                username: loginUsername,
                password
            }) => {

                console.log(
                    "[MAIN] Entered main()"
                );

                console.log(
                    "[MAIN] Username loaded:",
                    !!loginUsername
                );

                console.log(
                    "[MAIN] Password loaded:",
                    !!password
                );

                console.log(
                    "[MAIN] About to call helper..."
                );

                await emisxHelpers.resetMfa(
                    page,
                    loginUsername,
                    password,
                    email,
                    logger
                );

                console.log(
                    "[MAIN] Helper completed"
                );

            }

        });

        console.log(
            "runScript completed"
        );

        res.json({
            success: true,
            email,
            user,
            action: "reset-mfa"
        });

    }
    catch (err) {

        console.error(
            "EMIS-X RESET FAILED"
        );

        console.error(
            err.stack || err
        );

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

});

router.get("/context", (req, res) => {

    res.json({
        loaded: contexts["emis-x"] !== null,
        environment: contexts["emis-x"]?.environment
    });

});

router.post("/load-default-environment",
    (req, res) => {

        contexts["emis-x"] = {
            environment: "Production",
            envEncPath: "C:\\Users\\Drew.Clarke\\Downloads\\drew.clarke.emisx.enc",
            passphrase: "D0ntkn0w1979?!"
        };

        res.json({
            loaded: true
        });

    }
);


export default router;