const messages = document.getElementById("messages");

resetConversation();

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

    console.log("LOOOKUP TYPE : ", data.lookupType);

    if (data.type === "capabilities") {

        const grouped = {};

        for (const action of data.capabilities) {

            if (!grouped[action.category]) {
                grouped[action.category] = [];
            }

            grouped[action.category].push(action);
        }

        add(`
        <div class="ai-message">
            🤖 I can help with the following tasks:
            <br><br>

            ${Object.entries(grouped).map(([category, actions]) => `
                <strong>${category}</strong>
                <br><br>

                ${actions.map(action => `
                    <div class="workflow-step">
                        <span>
                            ${action.icon ?? "⚙️"}
                            ${action.label}
                        </span>
                        <br>
                        <small>${action.description}</small>
                    </div>
                `).join("")}

                <br>
            `).join("")}
        </div>
    `, "ai", false);

        return;
    }

    if (data.type === "question") {

        window.conversation.field =
            data.field;

        add(`
        <div class="ai-message">
            ${data.question}
        </div>
    `, "ai", false);

        return;
    }

    if (data.type === "unknown-intent") {

        add(`
        <div class="ai-message">
            🤔 Sorry, I don't know how to process:
            <br><br>
            <strong>"${data.message}"</strong>
            <br><br>
            You could try one of these:
            <br><br>

            ${data.suggestions.map(action => `
                <div class="workflow-step">
                    <span>
                        ${action.icon ?? "⚙️"}
                        ${action.label}
                    </span>
                </div>
            `).join("")}

            <br>
            Or ask:
            <br><br>
            <strong>What can you do?</strong>
        </div>
    `, "ai", false);

        return;
    }

    if (data.type === "lookupRequired" && data.lookupType === "user") {

        console.log("USER LOOKUP HANDLER HIT");

        const thinkingId =
            addThinking();

        await new Promise(
            resolve => setTimeout(
                resolve,
                500
            )
        );

        removeThinking(
            thinkingId
        );

        add(`
        <div class="ai-message">
            Sure, I can help with that.
            <br><br>
            I'll need to find the user first.
            <br><br>
            <button
                class="find-user-btn"
                data-username="${data.search}">
                🔍 Find User
            </button>
        </div>
    `, "ai", false);

        return;
    }

    if (data.type === "lookupRequired" && data.lookupType === "fundingService") {

        window.pendingPlan = data.plan;
        console.log(data);


        add(`

        <div class="ai-message">
            I need to find the services, this might take a minute.
            <br><br>
            <button
                class="find-funding-service-btn"
                data-search="${data.search}">
                🔍 Find Services
            </button>
        </div>
    `, "ai", false);

        return;
    }

    if (data.type === "lookupRequired" && data.lookupType === "service") {

        window.pendingPlan = data.plan;

        add(`

        <div class="ai-message">
            I need to find the service.
            <br><br>
            <button
                class="find-service-btn"
                data-search="${data.search}">
                🔍 Find Services
            </button>
        </div>
    `, "ai", false);

        return;
    }

    if (data.type === "userLookupRequired") {

        const thinkingId =
            addThinking();

        await new Promise(
            resolve => setTimeout(
                resolve,
                500
            )
        );

        removeThinking(
            thinkingId
        );

        window.pendingPlan = data.plan;

        add(`
        <div class="ai-message" >
            Sure, I can help with that.
            <br> <br>
                I'll need to find the user first.
                <br><br>
                    <button
                        class="find-user-btn"
                        data-username="${data.username}">
                        🔍 Find User
                    </button>
                </div>
                    `, "ai", false);

        resetConversation();

        return;
    }

    if (data.type === "userSearch") {

        console.log(
            "Rendering lookup:",
            data.search
        );


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
            field: null,
            collected: {},
            currentQuestion: 0
        };

        const result =
            await callApi(
                "/api/conversation",
                window.conversation
            );

        if (result.type === "lookupRequired") {

            await processResponse(result);
            return;
        }

        window.conversation.field =
            result.field;

        console.log(
            "Rendering question:",
            result.question
        );

        add(`
    <div class="ai-message">
        ${result.question}
    </div>
`, "ai", false);

    }
}


