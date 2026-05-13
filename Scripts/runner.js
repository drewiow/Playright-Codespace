import { marked } from "/vendor/marked/lib/marked.esm.js";

const artifactList = document.getElementById("artifactList");
const logContainer = document.getElementById("logContainer");
const runnerRoot = document.getElementById("runnerRoot");


// Parse URL path: /run/<product>/<scriptId>
const parts = window.location.pathname.split("/");
const product = parts[2];
const scriptId = parts[3];

if (!product || !scriptId) {
    console.error("Missing product or script in URL", parts);
}


document.addEventListener("DOMContentLoaded", () => {
    initRunner();
    runnerRoot.classList.add("wizard-mode");
});


let lastLogLength = 0;

let wizardState = {
    stepIndex: 0,
    steps: [],

    env: { ready: false },
    csv: { ready: false },
    options: { ready: true },
    advanced: { ready: true },
};

let wizardStarted = false;

const WIZARD_STEP_META = {
    env: {
        title: "Unlock access",
        subtitle: "Provide your encrypted environment file and passphrase to continue"
    },

    csv: {
        title: "Select data",
        subtitle: "Choose the CSV file that defines the records this script will process"
    },

    inputs: {
        title: "Script inputs",
        subtitle: "Enter the information required by this script to run correctly"
    },

    actions: {
        title: "Automation steps",
        subtitle: "Define the actions this script should perform"
    },

    behaviour: {
        title: "Run behaviour",
        subtitle: "Control how the automation behaves while it runs"
    },

    review: {
        title: "Review & run",
        subtitle: "Check your selections before starting the automation"
    }
};

document
    .getElementById("startWizardBtn")
    .addEventListener("click", () => {
        wizardStarted = true;
        console.log("[Wizard] Started");
        document.getElementById("scriptOverview").classList.add("hidden");
        document.getElementById("wizardContainer").classList.remove("hidden");

        document
            .getElementById("runnerRoot")
            .classList.add("wizard-mode");

        wizardState.stepIndex = 0;
        renderWizardStep();
    });

function renderWizardHeader() {
    const headerEl = document.getElementById("wizardHeader");
    if (!headerEl) return;

    const stepKey = getCurrentStep();
    const stepMeta = WIZARD_STEP_META[stepKey];

    const stepIndex = wizardState.stepIndex + 1;
    const totalSteps = wizardState.steps.length;

    headerEl.innerHTML = `
        <div class="wizard-header-inner">
            <div class="wizard-progress">
                Step ${stepIndex} of ${totalSteps}
            </div>
            <div class="wizard-title">
                ${stepMeta?.title ?? stepKey}
            </div>
            <div class="wizard-subtitle">
                ${stepMeta?.subtitle ?? ""}
            </div>
        </div>
    `;
}

function goToNextStep() {
    const step = getCurrentStep();

    if (step === "inputs" && !areInputsValid()) {
        alert("Please complete all required inputs.");
        return;
    }

    if (getCurrentStep() === "inputs" && !areInputsValid()) {
        alert("Please complete all required inputs before continuing.");
        return;
    }

    wizardState.stepIndex++;
    renderWizardStep();
}


function goToPreviousStep() {
    if (wizardState.stepIndex > 0) {
        wizardState.stepIndex--;
        renderWizardStep();
    }
}

const backBtn = document.getElementById("wizardBackBtn");
if (backBtn) {
    backBtn.addEventListener("click", goToPreviousStep);
}

const nextBtn = document.getElementById("wizardNextBtn");
if (nextBtn) {
    nextBtn.addEventListener("click", goToNextStep);
}


