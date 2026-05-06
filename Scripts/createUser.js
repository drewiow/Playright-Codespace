
// -----------------------------------
// State (in memory only)
// -----------------------------------
let lastEncryptedBlob = null;
let lastFileName = null;

// -----------------------------------
// Init
// -----------------------------------
document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("envForm");
    const confirmBtn = document.getElementById("confirmGenerate");
    const cancelBtn = document.getElementById("cancelFinalize");
    const downloadAgainBtn = document.getElementById("downloadAgainBtn");
    const createAnotherBtn = document.getElementById("createAnotherBtn");

    if (!form) return;

    form.addEventListener("submit", handleFormSubmit);
    confirmBtn?.addEventListener("click", handleConfirmGenerate);
    cancelBtn?.addEventListener("click", closeFinalizeModal);
    downloadAgainBtn?.addEventListener("click", handleDownloadAgain);
    createAnotherBtn?.addEventListener("click", () => window.location.reload());
});

// -----------------------------------
// Step 1: Form submit → open modal
// -----------------------------------
function handleFormSubmit(e) {
    e.preventDefault();

    const form = document.getElementById("envForm");

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    openFinalizeModal();
}

// -----------------------------------
// Step 2: Confirm → call API + download
// -----------------------------------
async function handleConfirmGenerate() {

    const passphraseInput = document.getElementById("masterPassphrase");
    const passphrase = passphraseInput?.value;

    if (!passphrase) {
        alert("Master passphrase is required.");
        return;
    }

    try {
        const payload = {
            ...collectFormData(),
            MASTER_PASSWORD: passphrase   // must match server
        };

        const res = await generateEnvEnc(payload);
        const blob = await res.blob();

        const userId = document.getElementById("userId").value;
        const safeUserId = safeFileName(userId);
        const fileName = `${safeUserId}.enc`;

        // Download once
        downloadEncryptedFile(blob, fileName);

        // Show success UI
        showSuccessState({
            userName: document.getElementById("userDisplayName").value,
            fileName
        });

        closeFinalizeModal();

    } catch (err) {
        console.error(err);
        alert("Failed to generate encrypted file.");
    }
}

// -----------------------------------
// API Call
// -----------------------------------
async function generateEnvEnc(payload) {
    const res = await fetch("/api/env/create", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(err);
    }

    return res;
}

// -----------------------------------
// Data Collection
// -----------------------------------
function collectFormData() {
    return {
        USERNAME: document.getElementById("username").value,
        PASSWORD: document.getElementById("password").value,
        SECURITY_WORD: document.getElementById("securityWord").value,
        SECRET_KEY: document.getElementById("secretKey").value,
        USER_ID: document.getElementById("userId").value,
        USER_EMAIL: document.getElementById("userEmail").value,
        USER_DISPLAY_NAME: document.getElementById("userDisplayName").value,
        ROLES: collectRoles()
    };
}

function collectRoles() {
    return Array.from(
        document.querySelectorAll(".role-list input[type='checkbox']:checked")
    ).map(cb => cb.value);
}

// -----------------------------------
// Modal Controls
// -----------------------------------
function openFinalizeModal() {
    document.getElementById("finalizeUserModal")
        ?.classList.remove("hidden");
}

function closeFinalizeModal() {
    const modal = document.getElementById("finalizeUserModal");
    modal?.classList.add("hidden");

    const input = document.getElementById("masterPassphrase");
    if (input) input.value = "";
}

// -----------------------------------
// Success State
// -----------------------------------
function showSuccessState({ userName, fileName }) {
    document.getElementById("createUserFormCard")
        ?.classList.add("hidden");

    const success = document.getElementById("createUserSuccess");
    success?.classList.remove("hidden");

    document.getElementById("successUserName").textContent = userName;
    document.getElementById("successFileName").textContent = fileName;
}

// -----------------------------------
// Download Handling
// -----------------------------------
function downloadEncryptedFile(blob, fileName) {
    lastEncryptedBlob = blob;
    lastFileName = fileName;

    triggerDownload(blob, fileName);
}

function handleDownloadAgain() {
    if (!lastEncryptedBlob || !lastFileName) {
        alert("No file available.");
        return;
    }

    triggerDownload(lastEncryptedBlob, lastFileName);
}

function triggerDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.style.display = "none";

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}

// -----------------------------------
// Helpers
// -----------------------------------
function safeFileName(input) {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9._-]+/g, "-");
}
