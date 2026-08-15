import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { plan } from "../../scripts/WorkflowAI/AIRunner/planner.js";

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

function convertToWorkflow(plan) {

    return plan.map(step => {

        if (
            step.action ===
            "editProvider"
        ) {

            return {
                icon: "🏥",
                text:
                    `Open Provider ${step.odsCode}`
            };
        }

        if (
            step.advancedAction ===
            "change-telephone"
        ) {

            return {
                icon: "📞",
                text:
                    "Update Telephone"
            };
        }

        return {
            icon: "⚙️",
            text:
                step.action ??
                step.advancedAction
        };

    });
}