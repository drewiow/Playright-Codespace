const runForm = document.getElementById("run-form");
const runButton = document.getElementById("runButton");
const runStatus = document.getElementById("runStatus");
const logContainer = document.getElementById("logContainer");
const queueList = document.getElementById("queueList");
const artifactList = document.getElementById("artifactList");
const showBrowserCheckbox = document.getElementById("showBrowser");

let currentJobId = null;
let pollInterval = null;
let lastLogLength = 0;

document.addEventListener("DOMContentLoaded", () => {
    const waitForConfig = setInterval(() => {
        if (!window.scriptConfig) return;

        clearInterval(waitForConfig);

        console.log("[Runner] Applying UI rules:", window.scriptConfig);

        // Hide CSV upload
        if (!window.scriptConfig.requiresCsv) {
            const csvField = document.getElementById("csvFile")?.closest(".field");
            if (csvField) csvField.style.display = "none";
        }

        // Hide decrypt password
        if (!window.scriptConfig.requiresPassword) {
            const pwField = document.getElementById("decryptPassword")?.closest(".field");
            if (pwField) pwField.style.display = "none";
        }

        // Hide options panel
        if (!window.scriptConfig.showOptionsPanel) {
            const panel = document.querySelector(".options-panel");
            if (panel) panel.style.display = "none";
        }

        // Set script name in UI
        if (window.scriptConfig.name) {
            const titleEl = document.getElementById("scriptTitle");
            if (titleEl) titleEl.textContent = window.scriptConfig.name;
        }

        // Load script description
        if (window.scriptConfig.descriptionFile) {
            const url = `/scripts/${window.scriptFolder}/${window.scriptConfig.descriptionFile}`;
            console.log("[Runner] Fetching description:", url);

            fetch(url)
                .then(res => res.text())
                .then(md => {
                    // Convert markdown → HTML
                    const html = marked.parse(md); // requires marked.js
                    document.getElementById("descriptionContent").innerHTML = html;
                })
                .catch(err => {
                    console.error("[Runner] Failed to load description:", err);
                    document.getElementById("descriptionContent").textContent =
                        "No description available.";
                });
        }
    }, 50);
});

runForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    resetUI();

    const fileInput = document.getElementById("csvFile");
    if (!fileInput.files.length) {
        alert("Please select a CSV file.");
        return;
    }

    const config = {
        human: document.getElementById("humanMode").checked,
        intensity: Number(document.getElementById("humanIntensity").value),
        headless: !document.getElementById("showBrowser").checked,
        recordVideo: document.getElementById("recordVideo").checked,
        recordTrace: document.getElementById("recordTrace").checked,
        autoScrollLogs: document.getElementById("autoScrollLogs").checked,
        clearLogsOnRun: document.getElementById("clearLogsOnRun").checked
    };


    const formData = new FormData();
    formData.append("config", JSON.stringify(config));
    formData.append("file", fileInput.files[0]);
    formData.append("headless", showBrowserCheckbox.checked ? "false" : "true");
    formData.append("password", document.getElementById("decryptPassword").value);
    formData.append("human", document.getElementById("humanMode").checked);
    formData.append("scriptName", window.scriptName);
    formData.append("scriptFolder", window.scriptFolder);

    runButton.disabled = true;
    runStatus.textContent = "Submitting run...";

    try {
        const res = await fetch("/api/run", {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.error || "Failed to start run");
        }

        const data = await res.json();
        currentJobId = data.jobId;
        runStatus.textContent = `Run #${currentJobId} created.`;

        // Start polling for status/logs
        pollInterval = setInterval(fetchJobStatus, 1500);
    } catch (err) {
        console.error(err);
        runStatus.textContent = `Error: ${err.message}`;
        runButton.disabled = false;
    }
});

async function fetchJobStatus() {
    if (!currentJobId) return;

    try {
        const res = await fetch(`/api/job/${currentJobId}`);
        if (!res.ok) {
            throw new Error("Failed to fetch job status");
        }

        const data = await res.json();
        updateQueue(data);
        updateLogs(data);
        updateStatusAndArtifacts(data);

        if (data.status === "completed" || data.status === "failed") {
            clearInterval(pollInterval);
            pollInterval = null;
            runButton.disabled = false;
        }
    } catch (err) {
        console.error(err);
        runStatus.textContent = `Error: ${err.message}`;
        clearInterval(pollInterval);
        pollInterval = null;
        runButton.disabled = false;
    }
}

function updateQueue(jobData) {
    queueList.innerHTML = "";

    if (!jobData.queue || !jobData.queue.length) {
        const li = document.createElement("li");
        li.textContent = "No queued runs.";
        queueList.appendChild(li);
        return;
    }

    for (const q of jobData.queue) {
        const li = document.createElement("li");
        let label = `Run #${q.id} — ${q.status}`;
        if (q.id === jobData.id) {
            label += " (you)";
        }
        li.textContent = label;
        queueList.appendChild(li);
    }
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
