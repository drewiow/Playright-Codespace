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

app.post("/api/chat", async (req, res) => {
    const { message } = req.body;
    const generatedPlan = await plan(message);

    res.json({
        reply:
            `I've identified ${generatedPlan.length} automation step(s) required to complete this request.`,
        workflow: convertToWorkflow(generatedPlan),
        plan: generatedPlan
    });
});

app.listen(4000, () => {
    console.log("PinnacleAI Assistant listening on http://localhost:4000");
});

function findAdvancedAction(id) {

    return ADVANCED_ACTION_SETS
        .providerDetails
        .flatMap(group => group.actions)
        .find(
            action => action.id === id
        );

}

function convertToWorkflow(plan) {

    return plan.map(step => {

        if (
            step.action === "editProvider"
        ) {

            return {
                icon: "🏥",
                text: `Open Provider ${step.odsCode}`
            };
        }

        if (step.action === "resetMfa") {
            return {
                icon: "🔐",
                text: "Reset MFA"
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