import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { plan } from "../../scripts/WorkflowAI/AIRunner/planner.js";
import { ADVANCED_ACTION_SETS } from "../../scripts/advanced/advancedActions.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.listen(4000, () => {
    console.log("PinnacleAI Assistant listening on http://localhost:4000");
});


app.post("/api/chat", async (req, res) => {
    const { message } = req.body;
    const generatedPlan =
        await plan(message);

    if (generatedPlan?.type === "collect-info") {

        return res.json(
            generatedPlan
        );

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



function findAdvancedAction(id) {

    return Object
        .values(ADVANCED_ACTION_SETS)
        .flatMap(set => set)
        .flatMap(group => group.actions)
        .find(action => action.id === id);

}

function convertToWorkflow(plan) {

    return plan.map(step => {

        if (step.action === "openUser") {

            return {
                icon: "👤",
                text:
                    `Open User ${step.user.displayName}`
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