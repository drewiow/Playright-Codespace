const messages = document.getElementById("messages");

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const context =
            await loadEnvironmentContext();

        if (context.loaded) {

            add(`
        <div class="ai-message">

            ✅ Environment connected.

            <br><br>

            What would you like me to do today?

        </div>
        `, "ai", false);

        } else {

            add(`
        <div class="ai-message">
            👋 Welcome to PinnacleAI.
            <br><br>
            Before I can execute workflows, I need an environment.
            <br><br>
            <button
                id="load-env-btn" class="load-env-btn">
                Connect Environment
            </button>
        </div>
    `, "ai", false);

        }

        document
            .getElementById("load-env-btn")
            .addEventListener("click", () => {
                console.log("Opening modal");

                document
                    .getElementById("env-modal")
                    .classList
                    .remove("hidden");

            });
    }
);



async function loadEnvironment() {

    const file = document.getElementById("env-file").files[0];
    const passphrase = document.getElementById("env-passphrase").value;
    const formData = new FormData();
    formData.append("envFile", file);
    formData.append("passphrase", passphrase);
    const res =
        await fetch(
            "http://localhost:3000/api/pinnacle/load-environment",
            {
                method: "POST",
                body: formData
            }
        );

    const result = await res.json();

    document
        .getElementById("env-modal")
        .classList
        .add("hidden");
    add(`
    <div class="ai-message">
        ✅ Environment connected.
        <br><br>
        What would you like me to do today?
    </div>
    `, "ai", false);

    await loadEnvironmentContext();
}



document
    .getElementById("load-env-confirm")
    .addEventListener(
        "click",
        loadEnvironment
    );

document
    .getElementById("load-env-cancel")
    .addEventListener("click", () => {

        console.log("Cancel clicked");

        document
            .getElementById("env-modal")
            .classList
            .add("hidden");

    });

async function loadEnvironmentContext() {

    const res = await fetch("http://localhost:3000/api/pinnacle/context");
    const context = await res.json();
    return context;
}

document
    .getElementById("env-file")
    .addEventListener("change", e => {

        const file =
            e.target.files[0];

        document
            .getElementById(
                "selected-file"
            )
            .innerHTML =
            file?.name ??
            "No file selected";

    });

function add(html, cls = "", wrap = true) {

    const d = document.createElement("div");
    d.className = `msg ${cls} `;
    d.innerHTML = wrap
        ? `<div class="bubble"> ${html}</div > `
        : html;

    messages.appendChild(d);

    messages.scrollTop =
        messages.scrollHeight;
}

async function send() {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text) return;

    add(text, "user");
    input.value = "";
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
    const data = await res.json();
    console.log("Chat response:", data);
    window.currentPlan = data.plan;
    const workflowHtml = data.workflow
        .map(step => `
        <div class="workflow-step">
            <span class="workflow-icon">
                ${step.icon}
            </span>

            <span class="workflow-text">
                ${step.text}
            </span>
        </div>
        `)
        .join("");

    add(`
        <div class="ai-message"> ${data.reply}</div>
            <div class="workflow">
                <strong>Proposed Workflow</strong>
                <div class="workflow-list">${workflowHtml}</div>
                <button class="execute-btn"">🚀 Execute Workflow</button>
        </div>
        `, "ai", false);
}
document.getElementById('sendBtn').addEventListener('click', send);

async function executeWorkflow() {

    console.log(
        "Executing:",
        window.currentPlan
    );
    document
        .querySelectorAll(".execute-btn")
        .forEach(btn => {
            btn.disabled = true;
            btn.innerHTML = "✅ Submitted";
        });

    executePlan(window.currentPlan);
    window.executeWorkflow = executeWorkflow;
}

document.addEventListener("click", async (e) => {

    if (!e.target.classList.contains("execute-btn")) {
        return;
    }

    await executeWorkflow();
});

async function executePlan(plan) {

    console.log("Sending plan:", plan);

    const res = await fetch(
        "http://localhost:3000/api/pinnacle/execute",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                plan
            })
        }
    );

    console.log("Response object:", res);

    const result = await res.json();

    document
        .querySelectorAll(".execute-btn")
        .forEach(btn => {
            btn.disabled = true;
            btn.innerHTML = `✅ Run ${result.runId} `;
        });

    add(`
        <div class="workflow-complete">
        ✅ Workflow Submitted
        <br><br>
            Run ID: ${result.runId}
        </div>
    `, "ai", false);
}

async function executePinnaclePlan(plan, context) {

    for (const step of plan) {

        switch (step.action) {

            case "editProvider":
                await EditProvider(
                    context.page,
                    step.odsCode
                );
                break;

            case "changeTelephone":
                await ChangeTelephone(
                    context.page,
                    step.variables.TELEPHONE
                );
                break;
        }

    }
}
