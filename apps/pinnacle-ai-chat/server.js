import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { intent } from "../../scripts/WorkflowAI/AIRunner/intent.js";
import { ADVANCED_ACTION_SETS, findAction } from "../../scripts/advanced/advancedActions.js";
import * as userService from "./services/userService.mjs";


const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.listen(4000, () => {
    console.log("PinnacleAI Assistant listening on http://localhost:4000");
});


app.post(
    "/api/users/search",
    async (req, res) => {

        const users =
            await userService.findUser(
                req.body.search
            );

        res.json(users);

    }
);

app.get(
    "/api/users/:uid",
    async (req, res) => {

        const user =
            await userService.getUser(
                req.params.uid
            );

        res.json(user);

    }
);

app.post("/api/chat", async (req, res) => {
    const { message } = req.body;
    const generatedPlan =
        await intent(message);

    if (generatedPlan?.type === "collect-info") {
        return res.json(generatedPlan);
    }

    if (generatedPlan?.type === "unknown-intent") {
        return res.json(generatedPlan);
    }


    if (generatedPlan?.type === "capabilities") {
        return res.json(generatedPlan);
    }

    if (!Array.isArray(generatedPlan)) {

        return res.json({
            type: "unknown-intent",
            message
        });

    }


    const findUserStep =
        generatedPlan.find(
            p => p.action === "findUser"
        );
    if (findUserStep) {

        return res.json({
            type: "userLookupRequired",
            username: findUserStep.username,
            plan: generatedPlan
        });
    }

    const findFundingServiceStep =
        generatedPlan.find(
            p => p.action === "findFundingService"
        );
    if (findFundingServiceStep) {

        return res.json({
            type: "fundingServiceLookupRequired",
            serviceName: findFundingServiceStep.serviceName,
            plan: generatedPlan
        });
    }

    res.json({
        reply: `I've identified ${generatedPlan.length} automation step(s) required to complete this request.`,
        workflow: convertToWorkflow(generatedPlan),
        plan: generatedPlan
    });
});

app.post("/api/workflow", (req, res) => {

    const workflow =
        convertToWorkflow(
            req.body.plan
        );

    console.log("Workflow:", workflow);
    console.log("Workflow Type:", typeof workflow);
    console.log("Is Array:", Array.isArray(workflow));

    res.json(workflow);

});

app.post("/api/conversation", (req, res) => {

    const conversation = req.body;


    console.log(
        "Conversation:",
        JSON.stringify(
            conversation,
            null,
        )
    );

    const nextQuestion = nextConversationQuestion(conversation);
    if (nextQuestion) {
        console.log(
            "nextQuestion:",
            JSON.stringify(
                nextQuestion,
                null,
            )
        );

        return res.json({
            complete: false,
            field: nextQuestion.field,
            type: "question",
            question: nextQuestion.prompt
        });

    }

    const lookup = nextConversationLookup(conversation);

    console.log(
        "Lookup:",
        JSON.stringify(lookup, null, 2)
    );

    if (lookup) {

        const plan =
            buildConversationPlan(
                conversation
            );

        const response = {
            complete: false,
            type: "lookupRequired",
            lookupType: lookup.type,
            search:
                conversation.collected[
                lookup.sourceField
                ],
            collected: conversation.collected,
            plan
        };

        console.log(
            "Lookup Response:",
            JSON.stringify(response, null, 2)
        );


        return res.json(response);
    }


    const plan = buildConversationPlan(conversation);

    console.log(
        "plan:",
        JSON.stringify(
            plan,
            null,
        )
    );

    const findUserStep =
        plan.find(
            p => p.action === "findUser"
        );

    if (findUserStep) {

        console.log(
            "Conversation Result:",
            JSON.stringify(
                {
                    complete: true,
                    plan
                },
                null,
                2
            )
        );
        return res.json({
            complete: true,
            type: "userLookupRequired",
            username: findUserStep.username,
            plan
        });

    }

    console.log(
        "Conversation Result:",
        JSON.stringify(
            {
                complete: true,
                plan
            },
            null,
            2
        )
    );



    return res.json({
        complete: true,
        plan
    });
}
);