function renderWizardStep() {
    if (!wizardStarted) return;
    const step = getCurrentStep();
    console.log("[Wizard] Rendering step:", step);

    // Panels
    const envPanel = document.getElementById("envPanel");
    const csvPanel = document.getElementById("csvPanel");
    const advancedPanel = document.getElementById("advancedPanel");
    const optionsPanel = document.querySelector(".options-panel");
    const inputsPanel = document.getElementById("inputsPanel");
    const actionsPanel = document.getElementById("actionsPanel");
    const behaviourPanel = document.getElementById("behaviourPanel");
    const reviewPanel = document.getElementById("reviewPanel");

    // Navigation buttons
    const backBtn = document.getElementById("wizardBackBtn");
    const nextBtn = document.getElementById("wizardNextBtn");
    const runBtn = document.getElementById("runScriptBtn");

    // ---- Hide all panels first ----
    if (envPanel) envPanel.style.display = "none";
    if (csvPanel) csvPanel.style.display = "none";
    if (advancedPanel) advancedPanel.style.display = "none";
    if (optionsPanel) optionsPanel.style.display = "none";
    if (inputsPanel) inputsPanel.style.display = "none";
    if (actionsPanel) actionsPanel.style.display = "none";
    if (behaviourPanel) behaviourPanel.style.display = "none";
    if (reviewPanel) reviewPanel.style.display = "none";

    renderWizardHeader();

    // ---- Step-specific panels ----
    if (step === "env") {
        if (envPanel) envPanel.style.display = "";
    }

    if (step === "csv") {
        if (csvPanel) csvPanel.style.display = "";
    }

    if (step === "inputs") {
        if (inputsPanel && window.hasScriptInputs) {
            inputsPanel.style.display = "";
        }
    }

    if (step === "options") {
        if (optionsPanel) optionsPanel.style.display = "";
        if (advancedPanel) advancedPanel.style.display = "";
    }

    if (step === "actions") {
        if (actionsPanel) actionsPanel.style.display = "";
    }

    if (step === "behaviour") {
        if (behaviourPanel) behaviourPanel.style.display = "";
    }

    if (step === "review") {
        renderReview();

        if (envPanel) envPanel.style.display = "none";
        if (csvPanel) csvPanel.style.display = "none";
        if (optionsPanel) optionsPanel.style.display = "none";
        if (advancedPanel) advancedPanel.style.display = "none";
        if (reviewPanel) reviewPanel.style.display = "";
    }

    // ---- Navigation visibility ----
    if (backBtn) {
        backBtn.style.display =
            wizardState.stepIndex === 0 ? "none" : "";
    }

    if (nextBtn) {
        nextBtn.style.display =
            step === "review" ? "none" : "";
    }

    if (runBtn) {
        runBtn.style.display =
            step === "review" ? "" : "none";
    }
}

function areInputsValid() {
    if (!window.hasScriptInputs) return true;

    const controls = document.querySelectorAll(
        "#scriptInputs input, #scriptInputs select, #scriptInputs textarea"
    );

    return Array.from(controls).every(el => {
        if (!el.required) return true;
        return el.value && el.value.trim() !== "";
    });
}

async function loadScriptMeta(product, scriptId) {
    const res = await fetch(`/scripts/${product}/${scriptId}/meta.json`);
    const meta = await res.json();

    window.currentScriptMeta = meta;
    window.hasScriptInputs =
        Array.isArray(meta.inputs) && meta.inputs.length > 0;

    renderScriptInputs(meta);
    maybeInsertInputsStep();
}

function renderScriptInputs(meta) {
    const container = document.getElementById("scriptInputs");
    if (!container) return;

    container.innerHTML = "";

    if (!Array.isArray(meta.inputs) || meta.inputs.length === 0) {
        return;
    }

    meta.inputs.forEach(input => {
        const field = document.createElement("div");
        field.className = "field";

        const label = document.createElement("label");
        label.textContent = input.label;
        label.setAttribute("for", `input-${input.key}`);

        let control;

        switch (input.type) {
            case "select":
                control = document.createElement("select");
                if (Array.isArray(input.options)) {
                    input.options.forEach(opt => {
                        const option = document.createElement("option");
                        option.value = opt.value ?? opt;
                        option.textContent = opt.label ?? opt;
                        control.appendChild(option);
                    });
                }
                break;

            case "textarea":
                control = document.createElement("textarea");
                break;

            default:
                control = document.createElement("input");
                control.type = input.type || "text";
        }

        control.id = `input-${input.key}`;
        control.name = input.key;

        if (input.placeholder) {
            control.placeholder = input.placeholder;
        }

        if (input.required) {
            control.required = true;
        }

        field.appendChild(label);
        field.appendChild(control);
        container.appendChild(field);
    });
}

