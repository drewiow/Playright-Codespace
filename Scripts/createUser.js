document.getElementById("envForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const status = document.getElementById("status");
    status.textContent = "Encrypting…";

    async function checkAuth() {
        try {
            const res = await fetch("/api/session/me", {
                credentials: "include"
            });

            if (!res.ok) {
                // Not logged in → show login modal
                showLoginModal();
                return null;
            }

            const user = await res.json();
            hideLoginModal();
            return user;

        } catch (err) {
            console.error("Auth check failed:", err);
            showLoginModal();
            return null;
        }
    }

    // NEW: identity fields
    const payload = {
        USER_ID: document.getElementById("userId").value,
        DISPLAY_NAME: document.getElementById("displayName").value,
        EMAIL: document.getElementById("email").value,
        ROLES: document.getElementById("roles").value,

        // Existing fields
        USERNAME: document.getElementById("username").value,
        PASSWORD: document.getElementById("password").value,
        SECURITY_WORD: document.getElementById("securityWord").value,
        SECRET_KEY: document.getElementById("secretKey").value,

        MASTER_PASSWORD: document.getElementById("masterPassword").value
    };

    const res = await fetch("/api/env/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        status.textContent = "❌ Failed to create env.enc";
        return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "env.enc";
    a.click();

    status.textContent = "✅ env.enc created and downloaded";
});