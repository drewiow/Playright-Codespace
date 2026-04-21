document.addEventListener("DOMContentLoaded", () => {
    initRunner();
});

const artifactList = document.getElementById("artifactList");
const logContainer = document.getElementById("logContainer");
const params = new URLSearchParams(window.location.search);
const product = params.get("product")?.toLowerCase();
const script = params.get("script");

let lastLogLength = 0;

function startLogStream(product, scriptId) {
    const logContainer = document.getElementById("logContainer");

    const source = new EventSource(`/api/run/${product}/${scriptId}/logs`);

    source.onmessage = (event) => {
        let entry;

        try {
            entry = JSON.parse(event.data);
        } catch {
            entry = { time: new Date().toISOString(), line: event.data, stream: "stdout" };
        }
        if (!entry.line) return;

        const timestamp = new Date(entry.time).toLocaleTimeString();
        const message = entry.line;

        const div = document.createElement("div");
        div.className = `log-line log-${entry.stream}`;

        div.innerHTML = `<span class="log-timestamp">${timestamp}</span>
        <span class="log-message">${message}</span>`;

        logContainer.appendChild(div);

        if (document.getElementById("autoScrollLogs").checked) {
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    };

    source.onerror = () => {
        console.warn("Log stream disconnected");
        source.close();
    };
}

async function loadScriptMeta(product, script) {
    const res = await fetch(`/Scripts/${product}/${script}/meta.json`);
    const meta = await res.json();

    const container = document.getElementById("scriptInputs");
    container.innerHTML = ""; // keep the outer .field from HTML

    meta.inputs.forEach(input => {
        // this is the inner row, not the main field wrapper
        const row = document.createElement("div");
        row.className = "field";

        const label = document.createElement("label");
        label.textContent = input.label;

        let field;

        if (input.type === "select") {
            field = document.createElement("select");
            input.options.forEach(opt => {
                const o = document.createElement("option");
                o.value = opt;
                o.textContent = opt;
                field.appendChild(o);
            });
        } else {
            field = document.createElement("input");
            field.type = input.type;
            field.placeholder = input.placeholder || "";
        }

        field.id = `input-${input.key}`;
        field.name = input.key; // so it posts with the form

        row.appendChild(label);
        row.appendChild(field);
        container.appendChild(row);
    });

    window.currentScriptMeta = meta;
}

async function initRunner() {
    const params = new URLSearchParams(window.location.search);

    const product = params.get("product")?.toLowerCase();
    const scriptId = params.get("script");

    if (!product || !scriptId) {
        console.error("Missing product or script in URL");
        return;
    }

    startLogStream(product, scriptId);

    try {
        const manifest = await loadManifest(product);
        const script = manifest.scripts.find(s => s.id === scriptId);

        if (!script) {
            console.error("Script not found in manifest:", scriptId);
            return;
        }

        const productName = manifest?.name || manifest?.title || product;
        document.getElementById("breadcrumb").innerHTML =
            `Automation Runner <span class="crumb-sep">→</span> ${productName} <span class="crumb-sep">→</span> ${script.title || script.name || script.id}`;

        populateHeader(manifest, script);
        populateDescription(product, script);
        applyScriptRequirements(script);
        loadScriptMeta(product, scriptId);
        setupRunForm(product, script);
        SetupAdvancedUI();
        await loadManifest(product);

    } catch (err) {
        console.error("Runner init failed:", err);
    }
}

function SetupAdvancedUI() {
    console.log("[AdvancedUI] setup running");

    const inlineTextarea = document.getElementById("advancedSteps");
    const modal = document.getElementById("advancedEditorModal");
    const modalTextarea = document.getElementById("advancedEditorTextarea");

    if (!inlineTextarea || !modal || !modalTextarea) return;

    const openBtn = document.getElementById("openAdvancedEditor");
    const closeBtn = document.getElementById("closeAdvancedEditor");
    const applyBtn = document.getElementById("applyAdvancedSteps");

    openBtn?.addEventListener("click", () => {
        modalTextarea.value = inlineTextarea.value;
        modal.classList.remove("hidden");
    });

    closeBtn?.addEventListener("click", () => {
        modal.classList.add("hidden");
    });

    applyBtn?.addEventListener("click", () => {
        inlineTextarea.value = modalTextarea.value;
        modal.classList.add("hidden");
    });

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
                { id: "save-provider", label: "Save Provider", steps: `click[value = "Save"]` }
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
        modalTextarea
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
                    modalTextarea,
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

    csvFileInput.addEventListener("change", (e) => {
        console.log("[CSV] file selected", e.target.files);
        handleCsvSelected(e);
    });

    document.querySelectorAll("[data-action]").forEach(btn => {
        btn.addEventListener("click", () => {
            const action = ADVANCED_ACTIONS[btn.dataset.action];
            if (!action) return;

            insertSteps(modalTextarea, action.steps);
        });
    });

    presetSelect.addEventListener("change", () => {
        const preset = ADVANCED_PRESETS.find(p => p.id === presetSelect.value);
        if (!preset) return;

        modalTextarea.value = preset.steps;
        presetSelect.value = "";
    });

    const tokenListEl = document.getElementById("advancedTokenList");

    function renderTokenPanel(headers) {
        tokenListEl.innerHTML = "";

        headers.forEach(header => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.textContent = `{{${header}}} `;

            btn.addEventListener("click", () => {
                insertSteps(
                    modalTextarea,
                    `{{${header}}} `
                );
            });

            tokenListEl.appendChild(btn);
        });
    }

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

    const textarea = document.getElementById("advancedEditorTextarea");
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
    const envFileInput = document.getElementById("envFile");
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

async function populateDescription(product, script) {
    const descEl = document.getElementById("descriptionContent");


    // Otherwise try to load description.md
    try {
        const res = await fetch(`/api/products/${product}/scripts/${script.id}/description`);
        if (res.ok) {
            const markdown = await res.text();
            descEl.innerHTML = marked.parse(markdown);
        } else {
            descEl.textContent = "No description available.";
        }
    } catch {
        descEl.textContent = "No description available.";
    }
}

function setupRunForm(product, script) {
    const form = document.getElementById("run-form");

    // Gather UI values
    const envFileInput = document.getElementById("envFile");
    const csvFileInput = document.getElementById("csvFile");
    const advancedStepsEl = document.getElementById("advancedSteps");

    const options = {
        humanMode: document.getElementById("humanMode").checked,
        humanIntensity: document.getElementById("humanIntensity").value,
        showBrowser: document.getElementById("showBrowser").checked,
        recordVideo: document.getElementById("recordVideo").checked,
        recordTrace: document.getElementById("recordTrace").checked,
        autoScrollLogs: document.getElementById("autoScrollLogs").checked,
        clearLogsOnRun: document.getElementById("clearLogsOnRun").checked
    };

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const status = document.getElementById("runStatus");
        status.textContent = "Starting run…";

        // Build FormData to match server expectations:
        // - envFile => uploaded encrypted env blob
        // - passphrase => decrypt passphrase (optional depending on script)
        // - csvFile => optional CSV input
        // - options => JSON string
        const formData = new FormData();

        if (script.advanced === true && advancedStepsEl?.value.trim()) {
            formData.append(
                "advancedSteps",
                advancedStepsEl.value.trim()
            );
        }

        if (envFileInput && envFileInput.files && envFileInput.files.length > 0) {
            formData.append("envFile", envFileInput.files[0]);
        }

        if (csvFileInput && csvFileInput.files && csvFileInput.files.length > 0) {
            formData.append("csvFile", csvFileInput.files[0]);
        }


        const passphrase =
            document.getElementById("decryptPassword")?.value || "";


        if (passphrase) {
            formData.append("passphrase", passphrase);
        }

        formData.append("options", JSON.stringify(options));

        // Add dynamic inputs from script meta
        if (window.currentScriptMeta && Array.isArray(window.currentScriptMeta.inputs)) {
            window.currentScriptMeta.inputs.forEach(input => {
                const el = document.getElementById(`input-${input.key}`);
                const value = el ? el.value : "";
                formData.append(input.key, value);
            });
        }

        try {
            const res = await fetch(`/api/run/${encodeURIComponent(product)}/${encodeURIComponent(script.id)}`, {
                method: "POST",
                body: formData
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                status.textContent = data.error || "Run failed to start.";
                console.error("Run start error:", data);
            } else {
                status.textContent = data.message || "Run started.";
                // Optionally show runId or wire UI to subscribe to logs/artifacts
                if (data.runId) {
                    // Example: store current run id for later use
                    window.currentRunId = data.runId;
                }
            }
        } catch (err) {
            console.error("Run failed:", err);
            status.textContent = "Run failed.";
        } finally {
            // Clear sensitive input from the page
            const passEl = document.getElementById("decryptPassword");
            if (passEl) passEl.value = "";
        }
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

