document.addEventListener("DOMContentLoaded", () => {
    if (window.location.hash === "#edit") {
        openEditUserModal();
    }
});

function openEditUserModal() {
    document.getElementById("editUserModal")?.classList.remove("hidden");
    document.getElementById("existingEnvFile")?.focus();
}

function closeEditUserModal() {
    document.getElementById("editUserModal")?.classList.add("hidden");

    if (window.location.hash === "#edit") {
        history.replaceState(null, "", window.location.pathname);
    }
}

document.getElementById("closeEditModalBtn")
    ?.addEventListener("click", closeEditUserModal);