function resetConversation() {

    window.conversation = {
        action: null,
        collected: {},
        field: null,
        currentQuestion: 0
    };

}

async function send() {

    const start = Date.now();
    const input = document.getElementById("messageInput");
    const text = input.value.trim();

    if (!text) {
        return;
    }

    add(text, "user");

    input.value = "";

    let message = text;
    console.log(
        "Conversation Active:",
        window.conversation
    );

    if (window.conversation?.action) {

        window.conversation.collected[window.conversation.field] = text;

        const response =
            await fetch(
                "/api/conversation",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify(
                        window.conversation
                    )
                }
            );

        const result = await response.json();

        if (!result.complete) {

            await processResponse(result);

            if (result.field) {
                window.conversation.field =
                    result.field;
            }

            return;
        }


        if (
            result.type ===
            "userLookupRequired"
        ) {

            window.pendingPlan =
                result.plan;

            add(`
                    <div class="ai-message">
                        Sure, I can help with that.
                        <br><br>
                            I'll need to find the user first.
                            <br><br>
                                <button
                                    class="find-user-btn"
                                    data-username="${result.username}">
                                    🔍 Find User
                                </button>
                            </div>
                                `, "ai", false);

            resetConversation();
            return;
        }

        const plan = result.plan;
        window.currentPlan = plan;

        resetConversation();

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
                        plan
                    })
                }
            );

        const workflow = await workflowResponse.json();

        add(
            renderWorkflow(workflow),
            "ai",
            false
        );

        return;

    }

    resetConversation();

    const data =
        await callApi(
            "/api/chat",
            { message }
        );


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
    removeThinking();
    await processResponse(
        data
    );
}

document
    .getElementById("messageInput")
    .addEventListener(
        "keydown",
        e => {

            if (
                e.key === "Enter"
                &&
                !e.shiftKey
            ) {

                e.preventDefault();

                send();

            }

        }
    );

document
    .getElementById("env-passphrase")
    .addEventListener(
        "keydown",
        e => {

            if (e.key === "Enter") {

                e.preventDefault();

                loadEnvironment();

            }

        }
    );

function addThinking() {

    const id = crypto.randomUUID();
    const d = document.createElement("div");

    d.id = id;

    d.className = "msg ai";

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

async function callApi(url, body) {

    const thinkingId = addThinking();
    const start = Date.now();

    try {

        const response =
            await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify(body)
            });

        const data =
            await response.json();

        const elapsed =
            Date.now() - start;

        if (elapsed < 500) {

            await new Promise(
                resolve => setTimeout(
                    resolve,
                    500 - elapsed
                )
            );

        }

        return data;

    } finally {

        removeThinking(
            thinkingId
        );

    }
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

async function findFundingServices(commissionerName) {

    const res =
        await fetch(
            "http://localhost:3000/api/pinnacle/find-funding-service",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    commissionerName
                })
            }
        );


    const text = await res.text();

    return JSON.parse(text);
}