function maybeInsertInputsStep() {
    if (!window.hasScriptInputs) return;

    const steps = wizardState.steps;

    // Prefer inserting before actions, otherwise before review
    const insertIndex = steps.includes("actions")
        ? steps.indexOf("actions")
        : steps.indexOf("review");

    if (!steps.includes("inputs")) {
        steps.splice(insertIndex, 0, "inputs");
    }
}

function getCurrentStep() {
    return wizardState.steps[wizardState.stepIndex];
}

function getWizardSteps(script) {
    const steps = [];

    // 1. Credentials / Unlock
    if (script.requiresEnvFile || script.requiresPassword) {
        steps.push("env");
    }

    // 2. Data source
    if (script.requiresCsv) {
        steps.push("csv");
    }

    // 3. Script-specific inputs (manifest-driven)
    // These define WHAT the script operates on
    if (script.inputs && script.inputs.length > 0) {
        steps.push("inputs");
    }

    // 4. Automation / Actions
    // Defines WHAT actions are performed per row or run
    if (script.actions || script.advanced) {
        steps.push("actions");
    }

    // 5. Run behaviour / Execution options
    // Defines HOW the automation behaves (safety, visibility, speed)
    if (script.showOptionsPanel) {
        steps.push("behaviour");
    }

    // 6. Final confirmation
    steps.push("review");

    return steps;
}

async function initRunner() {

    const parts = window.location.pathname.split("/");

    // parts[0] = ""
    // parts[1] = "run"
    // parts[2] = product
    // parts[3] = scriptId

    const product = parts[2];
    const scriptId = parts[3];

    if (!product || !scriptId) {
        console.error("Missing product or script in URL", parts);
    }

    //startLogStream(product, scriptId);

    try {
        const manifest = await loadManifest(product);
        const script = manifest.scripts.find(s => s.id === scriptId);

        window.currentScript = script;
        wizardState.steps = getWizardSteps(script);
        wizardState.stepIndex = 0;

        console.log("[Wizard] Steps:", wizardState.steps);
        console.log("[Wizard] Current step:", getCurrentStep());



        if (!script) {
            console.error("Script not found in manifest:", scriptId);
            return;
        }

        const productName = manifest?.name || manifest?.title || product;
        document.getElementById("breadcrumb").innerHTML =
            `Automation Runner <span class="crumb-sep">→</span> ${productName} <span class="crumb-sep">→</span> ${script.title || script.name || script.id}`;

        applyScriptRequirements(script);
        populateHeader(manifest, script);
        populateDescription(product, script);
        loadScriptMeta(product, scriptId);
        setupRunForm(product, script);
        SetupAdvancedUI();
        await loadManifest(product);
        renderWizardStep();

    } catch (err) {
        console.error("Runner init failed:", err);
    }
}