function findAdvancedAction(id) {

    return Object
        .values(ADVANCED_ACTION_SETS)
        .flatMap(set => set)
        .flatMap(group => group.actions)
        .find(action => action.id === id);

}

function convertToWorkflow(plan) {

    return plan.map(step => {

        if (step.action === "createCase") {
            return {
                icon: "🎫",
                text: "Create Incident Record"
            };
        }

        if (step.action === "addCaseNotes") {
            return {
                icon: "📝",
                text: "Update Resolution Notes"
            };
        }

        if (step.action === "closeCase") {
            return {
                icon: "✅",
                text: "Resolve Incident"
            };
        }

        if (step.action === "openFundingService") {
            return {
                icon: "💷",
                text: "Gathering existing funding rules"
            };
        }

        if (step.action === "openService") {
            return {
                icon: "📋",
                text: "Gathering service questions"
            };
        }

        if (step.action === "openUser") {

            const name =
                step.user.displayName
                    ? `${step.user.displayName} (${step.user.username})`
                    : step.user.username;

            return {
                icon: "👤",
                text: `Open User ${name}`
            };

        }
        if (
            step.action === "editProvider"
        ) {

            return {
                icon: "🏥",
                text: `Open Provider ${step.odsCode}`
            };
        }

        if (step.action === "findUser") {

            return {
                icon: "👤",
                text: `Find User ${step.username}`
            };
        }

        if (step.action === "resetMfa") {

            return {
                icon: "🔐",
                text: "Reset MFA"
            };
        }

        if (step.action === "resetPasscode") {
            return {
                icon: "🔑",
                text: "Reset Passcode"
            };
        }

        if (step.action === "resetPassword") {
            return {
                icon: "🔒",
                text: "Reset Password"
            };
        }
        if (step.advancedAction) {

            const action = findAdvancedAction(step.advancedAction);
            let text = action?.label ?? step.advancedAction;
            if (step.variables?.TELEPHONE) {
                text += ` to ${step.variables.TELEPHONE}`;
            }
            if (
                step.variables?.SECURE_EMAIL
            ) {
                text += ` to ${step.variables.SECURE_EMAIL}`;
            }

            if (
                step.variables?.CDB_NUMBER
            ) {
                text += ` to ${step.variables.CDB_NUMBER}`;
            }

            return {
                icon: action?.icon ?? "⚙️",
                text: text
            };
        }

        return {
            icon: "⚙️",
            text: step.action ?? step.advancedAction
        };

    });
}
function nextConversationLookup(conversation) {

    const action =
        findAction(conversation.action);

    if (!action?.lookups) {
        return null;
    }

    const lookup =
        action.lookups.find(
            l => !conversation.collected[l.resultField]
        );

    return lookup ?? null;
}

function nextConversationQuestion(conversation) {

    const action = findAction(conversation.action);

    if (!action) {
        console.error(
            "Action not found:",
            conversation.action
        );
        return null;
    }

    console.log(
        "Action Found:",
        action.id
    );

    const nextQuestion =
        action.questions.find(
            q => !conversation.collected[q.field]
        );

    return nextQuestion;

}

function addConversationMetadata(action) {

}

function buildConversationPlan(conversation) {

    const action = findAction(conversation.action);
    const plan = action.buildPlan(conversation.collected);

    return plan;
}

function conversationComplete(conversation) {

    switch (conversation.action) {

        case "reset-mfa":
            return Boolean(conversation.collected.username);

        case "change-telephone":
            return Boolean(conversation.collected.odsCode && conversation.collected.telephone);

        case "change secure-email":
            return Boolean(conversation.collected.odsCode && conversation.collected.email);
        default:
            return false;
    }
}
