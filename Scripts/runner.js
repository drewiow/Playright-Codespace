// runner.js
document.addEventListener("DOMContentLoaded", () => {
    initRunner();
});

const params = new URLSearchParams(window.location.search);
const product = params.get("product")?.toLowerCase();
const script = params.get("script");

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

        const timestamp = new Date(entry.time).toLocaleTimeString();
        const message = entry.line;

        const div = document.createElement("div");
        div.className = `log-line log-${entry.stream}`;

        div.innerHTML = `
        <span class="log-timestamp">${timestamp}</span>
        <span class="log-message">${message}</span>
    `;

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

    } catch (err) {
        console.error("Runner init failed:", err);
    }
}

function applyScriptRequirements(script) {
    const envFileInput = document.getElementById("envFile");
    const envFileField = envFileInput.closest(".field");

    const passInput = document.getElementById("decryptPassword");
    const passField = passInput.closest(".field");

    // CSV file field
    const csvInput = document.getElementById("csvFile");
    const csvField = csvInput.closest(".field");

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

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const status = document.getElementById("runStatus");
        status.textContent = "Starting run…";

        // Gather UI values
        const envFileInput = document.getElementById("envFile");
        const csvFileInput = document.getElementById("csvFile");
        const passphrase = document.getElementById("decryptPassword").value;

        const options = {
            humanMode: document.getElementById("humanMode").checked,
            humanIntensity: document.getElementById("humanIntensity").value,
            showBrowser: document.getElementById("showBrowser").checked,
            recordVideo: document.getElementById("recordVideo").checked,
            recordTrace: document.getElementById("recordTrace").checked,
            autoScrollLogs: document.getElementById("autoScrollLogs").checked,
            clearLogsOnRun: document.getElementById("clearLogsOnRun").checked
        };

        // Build FormData to match server expectations:
        // - envFile => uploaded encrypted env blob
        // - passphrase => decrypt passphrase (optional depending on script)
        // - csvFile => optional CSV input
        // - options => JSON string
        const formData = new FormData();

        if (envFileInput && envFileInput.files && envFileInput.files.length > 0) {
            formData.append("envFile", envFileInput.files[0]);
        }

        if (csvFileInput && csvFileInput.files && csvFileInput.files.length > 0) {
            formData.append("csvFile", csvFileInput.files[0]);
        }

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