function SetupAdvancedUI() {
    console.log("[AdvancedUI] setup running");

    const inlineTextarea = document.getElementById("advancedSteps");


    function initAdvancedHelp() {
        const panel = document.getElementById("advanced-help-panel");
        const content = document.getElementById("advanced-help-content");
        const toggleBtn = document.getElementById("advanced-help-toggle");
        const closeBtn = document.getElementById("advanced-help-close");

        if (!panel || !content || !toggleBtn || !closeBtn) return;

        toggleBtn.addEventListener("click", () => {
            panel.classList.remove("hidden");
            panel.setAttribute("aria-hidden", "false");
        });

        closeBtn.addEventListener("click", () => {
            panel.classList.add("hidden");
            panel.setAttribute("aria-hidden", "true");
        });

        renderAdvancedHelpContent(content);
    }

    const ADVANCED_HELP_SECTIONS = [
        {
            title: "Quick Start",
            body: `
Advanced Mode runs one step per line, in order.

Example:
type #email user@example.com
click #save
wait .result
`.trim(),
        },
        {
            title: "Commands",
            body: `
click <selector>
type <selector> <text>
wait <selector>
select <selector> <option>
press <key>
`.trim(),
        },
        {
            title: "Selectors",
            body: `
#id           → best when available
.class        → use carefully
[name=email]  → very reliable
text=Save     → use as a fallback
`.trim(),
        }
    ];

    const ADVANCED_PRESETS = [
        {
            id: "make-dormant", label: "Make Site Dormant", steps: `# Make site dormant

# Deaccredit site
click a[href*="deaccredit"]
wait-for navigation

# Mark site as EX-COVID
type #inAccountRef EX_COVID

# Add audit journal entry
click span:has-text("+ Add new journal")
wait 200
type xpath=following-sibling::*[1] Case : {{CASE_REF}}
press Enter

# Save changes
click [value="Save"]
wait 500
`
        },

    ];

    const presetSelect = document.getElementById("advancedTemplateSelect");

    ADVANCED_PRESETS.forEach(preset => {
        const opt = document.createElement("option");
        opt.value = preset.id;
        opt.textContent = preset.label;
        presetSelect.appendChild(opt);
    });

    const ADVANCED_ACTIONS = [
        {
            group: "Fields",
            actions: [
                { id: "update-orgname", label: "Update Organisation Name", steps: `type #inOrganisationName {{ORGANISATION_NAME}} ` },
                { id: "update-identifier", label: "Update Identifier", steps: `type #inOrganisationIdentifier {{ORGANISATION_IDENTIFIER}} ` },
                { id: "update-branchNumber", label: "Update Branch Number", steps: `type #inBranch {{BRANCH_NUMBER}} ` },
                { id: "update-address", label: "Update Address", steps: `type #inAddress {{ADDRESS}} ` },
                { id: "update-cdb", label: "Update CDB Number", steps: `type #inCDBNumber {{CDB_NUMBER}} ` },
                { id: "change-ods   ", label: "Update ODS Code", steps: `type #inNHSCode {{ODS_CODE}} ` },
                { id: "change-telephone", label: "Update Telephone", steps: `type #inTelephone {{TELEPHONE}} ` },
                { id: "change-secure-email", label: "Update Secure Email", steps: `type #inSecureEmail {{SECURE_EMAIL}} ` },
                { id: "change-inAccountRef", label: "Update Account Reference", steps: `type #inAccountRef {{ACCOUNT_REF}} ` },
                {
                    id: "update-mesh", label: "Update Covid MESH Details", steps: `# Open MESH Mailbox settings
click text=[+] MESH Mailbox settings
wait 300

# Update primary MESH mailbox credentials
type input[name = "inMESHMailboxIDs[]"]: first - of - type {{MESH_USERNAME}}
wait 150
type input[name="inMESHMailboxPasswords[]"]: first - of - type {{MESH_PASSWORD}}`
                }
            ]
        },
        {
            group: "Navigation",
            actions: [
                { id: "save-provider", label: "Save Provider", steps: `click [value = "Save"]` }
            ]
        }
    ];

    const csvFileInput = document.getElementById("csvFile");

    function renderAdvancedHelpContent(container) {
        container.innerHTML = "";

        ADVANCED_HELP_SECTIONS.forEach((section) => {
            const sectionEl = document.createElement("section");

            const title = document.createElement("h4");
            title.textContent = section.title;

            const pre = document.createElement("pre");
            pre.textContent = section.body;

            sectionEl.appendChild(title);
            sectionEl.appendChild(pre);

            if (section.insertable) {
                const insertBtn = document.createElement("button");
                insertBtn.textContent = "Insert Example";
                insertBtn.addEventListener("click", () =>
                    insertSteps(section.body)
                );
                sectionEl.appendChild(insertBtn);
            }

            container.appendChild(sectionEl);
        });
    }

    function renderAdvancedActions(groups, containerEl, textareaEl) {
        containerEl.innerHTML = "";

        groups.forEach(group => {
            // Group header
            const heading = document.createElement("button");
            heading.type = "button";
            heading.className = "advanced-action-group-title";
            heading.textContent = `▶ ${group.group} `;

            // Group container (collapsed by default)
            const groupContainer = document.createElement("div");
            groupContainer.className = "advanced-action-group";
            groupContainer.style.display = "none";

            // Toggle behaviour
            heading.addEventListener("click", () => {
                const expanded = groupContainer.style.display === "block";
                groupContainer.style.display = expanded ? "none" : "block";
                heading.textContent = `${expanded ? "▶" : "▼"} ${group.group} `;
            });

            // Render actions
            group.actions.forEach(action => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "advanced-action-btn";
                btn.textContent = action.label;

                btn.addEventListener("click", () => {
                    insertSteps(textareaEl, action.steps.trim());
                });

                groupContainer.appendChild(btn);
            });

            containerEl.appendChild(heading);
            containerEl.appendChild(groupContainer);
        });
    }

    const actionsContainer = document.getElementById("advancedActions");
    renderAdvancedActions(
        ADVANCED_ACTIONS,
        actionsContainer,
        inlineTextarea
    );

    function renderTokenPanel(headers) {
        console.log("[Tokens] rendering", headers);

        const tokenListEl = document.getElementById("advancedTokenList");
        if (!tokenListEl) return;

        tokenListEl.innerHTML = "";

        headers.forEach(header => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = `{{${header}}} `;

            btn.addEventListener("click", () => {
                insertSteps(
                    inlineTextarea,
                    `{{${header}}} `
                );
            });

            tokenListEl.appendChild(btn);
        });
    }

    function insertSteps(textarea, text) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const normalized = text.trim() + "\n";

        textarea.value =
            textarea.value.slice(0, start) +
            normalized +
            textarea.value.slice(end);

        const pos = start + normalized.length;
        textarea.selectionStart = textarea.selectionEnd = pos;
        textarea.focus();
        updateHighlight();

    }

    console.log("[CSV] file", csvFileInput);

    if (csvFileInput) {
        csvFileInput.addEventListener("change", (e) => {
            handleCsvSelected(e);
        });
    }

    document.querySelectorAll("[data-action]").forEach(btn => {
        btn.addEventListener("click", () => {
            const action = ADVANCED_ACTIONS[btn.dataset.action];
            if (!action) return;

            insertSteps(inlineTextarea, action.steps);
        });
    });

    presetSelect.addEventListener("change", () => {
        const preset = ADVANCED_PRESETS.find(p => p.id === presetSelect.value);
        if (!preset) return;

        inlineTextarea.value = preset.steps;
        presetSelect.value = "";
    });

    const tokenListEl = document.getElementById("advancedTokenList");

    let csvHeaders = [];
    const TOKEN_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

    function handleCsvSelected(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = () => {
            const text = reader.result;
            csvHeaders = parseCsvHeaders(text);


            // Store globally for UI usage
            window.currentCsvHeaders = csvHeaders;

            // Update token panel if it exists
            renderTokenPanel(csvHeaders);
            updateHighlight();
        };

        reader.readAsText(file);
    }

    function buildHighlightedText(rawText, csvHeaders) {
        return rawText.replace(TOKEN_REGEX, (fullMatch, tokenName) => {
            const normalized = tokenName.toUpperCase();

            if (csvHeaders.includes(normalized)) {
                return fullMatch; // ✅ valid (case-insensitive)
            }

            return `<span class="invalid-token">${fullMatch}</span>`;
        });
    }

    const textarea = inlineTextarea
    const highlight = document.getElementById("advancedEditorHighlight");

    document.addEventListener("click", (e) => {
        const tokenEl = e.target.closest(".invalid-token");
        if (!tokenEl) return;

        showTokenPicker(tokenEl);
        e.preventDefault();
        e.stopPropagation();
    });


    textarea.addEventListener("input", updateHighlight);

    function updateHighlight() {
        const raw = textarea.value;
        const highlighted = buildHighlightedText(raw, csvHeaders);
        highlight.innerHTML = highlighted;
    }

    function positionNear(anchorEl, popupEl) {
        const rect = anchorEl.getBoundingClientRect();

        popupEl.style.position = "absolute";
        popupEl.style.left = rect.left + window.scrollX + "px";
        popupEl.style.top = rect.bottom + window.scrollY + 6 + "px";
    }

    let activeTokenPicker = null;

    function removeTokenPicker() {
        if (activeTokenPicker) {
            activeTokenPicker.remove();
            activeTokenPicker = null;
        }
    }

    function showTokenPicker(tokenEl) {
        removeTokenPicker();

        if (!csvHeaders.length) {
            console.warn("No CSV headers, picker not shown");
            return;
        }



        const picker = document.createElement("div");
        picker.className = "token-picker";

        console.log("Picker appended", picker);


        csvHeaders.forEach(header => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = `{{${header}}}`;
            btn.addEventListener("click", () => {
                replaceToken(tokenEl.textContent, header);
                removeTokenPicker();
            });
            picker.appendChild(btn);
        });

        document.body.appendChild(picker);

        const rect = tokenEl.getBoundingClientRect();
        picker.style.position = "absolute";
        picker.style.left = rect.left + window.scrollX + "px";
        picker.style.top = rect.bottom + window.scrollY + 6 + "px";
        picker.style.zIndex = 2001;

        activeTokenPicker = picker;

        setTimeout(() => {
            document.addEventListener("click", onOutsideTokenPickerClick);
        }, 0);
    }

    function onOutsideTokenPickerClick(e) {
        if (e.target.closest(".token-picker")) return;
        if (e.target.closest(".invalid-token")) return;

        removeTokenPicker();
        document.removeEventListener("click", onOutsideTokenPickerClick);
    }

    function replaceToken(oldTokenText, newTokenName) {
        const newToken = `{{${newTokenName.toUpperCase()}}}`;

        textarea.value = textarea.value.replace(oldTokenText, newToken);

        updateHighlight();
        textarea.focus();
    }

    function parseCsvHeaders(csvText) {
        const firstLine = csvText.split(/\r?\n/)[0];
        if (!firstLine) return [];

        return firstLine
            .split(",")
            .map(h => h.trim().toUpperCase()) // ✅ normalize here
            .filter(Boolean);
    }

    initAdvancedHelp();
}