async function findServices(serviceName) {

    const res =
        await fetch(
            "http://localhost:3000/api/pinnacle/find-service",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    serviceName
                })
            }
        );


    const text = await res.text();

    return JSON.parse(text);
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

    if (e.target.classList.contains("find-user-btn")) {

        const username = e.target.dataset.username;
        const users = await findUsers(username);

        add(
            renderUserSearchResults(users),
            "ai",
            false
        );

        return;
    }

    if (e.target.classList.contains("find-funding-service-btn")) {

        const search = e.target.dataset.search;

        const services = await findFundingServices(search);

        add(
            renderServiceResults(
                services
            ),
            "ai",
            false
        );

        return;
    }

    if (e.target.classList.contains("find-service-btn")) {

        const search = e.target.dataset.search;

        const services = await findServices(search);

        console.log(
            "Services returned:",
            services
        );

        add(
            renderServiceResults(
                services
            ),
            "ai",
            false
        );

        return;
    }

    if (e.target.classList.contains("select-funding-service-btn")) {


        const selectedService = {
            fundingId: e.target.dataset.fundingid,
            serviceId: e.target.dataset.serviceid,
            serviceName: e.target.dataset.servicename,
            editServiceLink: e.target.dataset.editservicelink,
            commissionerName: window.conversation.collected.commissionerName,
            baseServiceName: e.target.dataset.baseservicename
        };

        window.currentPlan = [
            {
                action: "openFundingService",
                service: selectedService
            },
            {
                action: "openService",
                service: selectedService
            }
        ];


        console.log(
            JSON.stringify(
                window.currentPlan,
                null,
                2
            )
        );

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


    if (e.target.classList.contains("select-user-btn")) {

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

        console.log(
            "Selected User:",
            selectedUser
        );

        console.log(
            "New Plan:",
            JSON.stringify(
                window.currentPlan,
                null,
                2
            )
        );

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

window.toggleFundingConfig = function (index) {

    const panel =
        document.getElementById(
            `funding-config-${index}`
        );

    if (!panel) return;

    panel.style.display =
        panel.style.display === "none"
            ? "block"
            : "none";
};

window.togglePaymentRules = function (fundingId) {

    const panel = document.getElementById(
        `payment-rules-${fundingId}`
    );

    if (!panel) return;

    panel.style.display =
        panel.style.display === "none"
            ? "block"
            : "none";
};


function renderFundingServiceResult(service) {

    return `
        <div class="ai-message">

            <h3>💷 ${service.serviceName}</h3>

            ${service.fundingDefinitions.map(definition => `

                <div class="service-row">

                    <div class="service-header">
                        ${definition.serviceName}
                    </div>

                    <small>
                        Funding ID:
                        ${definition.fundingId}
                    </small>

                    <br><br>

                    ${definition.paymentRules?.map(rule => `

                        <div class="workflow-step">

                            💰 ${rule.question}

                            <br>

                            ${rule.amount}

                        </div>

                    `).join("") ?? ""}

                </div>

            `).join("")}

        </div>
    `;
}

function renderServiceResults(services) {

    console.log("Rendering services", services);

    console.log("FIRST SERVICE", services[0]);

    return `
        <div class="ai-message">

            I found ${services.length} matching Services.

            <br><br>

            ${services.map((service, index) => `
                
                <div class="service-row">
                    <div
                        class="service-header">
                        💷 ${service.baseServiceName}
                    </div>

                    <button
                        class="select-funding-service-btn"
                        data-fundingid="${service.fundingId}"
                        data-servicename="${service.serviceName}"
                        data-editservicelink="${service.editServiceLink}"
                        data-serviceid="${service.serviceId}">
                        Select
                    </button>

                </div>
            `).join("")}
        </div>
        `;
}

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

    const result = await res.json();

    document
        .querySelectorAll(".execute-btn")
        .forEach(btn => {
            btn.disabled = true;
            btn.innerHTML = `✅ Run ${result.runId} `;
        });

    console.log("Execute Result", result);

    if (result.fundingService) {

        add(
            renderFundingServiceResult(
                result.fundingService
            ),
            "ai",
            false
        );
    }

    if (result.service) {

        add(
            renderServiceQuestions(
                result.service
            ),
            "ai",
            false
        );
    }


}

function renderServiceQuestions(service) {

    const questions =
        service.questionHeaders.flat();

    return `
        <div class="ai-message">

            <h3>
                📋 Service Questions
            </h3>

            ${questions.map(question => `
                <div class="workflow-step">
                    ${question}
                </div>
            `).join("")}

        </div>
    `;
}

