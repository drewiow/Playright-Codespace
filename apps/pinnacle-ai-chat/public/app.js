const messages = document.getElementById("messages");

window.conversation = {
    action: null,
    collected: {},
    currentQuestion: 0
};

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

function renderUserResults(users) {

    const recommendedUser = users[0];
    const others = users.slice(1);

    return `
        <div class="recommended-user-card">

            <h4>⭐ Recommended User</h4>

            <div class="workflow-step">

                <span>
                    ${recommendedUser.displayName}
                    (${recommendedUser.username})
                </span>

                <button
                    class="select-user-btn"
                    data-uid="${recommendedUser.uid}"
                    data-name="${recommendedUser.displayName}"
                    data-username="${recommendedUser.username}"
                    data-editurl="${recommendedUser.editUrl}">

                    Use Recommended

                </button>

            </div>

        </div>

        ${others.length
            ? `
                <h4>Other Matches</h4>
                ${others.map(user => `
                    <div class="workflow-step">
                        <span>
                            👤 ${user.displayName}
                            (${user.username})
                        </span>

                        <button
                            class="select-user-btn"
                            data-uid="${user.uid}"
                            data-name="${user.displayName}"
                            data-username="${user.username}"
                            data-editurl="${user.editUrl}">
                            Select
                        </button>
                    </div>
                `).join("")}
                `
            : ""
        }
    `;
}
async function processResponse(data) {

    if (
        data.type ===
        "userLookupRequired"
    ) {

        window.pendingPlan = data.plan;

        add(`
            <div class="ai-message">
                Sure, I can help with that.
                <br><br>
                I'll need to find the user first.
                <br><br>
                <button
                    class="find-user-btn"
                    data-username="${data.username}">
                    🔍 Find User
                </button>
            </div>
        `, "ai", false);

        return;
    }

    if (data.type === "userSearch") {

        add(
            renderUserSearchResults(
                data.users
            ),
            "ai",
            false
        );

        return;
    }

    if (data.type === "collect-info") {

        window.conversation = {
            action: data.action,
            collected: {},
            currentQuestion: 0
        };

        add(`
        <div class="ai-message">
            ${data.question}
        </div>
    `, "ai", false);

        return;
    }

    window.currentPlan = data.plan;

    add(
        renderWorkflow(
            data.workflow
        ),
        "ai",
        false
    );
}
async function send() {

    const start = Date.now();
    const thinkingId = addThinking();

    const input =
        document.getElementById(
            "messageInput"
        );

    const text =
        input.value.trim();

    if (!text) {

        removeThinking(
            thinkingId
        );

        return;
    }

    add(text, "user");

    input.value = "";

    let message = text;

    if (window.conversation?.action) {

        const username = text;

        message =
            `reset ${username} mfa`;

        window.conversation = {
            action: null,
            collected: {},
            currentQuestion: 0
        };
    }

    const res = await fetch(
        "/api/chat",
        {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/json"
            },
            body: JSON.stringify({
                message
            })
        }
    );

    const data =
        await res.json();

    const elapsed =
        Date.now() - start;

    if (elapsed < 1000) {

        await new Promise(
            r => setTimeout(
                r,
                1000 - elapsed
            )
        );

    }

    removeThinking(
        thinkingId
    );

    await processResponse(
        data
    );
}

function addThinking() {

    const id =
        crypto.randomUUID();

    const d =
        document.createElement("div");

    d.id = id;

    d.className =
        "msg ai";

    d.innerHTML = `
        <div class="bubble thinking">

            <span></span>
            <span></span>
            <span></span>

        </div>
    `;

    messages.appendChild(d);

    return id;
}

function removeThinking(id) {

    document
        .getElementById(id)
        ?.remove();

}

function renderWorkflowSteps(
    workflow
) {

    return workflow
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
}

async function findUsers(username) {

    const res =
        await fetch(
            "http://localhost:3000/api/pinnacle/find-user",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    username
                })
            }
        );

    return await res.json();
}

function renderUserSearchResults(users) {

    return `
        <div class="ai-message">

            I found
            ${users.length}
            matching users.

            <br><br>

            ${renderUserResults(users)}

        </div>
    `;
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

    if (
        e.target.classList.contains(
            "find-user-btn"
        )
    ) {

        console.log("Finding user");

        const username = e.target.dataset.username;
        const users = await findUsers(username);

        add(
            renderUserSearchResults(users),
            "ai",
            false
        );

        return;
    }

    if (
        e.target.classList.contains(
            "select-user-btn"
        )
    ) {

        const selectedUser = {
            uid: e.target.dataset.uid,
            displayName: e.target.dataset.name,
            username: e.target.dataset.username,
            editUrl: e.target.dataset.editurl
        };

        window.currentPlan = [
            {
                action: "openUser",
                user: selectedUser
            },
            ...window.pendingPlan.filter(
                step => step.action !== "findUser"
            )
        ];

        const workflowResponse =
            await fetch(
                "/api/workflow",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        plan: window.currentPlan
                    })
                }
            );

        const workflow =
            await workflowResponse.json();

        console.log(
            "Current Plan:",
            window.currentPlan
        );

        add(
            renderWorkflow(workflow),
            "ai",
            false
        );
    }

    if (
        !e.target.classList.contains(
            "execute-btn"
        )
    ) {
        return;
    }

    await executeWorkflow();

});

function renderWorkflow(
    workflow
) {

    return `
        <div class="workflow">

            <strong>
                Proposed Workflow
            </strong>

            <div class="workflow-list">
                ${renderWorkflowSteps(workflow)}
            </div>

            <button class="execute-btn">
                🚀 Execute Workflow
            </button>

        </div>
    `;
}

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

    await res.json();

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