function applyScriptRequirements(script) {
    const envFileInput = document.getElementById("runnerEnvFile");
    const envFileField = envFileInput.closest(".field");

    const passInput = document.getElementById("decryptPassword");
    const passField = passInput.closest(".field");

    const csvInput = document.getElementById("csvFile");
    const csvField = csvInput.closest(".field");

    const optionsPanel = document.querySelector(".options-panel");
    const advancedPanel = document.getElementById("advancedPanel");

    if (advancedPanel) {
        if (script.advanced === true) {
            advancedPanel.style.display = "";
        } else {
            advancedPanel.style.display = "none";
        }
    }

    if (optionsPanel) {
        if (script.showOptionsPanel === false) {
            optionsPanel.style.display = "none";
        } else {
            optionsPanel.style.display = "";
        }
    }

    if (!script.requiresCsv) {
        csvField.style.display = "none";
        csvInput.required = false;
    } else {
        csvInput.required = true;
    }

    // CASE 1: Script requires env file
    if (script.requiresEnvFile) {
        envFileField.style.display = "";
        passField.style.display = "";
        envFileInput.required = true;
        passInput.required = true;
        return;
    }

    // CASE 2: Script optionally uses env file
    if (script.optionalEnvFile) {
        envFileField.style.display = "";
        passField.style.display = "";
        envFileInput.required = false;
        passInput.required = false;
        return;
    }

    // CASE 3: Script does not use env files
    envFileField.style.display = "none";
    passField.style.display = "none";
    envFileInput.required = false;
    passInput.required = false;
}

