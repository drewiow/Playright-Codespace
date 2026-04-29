// landing.js
document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
});
// --- Login Modal Elements ---
const loginModal = document.getElementById("loginModal");
const envFileInput = document.getElementById("envFile");
const passphraseInput = document.getElementById("passphrase");
const unlockBtn = document.getElementById("unlockBtn");
const loginError = document.getElementById("loginError");

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await fetch("/api/logout", {
        method: "POST",
        credentials: "include"
    });

    // Force fresh auth check
    showLoginModal();
});

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
        console.log("Hiding Login");
        hideLoginModal();
        console.log("Showing Menu for user : " + user);
        updateUserMenu(user);
        console.log("Loading Products");
        loadProducts();
        return user;

    } catch (err) {
        console.error("Auth check failed:", err);
        showLoginModal();
        return null;
    }
}

unlockBtn.addEventListener("click", async () => {
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
    loginModal.style.display = "flex";   // assuming modal uses flexbox
}

// Hide modal
function hideLoginModal() {
    loginModal.style.display = "none";
}


// Toggle script info popovers
document.addEventListener("click", (e) => {
    const infoBtn = e.target.closest(".info-btn");

    // If clicking a "?" button
    if (infoBtn) {
        const card = infoBtn.closest(".script-card");
        card.classList.toggle("show-info");
        return;
    }

    // If clicking anywhere else, close all popovers
    document.querySelectorAll(".script-card.show-info")
        .forEach(card => card.classList.remove("show-info"));
});

async function loadProducts() {
    try {
        const res = await fetch("/api/products", {
            credentials: "include"
        });

        const products = await res.json();

        const grid = document.querySelector(".product-grid");
        grid.innerHTML = ""; // clear any placeholder HTML

        products.forEach(product => {
            const card = document.createElement("section");
            card.className = "product-card";
            card.dataset.product = product.id;

            card.innerHTML = `
    <img src="${product.logo}" alt="${product.title}">
    <h3>${product.title}</h3>
    <p>${product.description}</p>
`;

            grid.appendChild(card);
        });

        attachProductHandlers();
    } catch (err) {
        console.error("Failed to load products:", err);
    }
}


function attachProductHandlers() {


    document.querySelectorAll(".product-card").forEach(card => {
        card.addEventListener("click", async () => {
            const product = card.dataset.product;


            try {
                const res = await fetch(`/api/products/${product}/manifest`, {
                    credentials: "include"
                });
                const manifest = await res.json();
                const scripts = manifest.scripts;

                // If only one script, go straight to runner
                if (scripts.length === 1) {
                    window.location.href =
                        `/runner.html?product=${product}&script=${scripts[0].id}`;
                    return;
                }

                showScriptPicker(product, scripts);
            } catch (err) {
                console.error("Failed to load manifest:", err);
            }
        });
    });
}

function showScriptPicker(product, scripts) {
    const picker = document.getElementById("scriptPicker");
    const grid = document.getElementById("scriptGrid");

    grid.innerHTML = "";

    scripts.forEach(script => {
        const card = document.createElement("div");
        card.className = "script-card";
        const icon = script.icon || "🧰";
        const hidden = script.description ? "" : "hidden";

        card.innerHTML = `
            <div class="script-icon">${icon}</div>
            <div class="script-name">${script.title}</div>
            <button class="info-btn ${hidden}">?</button>
            <div class="info-popover">${script.description}</div>
            <button class="open-btn">Open</button>
        `;

        card.querySelector(".open-btn").onclick = () => {
            window.location.href =
                `/runner.html?product=${product}&script=${script.id}`;
        };

        grid.appendChild(card);
    });

    picker.classList.remove("hidden");
}