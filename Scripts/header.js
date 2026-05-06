
// landing.js
document.addEventListener("DOMContentLoaded", () => {

    checkAuth();
});
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
        updateUserMenu(user);
        loadProducts();
        return user;

    } catch (err) {
        console.error("Auth check failed:", err);
        showLoginModal();
        return null;
    }
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("logging in");
    loginError.style.display = "none";
    loginError.textContent = "";

    const file = envFileInput.files[0];
    const passphrase = passphraseInput.value.trim();

    if (!file) {
        loginError.textContent = "Please select an encrypted .enc file.";
        loginError.style.display = "block";
        return;
    }

    if (!passphrase) {
        loginError.textContent = "Please enter your passphrase.";
        loginError.style.display = "block";
        return;
    }

    try {
        const formData = new FormData();
        formData.append("envFile", file);
        formData.append("passphrase", passphrase);

        const res = await fetch("/api/login", {
            method: "POST",
            body: formData,
            credentials: "include"
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Login failed" }));
            loginError.textContent = err.error || "Login failed";
            loginError.style.display = "block";

            // 🔥 IMPORTANT FIX: reset file input so FormData is rebuilt next click
            envFileInput.value = "";

            return;
        }

        // Success
        checkAuth();
        console.log("Logged in successfully");

    } catch (err) {
        console.error("Login error:", err);
        loginError.textContent = "Unexpected error during login.";
        loginError.style.display = "block";
    }
});
// Show modal
function showLoginModal() {
    loginModal.classList.remove("hidden");
    loginBackdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

// Hide modal
function hideLoginModal() {
    loginModal.classList.add("hidden");
    loginBackdrop.classList.add("hidden");
    document.body.style.overflow = "";
}

function setUserAvatar(name) {
    const avatar = document.getElementById("userAvatar");
    const initials = name
        .split(" ")
        .map(n => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    avatar.textContent = initials;
}

function updateUserMenu(user) {
    const menu = document.getElementById("userMenu");
    const label = document.getElementById("userNameLabel");
    setUserAvatar(user.user.displayName);
    label.textContent = `${user.user.displayName} (${user.user.roles})`;
    menu.classList.remove("hidden");
}

document.getElementById("userDisplay").addEventListener("click", () => {
    const dropdown = document.getElementById("userDropdown");
    const display = document.getElementById("userDisplay");

    dropdown.classList.toggle("hidden");
    display.classList.toggle("open");
});