async function loadManifest(product) {
    const res = await fetch(`/api/products/${product}/manifest`);

    if (!res.ok) {
        throw new Error(`Failed to load manifest for ${product}`);
    }

    return await res.json();
}

function populateHeader(manifest, script) {
    const titleEl = document.getElementById("scriptTitle");
    titleEl.textContent = script.title || script.name || script.id;
}

function renderReview() {
    document.getElementById("reviewScriptName").textContent =
        currentScriptMeta?.title || scriptId;

    const script = window.currentScript;

    // Inputs
    const inputsEl = document.getElementById("reviewInputs");
    inputsEl.innerHTML = "";

    if (window.currentScriptMeta?.inputs) {
        window.currentScriptMeta.inputs.forEach(input => {
            const el = document.getElementById(`input-${input.key}`);
            const value = el ? el.value : "—";

            const row = document.createElement("div");
            row.textContent = `${input.label}: ${value}`;
            inputsEl.appendChild(row);
        });
    }

    const optionsSection = document.getElementById("reviewOptionsSection");
    const optionsEl = document.getElementById("reviewOptions");

    if (script?.showOptionsPanel) {
        optionsSection.style.display = "";

        const content = [];

        const humanModeEl = document.getElementById("humanMode");
        if (humanModeEl?.checked) content.push("Human-like mode enabled");
        if (humanModeEl?.checked) {
            const humanIntensityEl = document.getElementById("humanIntensity");
            if (humanIntensityEl && humanIntensityEl.value) {
                content.push(`Human-like interactions: ${humanIntensityEl.value || "default"}`);
            }
        }
        const showBrowserEl = document.getElementById("showBrowser");
        if (showBrowserEl?.checked) content.push("Browser visible");

        const recordVideoEl = document.getElementById("recordVideo");
        if (recordVideoEl?.checked) content.push("Recording video");

        const recordTraceEl = document.getElementById("recordTrace");
        if (recordTraceEl?.checked) content.push("Recording trace");

        const dryRunEl = document.getElementById("dryRun");
        if (dryRunEl?.checked) content.push("Dry run enabled");

        optionsEl.textContent =
            content.length > 0 ? content.join(", ") : "Default behaviour";

    } else {
        optionsSection.style.display = "none";
    }

}


