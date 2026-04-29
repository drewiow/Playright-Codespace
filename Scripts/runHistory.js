document.addEventListener("DOMContentLoaded", () => {
    loadRunHistory();
    setupModalControls();
});

/* -------------------------------------------------------
   LOAD RUN HISTORY TABLE
------------------------------------------------------- */
async function loadRunHistory() {
    const tbody = document.querySelector("#runHistoryTable tbody");
    tbody.innerHTML = `<tr><td colspan="8">Loading…</td></tr>`;

    try {
        const runs = await fetch("/api/runs").then(r => r.json());
        tbody.innerHTML = "";

        if (!runs.length) {
            tbody.innerHTML = `<tr><td colspan="8">No runs found.</td></tr>`;
            return;
        }

        runs.forEach(run => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
    <td>${run.runId}</td>
    <td>${run.product || "—"}</td>
    <td>${run.script}</td>
    <td>${run.user?.displayName || run.user?.userId || "unknown"}</td>
    <td>${run.timestamp ? new Date(run.timestamp).toLocaleString() : "—"}</td>
    <td>${(run.durationMs / 1000).toFixed(1)}s</td>
    <td class="status-${run.status}">${run.status}</td>
    <td><button class="viewRunBtn" data-run="${run.runId}">View</button></td>
`;

            tbody.appendChild(tr);
        });

        document.querySelectorAll(".viewRunBtn").forEach(btn => {
            btn.addEventListener("click", () => openRunModal(btn.dataset.run));
        });

    } catch (err) {
        console.error("Failed to load run history:", err);
        tbody.innerHTML = `<tr><td colspan="8">Error loading history.</td></tr>`;
    }
}

/* -------------------------------------------------------
   MODAL CONTROLS
------------------------------------------------------- */
function setupModalControls() {
    const modal = document.getElementById("runDetailModal");
    const closeBtn = document.getElementById("closeRunModal");

    closeBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
    });

    // Tab switching
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            switchTab(btn.dataset.tab);
        });
    });

    // Sub‑tabs for logs
    document.querySelectorAll(".subtab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            switchLogTab(btn.dataset.log);
        });
    });
}

async function loadVideos(runId) {
    console.log("loadVideos CALLED for run:", runId);

    const tabBar = document.querySelector(".tab-bar"); // your tab button container
    console.log("TAB BAR:", tabBar);
    const existingBtn = document.querySelector("[data-tab='videosTab']");
    const videoList = document.getElementById("videoList");
    let files;
    try {
        files = await fetch(`/api/run/${runId}/artifacts`).then(r => r.json());
        files = files.map(f => f.replace(/\\/g, "/"));
        const videos = files.filter(f => f.endsWith(".webm") || f.endsWith(".mp4"));

        // If no videos → remove tab if it exists
        if (!videos.length) {
            if (existingBtn) existingBtn.remove();

            return;
        }

        // If videos exist → ensure tab button exists
        if (!existingBtn) {
            const btn = document.createElement("button");
            btn.className = "tab-btn";
            btn.dataset.tab = "videosTab";
            btn.textContent = "Videos";
            tabBar.appendChild(btn);
            btn.addEventListener("click", () => switchTab("videosTab"));

        }

        // Populate the list
        videoList.innerHTML = "";
        videos.forEach(file => {
            const li = document.createElement("li");
            const a = document.createElement("a");

            a.href = "#";
            a.textContent = file;

            a.addEventListener("click", () => {
                const videoUrl = `/api/run/${runId}/artifact?path=${encodeURIComponent(file)}`;
                const player = document.getElementById("videoPlayer");
                const container = document.getElementById("videoPlayerContainer");

                player.src = videoUrl;
                container.classList.remove("hidden");
                player.scrollIntoView({ behavior: "smooth" });
            });

            li.appendChild(a);
            videoList.appendChild(li);
        });

        // Make sure the tab panel is visible
        document.getElementById("videosTab").classList.remove("hidden");

    } catch (err) {
        console.error("Video load failed:", err);
        videoList.innerHTML = "<li>Error loading videos.</li>";
    }
}
/* -------------------------------------------------------
   OPEN MODAL + LOAD RUN DETAILS
------------------------------------------------------- */
async function openRunModal(runId) {
    const modal = document.getElementById("runDetailModal");
    modal.classList.remove("hidden");

    document.getElementById("runModalTitle").textContent = `Run #${runId}`;

    // Reset content
    document.getElementById("summaryTab").innerHTML = "Loading…";
    document.getElementById("auditTab").innerHTML = "Loading…";
    document.getElementById("stdoutLog").textContent = "";
    document.getElementById("stderrLog").textContent = "";
    document.getElementById("artifactList").innerHTML = "";

    // Load all tabs
    loadSummary(runId);
    loadAudit(runId);
    loadLogs(runId);
    loadArtifacts(runId);
    await loadVideos(runId); // this will decide whether to show the tab

    // Default tab
    switchTab("summaryTab");
}

/* -------------------------------------------------------
   TAB SWITCHING
------------------------------------------------------- */
function switchTab(tabId) {
    document.querySelectorAll(".tab-btn").forEach(btn =>
        btn.classList.toggle("active", btn.dataset.tab === tabId)
    );

    document.querySelectorAll(".tab-panel").forEach(panel => {
        const isActive = panel.id === tabId;
        panel.classList.toggle("active", isActive);
        panel.classList.toggle("hidden", !isActive); // ⭐ add this
    });
}

function switchLogTab(type) {
    document.querySelectorAll(".subtab-btn").forEach(btn =>
        btn.classList.toggle("active", btn.dataset.log === type)
    );

    document.querySelectorAll(".log-viewer").forEach(view =>
        view.classList.toggle("active", view.id === `${type}Log`)
    );
}

/* -------------------------------------------------------
   LOAD SUMMARY
------------------------------------------------------- */
async function loadSummary(runId) {
    try {
        const data = await fetch(`/api/run/${runId}`).then(r => r.json());

        const html = `
    <table class="summary-table">
        <tr><th>Run ID</th><td>${data.runId}</td></tr>
        <tr><th>Script</th><td>${data.script}</td></tr>
        <tr><th>User</th><td>${data.user?.displayName || data.user?.userId}</td></tr>
        <tr><th>Started</th><td>${new Date(data.timestamp).toLocaleString()}</td></tr>
        <tr><th>Completed</th><td>${new Date(data.completedAt).toLocaleString()}</td></tr>
        <tr><th>Duration</th><td>${(data.durationMs / 1000).toFixed(1)}s</td></tr>
        <tr><th>Status</th><td class="status-${data.status}">${data.status}</td></tr>
        <tr><th>Exit Code</th><td>${data.exitCode ?? "—"}</td></tr>
        <tr><th>Signal</th><td>${data.signal ?? "—"}</td></tr>
    </table>
`;

        document.getElementById("summaryTab").innerHTML = html;

    } catch (err) {
        console.error("Summary load failed:", err);
        document.getElementById("summaryTab").textContent = "Failed to load summary.";
    }
}

/* -------------------------------------------------------
   LOAD AUDIT
------------------------------------------------------- */
async function loadAudit(runId) {
    try {
        const data = await fetch(`/api/run/${runId}`).then(r => r.json());

        document.getElementById("auditTab").innerHTML =
            `<pre class="audit-json">${JSON.stringify(data, null, 2)}</pre>`;

    } catch (err) {
        console.error("Audit load failed:", err);
        document.getElementById("auditTab").textContent = "Failed to load audit.";
    }
}

/* -------------------------------------------------------
   LOAD LOGS
------------------------------------------------------- */
async function loadLogs(runId) {
    try {
        const logs = await fetch(`/api/run/${runId}/logs`).then(r => r.json());

        document.getElementById("stdoutLog").textContent = logs.stdout || "";
        document.getElementById("stderrLog").textContent = logs.stderr || "";

    } catch (err) {
        console.error("Log load failed:", err);
        document.getElementById("stdoutLog").textContent = "Failed to load logs.";
    }
}

/* -------------------------------------------------------
   LOAD ARTIFACTS
------------------------------------------------------- */
async function loadArtifacts(runId) {
    try {
        const files = await fetch(`/api/run/${runId}/artifacts`).then(r => r.json());
        const list = document.getElementById("artifactList");

        if (!files.length) {
            list.innerHTML = "<li>No artifacts.</li>";
            return;
        }

        list.innerHTML = "";

        files.forEach(file => {
            const li = document.createElement("li");
            const a = document.createElement("a");

            a.href = `/api/run/${runId}/artifact/${encodeURIComponent(file)}`;
            a.textContent = file;
            a.target = "_blank";

            li.appendChild(a);
            list.appendChild(li);
        });

    } catch (err) {
        console.error("Artifact load failed:", err);
        document.getElementById("artifactList").innerHTML =
            "<li>Error loading artifacts.</li>";
    }
}