async function populateDescription(product, script) {
    const descEl = document.getElementById("descriptionContent");

    try {
        const res = await fetch(`/api/products/${product}/scripts/${script.id}/description`);
        if (res.ok) {
            const markdown = await res.text();
            descEl.innerHTML = marked.parse(markdown);
        } else {
            descEl.textContent = "No description available.";
        }
    } catch (err) {
        console.error("Failed to load description:", err);
        descEl.textContent = "Failed to load description.";
    }
}

async function startRun(product, script, formData) {
    const status = document.getElementById("runStatus");

    if (status) {
        status.textContent = "Starting run…";
    }

    try {
        const res = await fetch(
            `/api/run/${encodeURIComponent(product)}/${encodeURIComponent(script.id)}`,
            {
                method: "POST",
                body: formData,
                credentials: "include"
            }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            console.error("Run start error:", data);

            if (status) {
                status.textContent = data.error || "Run failed to start.";
            }

            // Hide stop button — run never started
            document.getElementById("stopRunContainer")?.classList.add("hidden");
            return;
        }

        if (status) {
            status.textContent = data.message || "Run started.";
        }

        if (data.runId) {
            window.currentRunId = data.runId;

            // Show stop button
            document.getElementById("stopRunContainer")?.classList.remove("hidden");
        }

    } catch (err) {
        console.error("Run failed:", err);

        if (status) {
            status.textContent = "Run failed.";
        }

        document.getElementById("stopRunContainer")?.classList.add("hidden");
    } finally {
        // Clear password after run
        const passEl = document.getElementById("decryptPassword");
        if (passEl) passEl.value = "";
    }
}

function enterExecutionMode() {
    console.log("Entering execution mode");

    const root = document.getElementById("runnerRoot");
    const wizard = document.getElementById("wizardContainer");
    const execution = document.getElementById("executionContainer");

    // Ensure layout switches to execution view if needed
    if (root) {
        root.classList.remove("wizard-mode");
    }

    // Hide wizard UI
    if (wizard) {
        wizard.classList.add("hidden");
    }

    // Show execution/logs UI
    if (execution) {
        execution.classList.remove("hidden");
    }
}


function setupRunForm(product, script) {
    console.log("setupRunForm CALLED");

    const form = document.getElementById("run-form");
    if (!form) {
        console.warn("run-form not found");
        return;
    }

    const envFileInput = document.getElementById("runnerEnvFile");
    const csvFileInput = document.getElementById("csvFile");
    const advancedStepsEl = document.getElementById("advancedSteps");

    const stopRunButton = document.getElementById("stopRunButton");
    if (stopRunButton) {
        stopRunButton.addEventListener("click", async () => {
            if (!currentRunId) return;

            stopRunButton.disabled = true;
            stopRunButton.textContent = "Stopping…";

            await fetch(`/api/run/${currentRunId}/stop`, {
                method: "POST",
                credentials: "include"
            });

            stopRunButton.textContent = "Stopping…";
        });
    } else {
        console.warn("stopRunButton not present (expected before execution)");
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        enterExecutionMode();

        const options = currentScriptMeta?.showOptionsPanel
            ? {
                humanMode: document.getElementById("humanMode")?.checked ?? false,
                humanIntensity: document.getElementById("humanIntensity")?.value,
                showBrowser: document.getElementById("showBrowser")?.checked ?? false,
                recordVideo: document.getElementById("recordVideo")?.checked ?? false,
                recordTrace: document.getElementById("recordTrace")?.checked ?? false,
                autoScrollLogs: true,
                clearLogsOnRun: document.getElementById("clearLogsOnRun")?.checked ?? false,
                dryRun: document.getElementById("dryRunCheckbox")?.checked ?? true,
            } : { autoScrollLogs: true };

        const formData = new FormData();

        if (script.advanced && advancedStepsEl?.value.trim()) {
            formData.append("advancedSteps", advancedStepsEl.value.trim());
        }

        if (envFileInput?.files?.length) {
            formData.append("envFile", envFileInput.files[0]);
        }

        if (csvFileInput?.files?.length) {
            formData.append("csvFile", csvFileInput.files[0]);
        }

        const passphrase = document.getElementById("decryptPassword")?.value;
        if (passphrase) {
            formData.append("passphrase", passphrase);
        }

        formData.append("options", JSON.stringify(options));

        if (window.currentScriptMeta?.inputs) {
            window.currentScriptMeta.inputs.forEach(input => {
                const el = document.getElementById(`input-${input.key}`);
                if (el) {
                    formData.append(input.key, el.value);
                }
            });
        }

        await startRun(product, script, formData);
    });
}

function updateLogs(jobData) {
    const log = jobData.log || [];
    if (log.length === lastLogLength) return;

    for (let i = lastLogLength; i < log.length; i++) {
        const entry = log[i];
        const div = document.createElement("div");
        div.classList.add("log-entry");

        const time = new Date(entry.time);
        const timeStr = time.toLocaleTimeString();

        const line = entry.line;

        let levelClass = "log-info";

        if (line.includes("✅")) levelClass = "log-success";
        else if (line.includes("❌")) levelClass = "log-error";
        else if (line.includes("➡️")) levelClass = "log-action";
        else if (line.includes("👤")) levelClass = "log-user";
        else if (line.includes("🛠")) levelClass = "log-job";

        div.classList.add(levelClass);
        div.innerHTML = `<span class="log-time">${timeStr}</span><span class="log-text">${escapeHtml(
            line
        )}</span>`;

        logContainer.appendChild(div);
    }

    lastLogLength = log.length;
    logContainer.scrollTop = logContainer.scrollHeight;
}

function updateStatusAndArtifacts(jobData) {
    const status = jobData.status;
    const runDirName = jobData.runDirName;

    if (status === "queued") {
        const posText =
            jobData.position && jobData.position > 0
                ? ` You are #${jobData.position} in the queue.`
                : "";
        runStatus.textContent = `Run #${jobData.id} queued.${posText}`;
    } else if (status === "running") {
        runStatus.textContent = `Run #${jobData.id} is in progress...`;
    } else if (status === "completed") {
        runStatus.textContent = `Run #${jobData.id} completed.`;
    } else if (status === "failed") {
        runStatus.textContent = `Run #${jobData.id} failed. Check logs.`;
    }

    artifactList.innerHTML = "";
    if (!runDirName) return;

    const baseUrl = `/runs/${window.scriptFolder}/${runDirName}`;

    const items = [
        {
            label: "Results CSV",
            href: `${baseUrl}/UsersAdded.csv`,
        },
        {
            label: "Trace file",
            href: `${baseUrl}/trace.zip`,
        },
    ];

    items.forEach((item) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = item.href;
        a.textContent = item.label;
        a.target = "_blank";
        li.appendChild(a);
        artifactList.appendChild(li);
    });

    // Fetch video list dynamically
    fetch(`/api/videos/${window.scriptFolder}/${runDirName}`)
        .then(res => res.json())
        .then(files => {
            if (!files.length) return;

            const videosHeader = document.createElement("li");
            videosHeader.textContent = "Videos:";
            artifactList.appendChild(videosHeader);

            files.forEach(file => {
                const li = document.createElement("li");
                const a = document.createElement("a");

                a.href = `/runs/${window.scriptFolder}/${runDirName}/videos/${file}`;
                a.textContent = file;
                a.target = "_blank";

                li.appendChild(a);
                artifactList.appendChild(li);
            });
        })
        .catch(err => console.error("Video fetch error:", err));
}

function resetUI() {
    currentJobId = null;
    lastLogLength = 0;
    logContainer.innerHTML = "";
    artifactList.innerHTML = "";
    queueList.innerHTML = "";
    runStatus.textContent = "";
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

